-- House Care v1.2.0 Phase 1 — canonical cadence/occurrence state and Cleanliness Engine v2.
-- Non-destructive: legacy due/care columns remain mirrored during the v1.2 transition.

alter table public.routines
  add column if not exists cleanliness_channel text not null default 'regular',
  add column if not exists routine_timezone text,
  add column if not exists refresh_level_pct numeric not null default 100,
  add column if not exists status text not null default 'active';

update public.routines
set cleanliness_channel = case when care_level = 'deep' then 'deep' else 'regular' end;

update public.routines r
set routine_timezone = coalesce(r.routine_timezone, w.timezone)
from public.workspaces w
where w.id = r.workspace_id;

alter table public.routines alter column routine_timezone set not null;

alter table public.routines drop constraint if exists routines_cleanliness_channel_check;
alter table public.routines add constraint routines_cleanliness_channel_check check (cleanliness_channel in ('regular','deep'));
alter table public.routines drop constraint if exists routines_refresh_level_pct_check;
alter table public.routines add constraint routines_refresh_level_pct_check check (refresh_level_pct between 10 and 100);
alter table public.routines drop constraint if exists routines_status_check;
alter table public.routines add constraint routines_status_check check (status in ('active','paused','ended'));

alter table public.task_occurrences
  add column if not exists scheduled_slot_at timestamptz,
  add column if not exists effective_due_at timestamptz,
  add column if not exists cleanliness_channel text,
  add column if not exists completed_at timestamptz;

update public.task_occurrences
set scheduled_slot_at = coalesce(scheduled_slot_at, original_due_at, due_at),
    effective_due_at = coalesce(effective_due_at, due_at, original_due_at),
    cleanliness_channel = coalesce(cleanliness_channel, case when care_level = 'deep' then 'deep' else 'regular' end);

alter table public.task_occurrences alter column scheduled_slot_at set not null;
alter table public.task_occurrences alter column effective_due_at set not null;
alter table public.task_occurrences alter column cleanliness_channel set not null;
alter table public.task_occurrences drop constraint if exists task_occurrences_cleanliness_channel_check;
alter table public.task_occurrences add constraint task_occurrences_cleanliness_channel_check check (cleanliness_channel in ('regular','deep'));

-- Preserve terminal timestamp where legacy audit history can supply it.
with completed as (
  select distinct on (task_id) task_id, event_at
  from public.task_events
  where event_type = 'COMPLETED'
  order by task_id, event_at desc, id desc
)
update public.task_occurrences t
set completed_at = c.event_at
from completed c
where t.id = c.task_id and t.state = 'completed' and t.completed_at is null;

create unique index if not exists task_occurrences_scheduled_slot_unique
  on public.task_occurrences(routine_id, routine_revision, scheduled_slot_at);
create index if not exists task_occurrences_workspace_effective_due_idx
  on public.task_occurrences(workspace_id, effective_due_at);

-- Keep canonical and legacy transition columns synchronized. scheduled_slot_at is immutable.
create or replace function public.sync_task_occurrence_v12_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.scheduled_slot_at := coalesce(new.scheduled_slot_at, new.original_due_at, new.due_at);
    new.effective_due_at := coalesce(new.effective_due_at, new.due_at, new.original_due_at);
    new.cleanliness_channel := coalesce(new.cleanliness_channel, case when new.care_level = 'deep' then 'deep' else 'regular' end);
  else
    if new.scheduled_slot_at is distinct from old.scheduled_slot_at then
      raise exception 'scheduled_slot_at is immutable';
    end if;
    if new.effective_due_at is not distinct from old.effective_due_at and new.due_at is distinct from old.due_at then
      new.effective_due_at := new.due_at;
    end if;
    if new.cleanliness_channel is not distinct from old.cleanliness_channel and new.care_level is distinct from old.care_level then
      new.cleanliness_channel := case when new.care_level = 'deep' then 'deep' else 'regular' end;
    end if;
  end if;
  new.original_due_at := new.scheduled_slot_at;
  new.due_at := new.effective_due_at;
  new.care_level := case when new.cleanliness_channel = 'deep' then 'deep' else 'routine' end;
  return new;
end;
$$;

drop trigger if exists sync_task_occurrence_v12_columns on public.task_occurrences;
create trigger sync_task_occurrence_v12_columns
before insert or update on public.task_occurrences
for each row execute function public.sync_task_occurrence_v12_columns();

