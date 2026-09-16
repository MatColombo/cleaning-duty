-- House Care v1.2.1: linked activities and explicit cleanliness participation.
-- Upgrade after v1.2.0-r4.2. Safe to rerun. Does not generate or replay reminders.
begin;

alter table public.routines
  add column if not exists affects_cleanliness boolean not null default true,
  add column if not exists parent_routine_id uuid,
  add column if not exists trigger_every integer;

alter table public.routines drop constraint if exists routines_linked_trigger_check;
alter table public.routines add constraint routines_linked_trigger_check check (
  (parent_routine_id is null and trigger_every is null)
  or (parent_routine_id is not null and parent_routine_id <> id and trigger_every is not null and trigger_every between 1 and 100)
);
alter table public.routines drop constraint if exists routines_parent_routine_fk;
alter table public.routines add constraint routines_parent_routine_fk foreign key (parent_routine_id)
  references public.routines(id) deferrable initially deferred;
create index if not exists routines_parent_idx on public.routines(parent_routine_id) where parent_routine_id is not null;

alter table public.task_occurrences
  add column if not exists trigger_ordinal integer,
  add column if not exists parent_occurrence_id uuid;
alter table public.task_occurrences drop constraint if exists task_trigger_ordinal_check;
alter table public.task_occurrences add constraint task_trigger_ordinal_check check (trigger_ordinal is null or trigger_ordinal > 0);
alter table public.task_occurrences drop constraint if exists task_parent_occurrence_fk;
alter table public.task_occurrences add constraint task_parent_occurrence_fk foreign key (parent_occurrence_id)
  references public.task_occurrences(id) deferrable initially deferred;
create index if not exists task_parent_occurrence_idx on public.task_occurrences(parent_occurrence_id) where parent_occurrence_id is not null;

-- Deferred validation supports a single batched upsert containing both parent and children.
-- The existing table RLS still applies to all app writes.
create or replace function public.validate_linked_routine_v121()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_row public.routines;
begin
  if new.parent_routine_id is null then return new; end if;
  select * into parent_row from public.routines where id = new.parent_routine_id;
  if not found or parent_row.workspace_id <> new.workspace_id then raise exception 'Linked routine parent must belong to the same household'; end if;
  if parent_row.parent_routine_id is not null then raise exception 'Nested linked routines are not supported'; end if;
  if exists (select 1 from public.routines where parent_routine_id = new.id) then raise exception 'A parent routine cannot become a linked routine'; end if;
  if new.archived_at is null and parent_row.recurrence->>'kind' = 'once' then raise exception 'Linked activities require a recurring parent'; end if;
  return new;
end;
$$;
drop trigger if exists validate_linked_routine_v121 on public.routines;
create constraint trigger validate_linked_routine_v121 after insert or update on public.routines
  deferrable initially deferred for each row execute function public.validate_linked_routine_v121();

create or replace function public.validate_linked_task_v121()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_row public.task_occurrences; linked_parent uuid;
begin
  if new.parent_occurrence_id is null then return new; end if;
  select * into parent_row from public.task_occurrences where id = new.parent_occurrence_id;
  select parent_routine_id into linked_parent from public.routines where id = new.routine_id;
  if not found or linked_parent is null or parent_row.id is null or parent_row.workspace_id <> new.workspace_id or linked_parent <> parent_row.routine_id then
    raise exception 'Invalid linked parent occurrence';
  end if;
  if new.parent_occurrence_id = new.id or parent_row.scheduled_slot_at <> new.scheduled_slot_at then raise exception 'Linked occurrence must use the original parent slot'; end if;
  return new;
end;
$$;
drop trigger if exists validate_linked_task_v121 on public.task_occurrences;
create constraint trigger validate_linked_task_v121 after insert or update on public.task_occurrences
  deferrable initially deferred for each row execute function public.validate_linked_task_v121();

