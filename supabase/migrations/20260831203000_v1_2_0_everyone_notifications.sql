-- House Care v1.2.0 r4: explicit assignment scope + household broadcast reminders.
-- Safe to run after 20260831193000_v1_2_0_restore_and_overview_ux.sql.
--
-- Semantics:
--   member     -> one specific member; reminder goes to that member's enabled devices
--   everyone   -> household broadcast; reminder goes to every active account member's enabled devices
--   unassigned -> no specific assignee; no reminder job is created

alter table public.task_occurrences
  add column if not exists assignment_scope text not null default 'unassigned';

alter table public.task_occurrences drop constraint if exists task_occurrences_assignment_scope_check;
alter table public.task_occurrences add constraint task_occurrences_assignment_scope_check
  check (assignment_scope in ('member', 'everyone', 'unassigned'));

-- Backfill legacy rows deterministically. A concrete assignee wins. Otherwise a
-- routine explicitly configured as everyone is broadcast; all other null rows
-- remain unassigned.
update public.task_occurrences t
set assignment_scope = case
  when t.assignee_member_id is not null then 'member'
  when coalesce(r.assignment->>'mode', '') = 'everyone' then 'everyone'
  else 'unassigned'
end
from public.routines r
where r.id = t.routine_id;

-- Runtime mutation now carries the explicit assignment scope so null assignee
-- is never ambiguous.
drop function if exists public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,jsonb,uuid,boolean);
create or replace function public.apply_task_mutation(
  target_task_id uuid,
  expected_version integer,
  mutation_kind text,
  event_id uuid,
  event_at timestamptz,
  new_effective_due_at timestamptz default null,
  completion_effects jsonb default '[]'::jsonb,
  new_assignee_member_id uuid default null,
  clear_assignee boolean default false,
  new_assignment_scope text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  actor_member uuid;
  event_type text;
  event_metadata jsonb := '{}'::jsonb;
  snapshot_ids jsonb := '[]'::jsonb;
  next_scope text;
  next_assignee uuid;
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
    update public.task_occurrences set state = 'skipped', completed_at = null, version = version + 1 where id = target_task_id;
    event_type := 'SKIPPED';
  elsif mutation_kind = 'postpone' then
    if new_effective_due_at is null then raise exception 'new_effective_due_at is required'; end if;
    event_metadata := jsonb_build_object('from', task_row.effective_due_at, 'to', new_effective_due_at, 'scheduledSlotAt', task_row.scheduled_slot_at);
    update public.task_occurrences set effective_due_at = new_effective_due_at, due_at = new_effective_due_at, version = version + 1 where id = target_task_id;
    event_type := 'POSTPONED';
  elsif mutation_kind = 'reassign' then
    next_scope := coalesce(
      nullif(new_assignment_scope, ''),
      case when clear_assignee then 'unassigned' when new_assignee_member_id is not null then 'member' else 'unassigned' end
    );
    if next_scope not in ('member', 'everyone', 'unassigned') then raise exception 'Invalid assignment scope'; end if;

    if next_scope = 'member' then
      if new_assignee_member_id is null or not exists (
        select 1 from public.workspace_members
        where id = new_assignee_member_id and workspace_id = task_row.workspace_id and status = 'active'
      ) then raise exception 'Assignee is unavailable'; end if;
      next_assignee := new_assignee_member_id;
    else
      next_assignee := null;
    end if;

    event_metadata := jsonb_build_object(
      'from', task_row.assignee_member_id,
      'to', next_assignee,
      'fromScope', coalesce(task_row.assignment_scope, case when task_row.assignee_member_id is null then 'unassigned' else 'member' end),
      'toScope', next_scope
    );
    update public.task_occurrences
      set assignee_member_id = next_assignee,
          assignment_scope = next_scope,
          version = version + 1
      where id = target_task_id;
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
revoke all on function public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,jsonb,uuid,boolean,text) from public;
grant execute on function public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,jsonb,uuid,boolean,text) to authenticated;