create or replace function public.sync_routine_v12_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.routine_timezone is null or btrim(new.routine_timezone) = '' then
    select timezone into new.routine_timezone from public.workspaces where id = new.workspace_id;
  end if;
  if tg_op = 'INSERT' then
    new.cleanliness_channel := coalesce(new.cleanliness_channel, case when new.care_level = 'deep' then 'deep' else 'regular' end);
  elsif new.cleanliness_channel is not distinct from old.cleanliness_channel and new.care_level is distinct from old.care_level then
    new.cleanliness_channel := case when new.care_level = 'deep' then 'deep' else 'regular' end;
  end if;
  new.care_level := case when new.cleanliness_channel = 'deep' then 'deep' else 'routine' end;
  return new;
end;
$$;

drop trigger if exists sync_routine_v12_columns on public.routines;
create trigger sync_routine_v12_columns
before insert or update on public.routines
for each row execute function public.sync_routine_v12_columns();

create table if not exists public.completion_snapshots (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  occurrence_id uuid not null references public.task_occurrences(id) on delete cascade,
  source_routine_id uuid not null references public.routines(id) on delete cascade,
  trajectory_routine_id uuid not null references public.routines(id) on delete cascade,
  item_id uuid not null references public.entities(id) on delete restrict,
  cleanliness_channel text not null check (cleanliness_channel in ('regular','deep')),
  completed_at timestamptz not null,
  refresh_level_pct_snapshot numeric not null check (refresh_level_pct_snapshot between 10 and 100),
  cleanliness_before_pct numeric not null check (cleanliness_before_pct between 0 and 100),
  cleanliness_after_pct numeric not null check (cleanliness_after_pct between 0 and 100),
  health_refresh_applied boolean not null,
  scheduled_slot_at timestamptz not null,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (occurrence_id, trajectory_routine_id, item_id, cleanliness_channel, completed_at)
);
create index if not exists completion_snapshots_workspace_completed_idx on public.completion_snapshots(workspace_id, completed_at desc);
create index if not exists completion_snapshots_item_channel_idx on public.completion_snapshots(item_id, cleanliness_channel, completed_at desc);

create table if not exists public.health_trajectories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.entities(id) on delete restrict,
  routine_id uuid not null references public.routines(id) on delete cascade,
  cleanliness_channel text not null check (cleanliness_channel in ('regular','deep')),
  health_anchor_at timestamptz not null,
  health_anchor_pct numeric not null check (health_anchor_pct between 0 and 100),
  health_due_at timestamptz not null,
  health_overdue_end_at timestamptz not null,
  last_refresh_completion_id uuid references public.completion_snapshots(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (routine_id, item_id, cleanliness_channel),
  check (health_overdue_end_at > health_due_at)
);
create index if not exists health_trajectories_workspace_channel_idx on public.health_trajectories(workspace_id, cleanliness_channel);
create index if not exists health_trajectories_item_channel_idx on public.health_trajectories(item_id, cleanliness_channel);

alter table public.completion_snapshots enable row level security;
alter table public.health_trajectories enable row level security;

drop policy if exists "completion_snapshots_select" on public.completion_snapshots;
create policy "completion_snapshots_select" on public.completion_snapshots for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "completion_snapshots_insert" on public.completion_snapshots;
create policy "completion_snapshots_insert" on public.completion_snapshots for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "health_trajectories_select" on public.health_trajectories;
create policy "health_trajectories_select" on public.health_trajectories for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "health_trajectories_insert" on public.health_trajectories;
create policy "health_trajectories_insert" on public.health_trajectories for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "health_trajectories_update" on public.health_trajectories;
create policy "health_trajectories_update" on public.health_trajectories for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- A stale full-household save from another device must never roll a physical
-- maintenance trajectory back behind a newer completion.
create or replace function public.guard_health_trajectory_monotonic_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.health_anchor_at < old.health_anchor_at then return old; end if;
  if new.health_anchor_at = old.health_anchor_at and new.updated_at < old.updated_at then return old; end if;
  return new;
end;
$$;

drop trigger if exists guard_health_trajectory_monotonic on public.health_trajectories;
create trigger guard_health_trajectory_monotonic
before update on public.health_trajectories
for each row execute function public.guard_health_trajectory_monotonic_update();

-- Apply client-computed canonical completion effects inside the same DB transaction
-- as the occurrence mutation. Effects are validated against the task target/workspace.
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

