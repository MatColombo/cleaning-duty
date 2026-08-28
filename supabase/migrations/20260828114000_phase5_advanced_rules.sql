-- House Care — Phase 5 advanced targeting, assignment, explainability and partial targets

alter table public.workspace_members add column if not exists labels text[] not null default '{}';
alter table public.workspace_members add column if not exists unavailable_until timestamptz;

alter table public.routines add column if not exists advanced_target_selector jsonb;

alter table public.task_occurrences add column if not exists explanation_snapshot jsonb not null default '{}'::jsonb;
alter table public.task_targets add column if not exists match_reasons text[] not null default '{}';
alter table public.task_targets add column if not exists completed_at timestamptz;
alter table public.task_targets add column if not exists completed_by_member_id uuid references public.workspace_members(id) on delete set null;

-- Phase 5 adds a target-level audit event.
alter table public.task_events drop constraint if exists task_events_event_type_check;
alter table public.task_events add constraint task_events_event_type_check
  check (event_type in ('TASK_CREATED','ASSIGNED','POSTPONED','REASSIGNED','COMPLETED','SKIPPED','REOPENED','CANCELLED','NOTIFIED','NOTIFICATION_FAILED','TARGET_COMPLETED'));

create or replace function public.apply_task_target_completion(
  target_task_id uuid,
  target_entity_id uuid,
  expected_version integer,
  event_id uuid,
  event_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  target_row public.task_targets%rowtype;
  actor_member uuid;
  remaining integer;
begin
  select * into task_row from public.task_occurrences where id = target_task_id for update;
  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then
    raise exception 'Task is unavailable';
  end if;
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

  select id into actor_member from public.workspace_members
    where workspace_id = task_row.workspace_id and user_id = auth.uid() and status = 'active' limit 1;

  update public.task_targets
     set completed_at = event_at, completed_by_member_id = actor_member
   where task_id = target_task_id and entity_id = target_entity_id;

  update public.task_occurrences set version = version + 1 where id = target_task_id;

  insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
  values (event_id, task_row.workspace_id, target_task_id, 'TARGET_COMPLETED', event_at, actor_member,
    jsonb_build_object('entityId', target_entity_id, 'entityName', target_row.entity_name_snapshot));

  select count(*) into remaining from public.task_targets where task_id = target_task_id and completed_at is null;
  if remaining = 0 then
    update public.task_occurrences set state = 'completed' where id = target_task_id;
    insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
    values (gen_random_uuid(), task_row.workspace_id, target_task_id, 'COMPLETED', event_at, actor_member, jsonb_build_object('completedByTargets', true));
  end if;

  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', expected_version + 1);
end;
$$;
revoke all on function public.apply_task_target_completion(uuid,uuid,integer,uuid,timestamptz) from public;
grant execute on function public.apply_task_target_completion(uuid,uuid,integer,uuid,timestamptz) to authenticated;

-- Keep target completion state coherent when the whole task is completed directly.
create or replace function public.complete_task_targets_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_member uuid;
begin
  if new.state = 'completed' and old.state is distinct from 'completed' then
    select id into actor_member from public.workspace_members
      where workspace_id = new.workspace_id and user_id = auth.uid() and status = 'active' limit 1;
    update public.task_targets
       set completed_at = coalesce(completed_at, now()), completed_by_member_id = coalesce(completed_by_member_id, actor_member)
     where task_id = new.id and completed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists complete_task_targets on public.task_occurrences;
create trigger complete_task_targets
after update of state on public.task_occurrences
for each row execute function public.complete_task_targets_trigger();

comment on column public.routines.advanced_target_selector is 'Declarative Phase-5 target selector. No executable source code.';
comment on column public.task_occurrences.explanation_snapshot is 'Human-readable automation explanation captured at materialization time.';