-- Preserve scope when undoing a one-occurrence reassignment.
create or replace function public.undo_task_mutation(
  target_task_id uuid,
  expected_version integer,
  source_event_id uuid,
  event_id uuid,
  event_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  source_event public.task_events%rowtype;
  actor_member uuid;
  prior_due timestamptz;
  prior_assignee uuid;
  prior_scope text;
  successor_id uuid;
begin
  select * into task_row from public.task_occurrences where id = target_task_id for update;
  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then raise exception 'Task is unavailable'; end if;
  if exists (select 1 from public.task_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version);
  end if;
  if task_row.version <> expected_version then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;

  select * into source_event from public.task_events where id = source_event_id and task_id = target_task_id;
  if not found or source_event.event_type not in ('COMPLETED','SKIPPED','POSTPONED','REASSIGNED') then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;
  if exists (
    select 1 from public.task_events e
    where e.task_id = target_task_id
      and e.event_at > source_event.event_at
      and e.event_type in ('COMPLETED','SKIPPED','POSTPONED','REASSIGNED','TARGET_COMPLETED','REOPENED')
  ) then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;

  select id into actor_member from public.workspace_members where workspace_id = task_row.workspace_id and user_id = auth.uid() and status = 'active' limit 1;

  if source_event.event_type = 'COMPLETED' then
    update public.task_targets set completed_at = null, completed_by_member_id = null
      where task_id = target_task_id and completed_at = source_event.event_at;
    delete from public.health_trajectories h
      where h.last_refresh_completion_id in (
        select c.id from public.completion_snapshots c
        where c.occurrence_id = target_task_id and c.completed_at = source_event.event_at
      );
    update public.task_occurrences set state = 'scheduled', completed_at = null, version = version + 1 where id = target_task_id;
  elsif source_event.event_type = 'SKIPPED' then
    update public.task_occurrences set state = 'scheduled', completed_at = null, version = version + 1 where id = target_task_id;
  elsif source_event.event_type = 'POSTPONED' then
    prior_due := nullif(source_event.metadata->>'from','')::timestamptz;
    update public.task_occurrences set effective_due_at = coalesce(prior_due, scheduled_slot_at), due_at = coalesce(prior_due, scheduled_slot_at), version = version + 1 where id = target_task_id;
  elsif source_event.event_type = 'REASSIGNED' then
    prior_assignee := nullif(source_event.metadata->>'from','')::uuid;
    prior_scope := coalesce(nullif(source_event.metadata->>'fromScope',''), case when prior_assignee is null then 'unassigned' else 'member' end);
    update public.task_occurrences set assignee_member_id = case when prior_scope = 'member' then prior_assignee else null end, assignment_scope = prior_scope, version = version + 1 where id = target_task_id;
  end if;

  if source_event.event_type in ('COMPLETED','SKIPPED') and exists (
    select 1 from public.routines r where r.id = task_row.routine_id and r.schedule_mode = 'after_completion'
  ) then
    for successor_id in
      select id from public.task_occurrences
      where routine_id = task_row.routine_id and id <> target_task_id and state = 'scheduled' and created_at >= source_event.event_at
    loop
      update public.task_occurrences set state = 'cancelled', version = version + 1 where id = successor_id;
      insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
      values (gen_random_uuid(), task_row.workspace_id, successor_id, 'CANCELLED', event_at, actor_member,
              jsonb_build_object('reason', 'undo_after_completion_successor', 'undoOf', source_event_id));
    end loop;
  end if;

  insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
  values (event_id, task_row.workspace_id, target_task_id, 'REOPENED', event_at, actor_member,
          jsonb_build_object('undoOf', source_event_id, 'undoType', source_event.event_type));

  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', expected_version + 1);
end;
$$;
revoke all on function public.undo_task_mutation(uuid,integer,uuid,uuid,timestamptz) from public;
grant execute on function public.undo_task_mutation(uuid,integer,uuid,uuid,timestamptz) to authenticated;

-- One job is created per recipient. Everyone broadcasts to every active
-- household account member. Unassigned intentionally creates no job.
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
  recipient_id uuid;
begin
  select * into task_row from public.task_occurrences where id = target_task_id;
  if not found then return; end if;

  update public.notification_jobs
    set status = 'cancelled', locked_at = null
    where task_id = target_task_id and status in ('pending','processing','failed');

  if task_row.state <> 'scheduled' then return; end if;
  if exists (select 1 from public.task_targets where task_id = target_task_id)
     and not exists (select 1 from public.task_targets where task_id = target_task_id and completed_at is null) then return; end if;

  select * into routine_row from public.routines where id = task_row.routine_id;
  if not found or coalesce(routine_row.status, 'active') <> 'active' then return; end if;
  reminder_mode := coalesce(routine_row.reminder->>'mode', 'none');
  if reminder_mode = 'none' then return; end if;

  execution_due := coalesce(task_row.effective_due_at, task_row.due_at);
  if reminder_mode = 'at_due' then
    delivery := execution_due;
  elsif reminder_mode = 'offset' then
    delivery := execution_due - make_interval(mins => greatest(0, coalesce((routine_row.reminder->>'minutesBefore')::integer, 0)));
  elsif reminder_mode = 'previous_day' then
    workspace_tz := coalesce(routine_row.routine_timezone, (select timezone from public.workspaces where id = task_row.workspace_id));
    reminder_time := coalesce(nullif(routine_row.reminder->>'time', '')::time, (execution_due at time zone workspace_tz)::time);
    delivery := (((execution_due at time zone workspace_tz)::date - 1)::timestamp + reminder_time) at time zone workspace_tz;
  else
    return;
  end if;

  if coalesce(task_row.assignment_scope, case when task_row.assignee_member_id is null then 'unassigned' else 'member' end) = 'member' then
    if task_row.assignee_member_id is null then return; end if;
    if not exists (
      select 1 from public.workspace_members
      where id = task_row.assignee_member_id and workspace_id = task_row.workspace_id and status = 'active'
    ) then return; end if;
    insert into public.notification_jobs(workspace_id, task_id, member_id, kind, deliver_at)
    values (task_row.workspace_id, task_row.id, task_row.assignee_member_id, reminder_mode, delivery);
  elsif task_row.assignment_scope = 'everyone' then
    for recipient_id in
      select id from public.workspace_members
      where workspace_id = task_row.workspace_id and status = 'active' and user_id is not null
      order by created_at, id
    loop
      insert into public.notification_jobs(workspace_id, task_id, member_id, kind, deliver_at)
      values (task_row.workspace_id, task_row.id, recipient_id, reminder_mode, delivery);
    end loop;
  end if;
end;
$$;
revoke all on function public.schedule_notification_for_task(uuid) from public;

create or replace function public.task_notification_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.effective_due_at is not distinct from old.effective_due_at
     and new.due_at is not distinct from old.due_at
     and new.state is not distinct from old.state
     and new.assignee_member_id is not distinct from old.assignee_member_id
     and new.assignment_scope is not distinct from old.assignment_scope
     and new.routine_id is not distinct from old.routine_id then return new; end if;
  perform public.schedule_notification_for_task(new.id);
  return new;
end;
$$;

drop trigger if exists task_notification_refresh on public.task_occurrences;
create trigger task_notification_refresh
after insert or update of effective_due_at, due_at, state, assignee_member_id, assignment_scope, routine_id on public.task_occurrences
for each row execute function public.task_notification_refresh_trigger();