-- Replace runtime mutation with canonical effective due time + transactional cleanliness effects.
drop function if exists public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,uuid,boolean);
create or replace function public.apply_task_mutation(
  target_task_id uuid,
  expected_version integer,
  mutation_kind text,
  event_id uuid,
  event_at timestamptz,
  new_effective_due_at timestamptz default null,
  completion_effects jsonb default '[]'::jsonb,
  new_assignee_member_id uuid default null,
  clear_assignee boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  actor_member uuid;
  event_type text;
  event_metadata jsonb := '{}'::jsonb;
  snapshot_ids jsonb := '[]'::jsonb;
begin
  select * into task_row from public.task_occurrences where id = target_task_id for update;
  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then raise exception 'Task is unavailable'; end if;
  if exists (select 1 from public.task_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version);
  end if;
  if task_row.version <> expected_version or task_row.state <> 'scheduled' then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;
  select id into actor_member from public.workspace_members where workspace_id = task_row.workspace_id and user_id = auth.uid() and status = 'active' limit 1;

  if mutation_kind = 'complete' then
    update public.task_targets set completed_at = coalesce(completed_at, event_at), completed_by_member_id = coalesce(completed_by_member_id, actor_member)
      where task_id = target_task_id;
    update public.task_occurrences set state = 'completed', completed_at = event_at, version = version + 1 where id = target_task_id;
    perform public.apply_v12_cleanliness_effects(task_row, event_at, actor_member, completion_effects);
    select coalesce(jsonb_agg(value->>'snapshotId'), '[]'::jsonb) into snapshot_ids from jsonb_array_elements(coalesce(completion_effects, '[]'::jsonb));
    event_metadata := jsonb_build_object('cleanlinessSnapshots', snapshot_ids);
    event_type := 'COMPLETED';
  elsif mutation_kind = 'skip' then
    update public.task_occurrences set state = 'skipped', version = version + 1 where id = target_task_id;
    event_type := 'SKIPPED';
  elsif mutation_kind = 'postpone' then
    if new_effective_due_at is null then raise exception 'new_effective_due_at is required'; end if;
    event_metadata := jsonb_build_object('from', task_row.effective_due_at, 'to', new_effective_due_at, 'scheduledSlotAt', task_row.scheduled_slot_at);
    update public.task_occurrences set effective_due_at = new_effective_due_at, version = version + 1 where id = target_task_id;
    event_type := 'POSTPONED';
  elsif mutation_kind = 'reassign' then
    if not clear_assignee and new_assignee_member_id is not null and not exists (
      select 1 from public.workspace_members where id = new_assignee_member_id and workspace_id = task_row.workspace_id and status = 'active'
    ) then raise exception 'Assignee is unavailable'; end if;
    event_metadata := jsonb_build_object('from', task_row.assignee_member_id, 'to', case when clear_assignee then null else new_assignee_member_id end);
    update public.task_occurrences set assignee_member_id = case when clear_assignee then null else new_assignee_member_id end, version = version + 1 where id = target_task_id;
    event_type := 'REASSIGNED';
  else
    raise exception 'Unsupported task mutation';
  end if;

  insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
  values (event_id, task_row.workspace_id, task_row.id, event_type, event_at, actor_member, event_metadata)
  on conflict (id) do nothing;
  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', expected_version + 1);
end;
$$;
revoke all on function public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,jsonb,uuid,boolean) from public;
grant execute on function public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,jsonb,uuid,boolean) to authenticated;

