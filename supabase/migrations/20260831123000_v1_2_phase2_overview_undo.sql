-- House Care v1.2 Phase 2: exact occurrence-action undo.
-- No new tables are required. Overview preferences live in Supabase Auth user metadata.

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
    -- Only targets completed by this exact action are reopened; older partial
    -- target completions remain intact.
    update public.task_targets
      set completed_at = null, completed_by_member_id = null
      where task_id = target_task_id and completed_at = source_event.event_at;

    -- A completion may refresh several trajectories (including documented
    -- deep->regular carry-over). Remove only trajectories whose current anchor
    -- was created by this exact completion. Client normalization deterministically
    -- reconstructs the prior canonical trajectory after reload.
    delete from public.health_trajectories h
      where h.last_refresh_completion_id in (
        select c.id from public.completion_snapshots c
        where c.occurrence_id = target_task_id and c.completed_at = source_event.event_at
      );
    -- Keep completion_snapshots immutable for later Analysis/audit. The REOPENED
    -- event records that this exact completion transaction was undone.
    update public.task_occurrences set state = 'scheduled', completed_at = null, version = version + 1 where id = target_task_id;

  elsif source_event.event_type = 'SKIPPED' then
    update public.task_occurrences set state = 'scheduled', version = version + 1 where id = target_task_id;

  elsif source_event.event_type = 'POSTPONED' then
    prior_due := nullif(source_event.metadata->>'from','')::timestamptz;
    update public.task_occurrences
      set effective_due_at = coalesce(prior_due, scheduled_slot_at), version = version + 1
      where id = target_task_id;

  elsif source_event.event_type = 'REASSIGNED' then
    prior_assignee := nullif(source_event.metadata->>'from','')::uuid;
    update public.task_occurrences set assignee_member_id = prior_assignee, version = version + 1 where id = target_task_id;
  end if;

  -- Completion-relative routines materialize their successor as a derived effect of
  -- Complete/Skip. Undo must reverse that derived workflow row too, otherwise the
  -- reopened source and its successor would both remain actionable.
  if source_event.event_type in ('COMPLETED','SKIPPED') and exists (
    select 1 from public.routines r where r.id = task_row.routine_id and r.schedule_mode = 'after_completion'
  ) then
    for successor_id in
      select id from public.task_occurrences
      where routine_id = task_row.routine_id
        and id <> target_task_id
        and state = 'scheduled'
        and created_at >= source_event.event_at
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
