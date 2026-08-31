-- House Care v1.2.0 corrective: authoritative Restore-to-today semantics.
-- Safe to run after 20260831173000_v1_2_0_state_consistency.sql.
--
-- The prior function required the client-provided source event id to be exactly
-- the latest reversible event. A stale task row or equally-timed lifecycle
-- events could make Overview and PostgreSQL select different rows and report a
-- false cloud-version conflict. Restore-to-today is a durable recovery action,
-- so the server now locks the occurrence and derives the authoritative action
-- to reverse from current row + lifecycle state. The client source id is audit
-- context only and never a concurrency gate.

create or replace function public.reopen_task_to_today(
  target_task_id uuid,
  source_event_id uuid,
  event_id uuid,
  event_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.task_occurrences%rowtype;
  workflow_event public.task_events%rowtype;
  source_event public.task_events%rowtype;
  source_type text;
  source_at timestamptz;
  authoritative_source_id uuid;
  actor_member uuid;
  successor_id uuid;
  new_version integer;
begin
  select * into task_row
  from public.task_occurrences
  where id = target_task_id
  for update;

  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then
    raise exception 'Task is unavailable';
  end if;

  if exists (select 1 from public.task_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version);
  end if;

  select * into workflow_event
  from public.task_events e
  where e.task_id = target_task_id
    and e.event_type in ('COMPLETED', 'SKIPPED', 'POSTPONED', 'REOPENED')
  order by e.event_at desc, e.id desc
  limit 1;

  -- Lifecycle history is authoritative when present. This deliberately
  -- mirrors Overview's canonical task-state rule and fixes the stale-row case
  -- where task_occurrences still says scheduled after a committed Skip/Complete.
  if found and workflow_event.event_type in ('COMPLETED', 'SKIPPED', 'POSTPONED') then
    source_event := workflow_event;
    source_type := workflow_event.event_type;
    authoritative_source_id := workflow_event.id;
    source_at := workflow_event.event_at;
  elsif found and workflow_event.event_type = 'REOPENED' then
    -- It is already actionable; restoring it again would be a true conflict.
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  elsif task_row.state in ('completed', 'skipped') then
    -- Legacy terminal rows may have no lifecycle event at all. The locked row is
    -- sufficient evidence and the existing occurrence is still reused.
    source_type := upper(task_row.state);
    authoritative_source_id := null;
    source_at := coalesce(task_row.completed_at, task_row.effective_due_at, task_row.due_at, event_at);
  else
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;

  select id into actor_member
  from public.workspace_members
  where workspace_id = task_row.workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;

  if source_type = 'COMPLETED' then
    update public.task_targets
    set completed_at = null,
        completed_by_member_id = null
    where task_id = target_task_id;

    -- Completion snapshots remain immutable audit records; only the currently
    -- live health trajectory effect belonging to this occurrence is removed.
    delete from public.health_trajectories h
    where h.last_refresh_completion_id in (
      select c.id
      from public.completion_snapshots c
      where c.occurrence_id = target_task_id
    );
  end if;

  update public.task_occurrences
  set state = 'scheduled',
      completed_at = null,
      effective_due_at = event_at,
      due_at = event_at,
      version = version + 1
  where id = target_task_id
  returning version into new_version;

  if source_type in ('COMPLETED', 'SKIPPED') and exists (
    select 1 from public.routines r
    where r.id = task_row.routine_id
      and r.schedule_mode = 'after_completion'
  ) then
    for successor_id in
      select id
      from public.task_occurrences
      where routine_id = task_row.routine_id
        and id <> target_task_id
        and state = 'scheduled'
    loop
      update public.task_occurrences
      set state = 'cancelled', version = version + 1
      where id = successor_id;

      insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
      values (
        gen_random_uuid(), task_row.workspace_id, successor_id, 'CANCELLED', event_at, actor_member,
        jsonb_build_object('reason', 'restore_to_today_successor', 'restoreOf', authoritative_source_id)
      );
    end loop;
  end if;

  insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
  values (
    event_id, task_row.workspace_id, target_task_id, 'REOPENED', event_at, actor_member,
    jsonb_build_object(
      'restoreOf', authoritative_source_id,
      'requestedRestoreOf', source_event_id,
      'restoreType', source_type,
      'restoreSourceAt', source_at,
      'reason', 'restore_to_today'
    )
  );

  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', new_version);
end;
$$;

revoke all on function public.reopen_task_to_today(uuid,uuid,uuid,timestamptz) from public;
grant execute on function public.reopen_task_to_today(uuid,uuid,uuid,timestamptz) to authenticated;