-- Replace target completion RPC with the same transactional health behavior.
drop function if exists public.apply_task_target_completion(uuid,uuid,integer,uuid,timestamptz);
create or replace function public.apply_task_target_completion(
  target_task_id uuid,
  target_entity_id uuid,
  expected_version integer,
  event_id uuid,
  event_at timestamptz,
  completion_effects jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  target_row public.task_targets%rowtype;
  actor_member uuid;
  remaining integer;
  snapshot_ids jsonb := '[]'::jsonb;
begin
  select * into task_row from public.task_occurrences where id = target_task_id for update;
  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then raise exception 'Task is unavailable'; end if;
  if exists (select 1 from public.task_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version);
  end if;
  if task_row.version <> expected_version or task_row.state <> 'scheduled' then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;
  select * into target_row from public.task_targets where task_id = target_task_id and entity_id = target_entity_id for update;
  if not found or target_row.completed_at is not null then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;
  select id into actor_member from public.workspace_members where workspace_id = task_row.workspace_id and user_id = auth.uid() and status = 'active' limit 1;

  update public.task_targets set completed_at = event_at, completed_by_member_id = actor_member where task_id = target_task_id and entity_id = target_entity_id;
  update public.task_occurrences set version = version + 1 where id = target_task_id;
  perform public.apply_v12_cleanliness_effects(task_row, event_at, actor_member, completion_effects);
  select coalesce(jsonb_agg(value->>'snapshotId'), '[]'::jsonb) into snapshot_ids from jsonb_array_elements(coalesce(completion_effects, '[]'::jsonb));
  insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
  values (event_id, task_row.workspace_id, target_task_id, 'TARGET_COMPLETED', event_at, actor_member,
    jsonb_build_object('entityId', target_entity_id, 'entityName', target_row.entity_name_snapshot, 'cleanlinessSnapshots', snapshot_ids));

  select count(*) into remaining from public.task_targets where task_id = target_task_id and completed_at is null;
  if remaining = 0 then
    update public.task_occurrences set state = 'completed', completed_at = event_at where id = target_task_id;
    insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
    values (gen_random_uuid(), task_row.workspace_id, target_task_id, 'COMPLETED', event_at, actor_member, jsonb_build_object('completedByTargets', true));
  end if;
  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', expected_version + 1);
end;
$$;
revoke all on function public.apply_task_target_completion(uuid,uuid,integer,uuid,timestamptz,jsonb) from public;
grant execute on function public.apply_task_target_completion(uuid,uuid,integer,uuid,timestamptz,jsonb) to authenticated;

-- Notifications follow the user's effective execution time, never the immutable cadence slot.
create or replace function public.schedule_notification_for_task(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  routine_row public.routines%rowtype;
  workspace_tz text;
  reminder_mode text;
  reminder_time time;
  delivery timestamptz;
  execution_due timestamptz;
begin
  select * into task_row from public.task_occurrences where id = target_task_id;
  if not found then return; end if;
  update public.notification_jobs set status = 'cancelled', locked_at = null where task_id = target_task_id and status in ('pending','processing','failed');
  if task_row.state <> 'scheduled' or task_row.assignee_member_id is null then return; end if;
  if exists (select 1 from public.task_targets where task_id = target_task_id)
     and not exists (select 1 from public.task_targets where task_id = target_task_id and completed_at is null) then return; end if;
  select * into routine_row from public.routines where id = task_row.routine_id;
  if not found or coalesce(routine_row.status, 'active') <> 'active' then return; end if;
  reminder_mode := coalesce(routine_row.reminder->>'mode', 'none');
  if reminder_mode = 'none' then return; end if;
  execution_due := coalesce(task_row.effective_due_at, task_row.due_at);
  if reminder_mode = 'at_due' then delivery := execution_due;
  elsif reminder_mode = 'offset' then delivery := execution_due - make_interval(mins => greatest(0, coalesce((routine_row.reminder->>'minutesBefore')::integer, 0)));
  elsif reminder_mode = 'previous_day' then
    workspace_tz := coalesce(routine_row.routine_timezone, (select timezone from public.workspaces where id = task_row.workspace_id));
    reminder_time := coalesce(nullif(routine_row.reminder->>'time', '')::time, (execution_due at time zone workspace_tz)::time);
    delivery := (((execution_due at time zone workspace_tz)::date - 1)::timestamp + reminder_time) at time zone workspace_tz;
  else return;
  end if;
  insert into public.notification_jobs(workspace_id, task_id, member_id, kind, deliver_at)
  values (task_row.workspace_id, task_row.id, task_row.assignee_member_id, reminder_mode, delivery);
end;
$$;
revoke all on function public.schedule_notification_for_task(uuid) from public;

create or replace function public.task_notification_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.effective_due_at is not distinct from old.effective_due_at
     and new.state is not distinct from old.state
     and new.assignee_member_id is not distinct from old.assignee_member_id
     and new.routine_id is not distinct from old.routine_id then return new; end if;
  perform public.schedule_notification_for_task(new.id);
  return new;
end;
$$;

drop trigger if exists task_notification_refresh on public.task_occurrences;
create trigger task_notification_refresh
after insert or update of effective_due_at, due_at, state, assignee_member_id, routine_id on public.task_occurrences
for each row execute function public.task_notification_refresh_trigger();

create or replace function public.routine_notification_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare task_id uuid;
begin
  if new.reminder is not distinct from old.reminder and new.status is not distinct from old.status then return new; end if;
  for task_id in select id from public.task_occurrences where routine_id = new.id and state = 'scheduled' loop
    perform public.schedule_notification_for_task(task_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists routine_notification_refresh on public.routines;
create trigger routine_notification_refresh
after update of reminder, status on public.routines
for each row execute function public.routine_notification_refresh_trigger();

comment on column public.routines.cleanliness_channel is 'v1.2 canonical cleanliness channel: regular or deep.';
comment on column public.routines.routine_timezone is 'Canonical IANA timezone used to resolve theoretical recurrence slots.';
comment on column public.routines.refresh_level_pct is 'Minimum cleanliness percentage this routine can restore on an effective completion.';
comment on column public.task_occurrences.scheduled_slot_at is 'Immutable theoretical cadence point; never changed by one-occurrence rescheduling.';
comment on column public.task_occurrences.effective_due_at is 'Mutable execution time shown in workflow and used for notifications.';
comment on table public.health_trajectories is 'Canonical v1.2 physical-maintenance state; occurrence counts are never a cleanliness input.';
comment on table public.completion_snapshots is 'Immutable audit of each evaluated cleanliness effect at completion time.';