create or replace function public.apply_v12_cleanliness_effects(
  task_row public.task_occurrences,
  event_at timestamptz,
  actor_member uuid,
  completion_effects jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  effect jsonb;
  snapshot_id uuid;
  effect_item uuid;
  effect_source_routine uuid;
  effect_trajectory_routine uuid;
  effect_channel text;
  applied boolean;
begin
  -- Completion still commits for non-cleaning reminders; only its health effect is suppressed.
  if not exists (select 1 from public.routines where id = task_row.routine_id and workspace_id = task_row.workspace_id and affects_cleanliness) then return; end if;
  for effect in select value from jsonb_array_elements(coalesce(completion_effects, '[]'::jsonb)) loop
    snapshot_id := (effect->>'snapshotId')::uuid;
    effect_item := (effect->>'itemId')::uuid;
    effect_source_routine := (effect->>'sourceRoutineId')::uuid;
    effect_trajectory_routine := (effect->>'trajectoryRoutineId')::uuid;
    effect_channel := effect->>'cleanlinessChannel';
    applied := coalesce((effect->>'healthRefreshApplied')::boolean, false);

    if effect_source_routine <> task_row.routine_id then raise exception 'Invalid cleanliness source routine'; end if;
    if effect_channel not in ('regular','deep') then raise exception 'Invalid cleanliness channel'; end if;
    if not exists (select 1 from public.task_targets where task_id = task_row.id and entity_id = effect_item) then
      raise exception 'Invalid cleanliness target';
    end if;
    if not exists (select 1 from public.routines where id = effect_trajectory_routine and workspace_id = task_row.workspace_id) then
      raise exception 'Invalid cleanliness trajectory routine';
    end if;

    if not exists (select 1 from public.routines where id = effect_trajectory_routine and workspace_id = task_row.workspace_id and affects_cleanliness) then continue; end if;

    insert into public.completion_snapshots(
      id, workspace_id, occurrence_id, source_routine_id, trajectory_routine_id, item_id,
      cleanliness_channel, completed_at, refresh_level_pct_snapshot, cleanliness_before_pct,
      cleanliness_after_pct, health_refresh_applied, scheduled_slot_at, actor_member_id
    ) values (
      snapshot_id, task_row.workspace_id, task_row.id, effect_source_routine, effect_trajectory_routine, effect_item,
      effect_channel, event_at, (effect->>'refreshLevelPctSnapshot')::numeric, (effect->>'cleanlinessBeforePct')::numeric,
      (effect->>'cleanlinessAfterPct')::numeric, applied, task_row.scheduled_slot_at, actor_member
    ) on conflict (id) do nothing;

    if applied then
      if effect->>'healthAnchorAt' is null or effect->>'healthDueAt' is null or effect->>'healthOverdueEndAt' is null then
        raise exception 'Applied cleanliness effect is missing trajectory boundaries';
      end if;
      insert into public.health_trajectories(
        workspace_id, item_id, routine_id, cleanliness_channel, health_anchor_at, health_anchor_pct,
        health_due_at, health_overdue_end_at, last_refresh_completion_id, updated_at
      ) values (
        task_row.workspace_id, effect_item, effect_trajectory_routine, effect_channel,
        (effect->>'healthAnchorAt')::timestamptz, (effect->>'healthAnchorPct')::numeric,
        (effect->>'healthDueAt')::timestamptz, (effect->>'healthOverdueEndAt')::timestamptz,
        snapshot_id, event_at
      ) on conflict (routine_id, item_id, cleanliness_channel) do update
        set health_anchor_at = excluded.health_anchor_at,
            health_anchor_pct = excluded.health_anchor_pct,
            health_due_at = excluded.health_due_at,
            health_overdue_end_at = excluded.health_overdue_end_at,
            last_refresh_completion_id = excluded.last_refresh_completion_id,
            updated_at = excluded.updated_at
        where excluded.health_anchor_at >= public.health_trajectories.health_anchor_at;
    end if;
  end loop;
end;
$$;
revoke all on function public.apply_v12_cleanliness_effects(public.task_occurrences,timestamptz,uuid,jsonb) from public;


comment on column public.routines.affects_cleanliness is 'False excludes the routine from item/room/home cleanliness and completion refresh effects; history and reminders remain active.';
comment on column public.routines.trigger_every is 'Every N scheduled parent occurrences, counted from the parent recurrence anchor. Skips do not reset the counter.';
comment on column public.task_occurrences.trigger_ordinal is 'Stable schedule ordinal; never a count of completion or materialized rows.';
comment on column public.task_occurrences.parent_occurrence_id is 'Optional link to the parent trigger. This occurrence remains independently actionable.';

notify pgrst, 'reload schema';
commit;
