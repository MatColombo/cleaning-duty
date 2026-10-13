-- Phase 16C: OPTIONAL / ADDITIVE / UNAPPLIED. Do not run against production
-- without operator approval. Requires Phase 16A and Phase 16B migrations.
-- 16C is opt-in per household; V1 RPC signatures are not altered.
begin;

create table if not exists public.v2_recurrence_households (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid not null references auth.users(id)
);
alter table public.v2_recurrence_households enable row level security;
create policy "v2_recurrence_member_read" on public.v2_recurrence_households
  for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.v2_recurrence_households from anon, authenticated;
grant select on public.v2_recurrence_households to authenticated;

alter table public.task_occurrences add column if not exists successor_of_event_id uuid;
create unique index if not exists v2_recurrence_one_successor_per_event
  on public.task_occurrences(successor_of_event_id) where successor_of_event_id is not null;
create index if not exists v2_recurrence_future_cursor
  on public.task_occurrences(routine_id,routine_revision,scheduled_slot_at)
  where state='scheduled';

-- A V1 task RPC continues to work on non-enrolled households. On enrolled
-- households, V1 cannot mutate after-completion rows: it is not atomic with
-- the successor insert. V2 sets the transaction-local marker in its RPC.
create or replace function public.v2_guard_recurrence_legacy_task()
returns trigger language plpgsql security definer set search_path=public as $$
declare w uuid; r uuid;
begin
  w := case when tg_op='DELETE' then old.workspace_id else new.workspace_id end;
  r := case when tg_op='DELETE' then old.routine_id else new.routine_id end;
  if exists(select 1 from public.v2_recurrence_households where workspace_id=w)
    and current_setting('house_care.v2_recurrence_workspace',true) is distinct from w::text
    and exists(select 1 from public.routines where id=r and schedule_mode='after_completion') then
      -- A normal routine edit can retire superseded scheduled rows via 16A CAS.
      -- The old revision must already be inactive; only state/version change.
      if tg_op='UPDATE' and old.state='scheduled' and new.state='cancelled'
        and new.version=old.version+1 and
          (to_jsonb(new)-'state'-'version')=(to_jsonb(old)-'state'-'version')
        and not exists(select 1 from public.routines where id=r
          and status='active' and archived_at is null and revision=old.routine_revision) then
        return new;
      end if;
      -- Resume may re-enable an untouched future row retired explicitly by
      -- Pause. No arbitrary V1 lifecycle transition is allowed here.
      if tg_op='UPDATE' and old.state='cancelled' and new.state='scheduled'
        and new.version=old.version+1
        and (to_jsonb(new)-'state'-'version')=(to_jsonb(old)-'state'-'version')
        and exists(select 1 from public.routines where id=r
          and status='active' and archived_at is null and revision=old.routine_revision)
        and exists(select 1 from public.task_events e where e.task_id=old.id
          and e.event_type='CANCELLED' and e.metadata->>'reason'='routine_paused') then
        return new;
      end if;
      raise exception 'V2 atomic recurrence: use versioned V2 task RPC' using errcode='42501';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists v2_guard_recurrence_legacy_task on public.task_occurrences;
create trigger v2_guard_recurrence_legacy_task before update or delete on public.task_occurrences
  for each row execute function public.v2_guard_recurrence_legacy_task();

create or replace function public.v2_activate_recurrence_household(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.workspaces
    where id=p_workspace_id and owner_user_id=auth.uid()) then
    raise exception 'Only owner can activate 16C' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text,0));
  -- Client outboxes cannot be inspected from SQL. Operator must first
  -- stop V1 household edits, migrate all clients, and drain pending writes.
  insert into public.v2_recurrence_households(workspace_id,enrolled_by)
    values(p_workspace_id,auth.uid()) on conflict do nothing;
  return jsonb_build_object('activated',true);
end $$;
revoke all on function public.v2_activate_recurrence_household(uuid) from public, anon;
grant execute on function public.v2_activate_recurrence_household(uuid) to authenticated;

-- Targeted idempotent generated-task insert, not a generic user-edit endpoint.
-- Task/event identity is deterministic on the client and duplicate attempts
-- never rewrite terminal rows or their history. Pure generated batches only;
-- ordinary configuration changes still go through 16A CAS.
create or replace function public.v2_commit_generated_occurrences(
  p_workspace_id uuid, p_mutation_id uuid, p_changes jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c jsonb; row_data jsonb; r public.routines%rowtype;
  tid uuid; task_id uuid; generated_ids uuid[]:=array[]::uuid[]; total integer:=0; inserted integer:=0; routine_id uuid;
  at_slot timestamptz;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Household unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.v2_recurrence_households where workspace_id=p_workspace_id) then
    raise exception '16C capability required before idempotent materialization' using errcode='42501'; end if;
  if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>60
    or octet_length(p_changes::text)>75000 then raise exception 'Oversized materialization batch'; end if;
  perform set_config('house_care.v2_recurrence_workspace',p_workspace_id::text,true);
  for c in select value from jsonb_array_elements(p_changes) loop
    if c->'before'<>'null'::jsonb or c->'after' is null or c->'after'='null'::jsonb
      or c->>'table' not in ('task_occurrences','task_targets','task_events') then
      raise exception 'Not a pure generated task batch' using errcode='22023'; end if;
  end loop;
  -- Lock the routine once for each task before issuing its targets/events.
  for c in select value from jsonb_array_elements(p_changes)
    where value->>'table'='task_occurrences' loop
    row_data:=c->'after';
    total:=total+1;
    if total>10 then raise exception 'Too many generated occurrences'; end if;
    task_id:=(row_data->>'id')::uuid;
    routine_id:=(row_data->>'routine_id')::uuid;
    at_slot:=(row_data->>'scheduled_slot_at')::timestamptz;
    perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':'||routine_id::text,0));
    select * into r from public.routines where id=routine_id and workspace_id=p_workspace_id;
    if not found or r.revision<>(row_data->>'routine_revision')::integer
      or r.parent_routine_id is not null or r.status<>'active' or r.archived_at is not null
      or (r.schedule_mode='after_completion' and exists(select 1 from public.task_occurrences
          where routine_id=r.id and state in ('completed','skipped'))) then
      return jsonb_build_object('applied',false,'conflict',true,'message','Routine changed during materialization'); end if;
    generated_ids:=array_append(generated_ids,task_id);
    if (at_slot<now()-interval '2 days' and r.schedule_mode<>'after_completion')
      or at_slot>now()+interval '500 years'
      or row_data->>'state'<>'scheduled' or (row_data->>'version')::integer<>1
      or row_data->>'successor_of_event_id' is not null then
      raise exception 'Untrusted generated task slot' using errcode='22023'; end if;
    if exists(select 1 from public.task_occurrences t where t.routine_id=r.id
      and t.routine_revision=r.revision and t.scheduled_slot_at=at_slot and t.id<>task_id) then
      return jsonb_build_object('applied',false,'conflict',true,'message','Canonical task identity mismatch'); end if;
    insert into public.task_occurrences(id,workspace_id,routine_id,routine_revision,trigger_ordinal,
      parent_occurrence_id,routine_name_snapshot,action_name_snapshot,cleanliness_channel,care_level,
      scheduled_slot_at,effective_due_at,original_due_at,due_at,completed_at,state,
      assignment_scope,assignee_member_id,supplies_snapshot,explanation_snapshot,version,created_at)
    values(task_id,p_workspace_id,routine_id,r.revision,(row_data->>'trigger_ordinal')::integer,
      null,row_data->>'routine_name_snapshot',row_data->>'action_name_snapshot',
      row_data->>'cleanliness_channel',row_data->>'care_level',at_slot,
      (row_data->>'effective_due_at')::timestamptz,at_slot,
      (row_data->>'due_at')::timestamptz,null,'scheduled',row_data->>'assignment_scope',
      nullif(row_data->>'assignee_member_id','')::uuid,coalesce(row_data->'supplies_snapshot','[]'::jsonb),
      coalesce(row_data->'explanation_snapshot','{}'::jsonb),1,
      (row_data->>'created_at')::timestamptz)
    on conflict do nothing;
    if found then inserted:=inserted+1; end if;
  end loop;
  if total=0 then raise exception 'No generated tasks supplied'; end if;
  for c in select value from jsonb_array_elements(p_changes)
    where value->>'table'='task_targets' loop
    row_data:=c->'after';tid:=(row_data->>'task_id')::uuid;
    if not tid=any(generated_ids) or not exists(select 1 from public.task_occurrences
      where id=tid and workspace_id=p_workspace_id) then
      raise exception 'Target must belong to this generated batch'; end if;
    insert into public.task_targets(workspace_id,task_id,entity_id,entity_name_snapshot,
      entity_type_name_snapshot,match_reasons)
    values(p_workspace_id,tid,(row_data->>'entity_id')::uuid,
      row_data->>'entity_name_snapshot',row_data->>'entity_type_name_snapshot',
      coalesce(row_data->'match_reasons','[]'::jsonb)) on conflict do nothing;
  end loop;
  for c in select value from jsonb_array_elements(p_changes)
    where value->>'table'='task_events' loop
    row_data:=c->'after';tid:=(row_data->>'task_id')::uuid;
    if row_data->>'event_type' not in ('TASK_CREATED','ASSIGNED')
      or not tid=any(generated_ids) or not exists(select 1 from public.task_occurrences
        where id=tid and workspace_id=p_workspace_id) then
      raise exception 'Invalid generated audit event'; end if;
    insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
    values((row_data->>'id')::uuid,p_workspace_id,tid,row_data->>'event_type',
      (row_data->>'event_at')::timestamptz,nullif(row_data->>'actor_member_id','')::uuid,
      coalesce(row_data->'metadata','{}'::jsonb)) on conflict do nothing;
  end loop;
  return jsonb_build_object('applied',true,'conflict',false,'inserted',inserted,'attempted',total);
end $$;
revoke all on function public.v2_commit_generated_occurrences(uuid,uuid,jsonb) from public,anon;
grant execute on function public.v2_commit_generated_occurrences(uuid,uuid,jsonb) to authenticated;

-- The result must be a single all-or-nothing transaction. A stale routine,
-- successor, version or target returns conflict and *no* lifecycle changes.
create or replace function public.v2_apply_after_completion(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare task public.task_occurrences%rowtype; routine public.routines%rowtype;
  workspace public.workspaces%rowtype; successor jsonb; result jsonb;
  actor_member uuid; event_id uuid; source_id uuid; successor_id uuid;
  terminal_id uuid; target_id uuid; kind text; at_event timestamptz;
  expected integer; tz text; units text; n integer; base_at timestamptz;
  expected_due timestamptz; given_due timestamptz; local_base timestamp;
  row_target jsonb; row_event jsonb; is_final boolean; old_successor record;
  has_integrated boolean; safe_successor_ids uuid[] := array[]::uuid[];
  target_name text; snapshot_ids jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or jsonb_typeof(p_payload)<>'object'
    or octet_length(p_payload::text)>65000 then raise exception 'Invalid recurrence action'; end if;
  event_id:=(p_payload->>'eventId')::uuid;
  at_event:=(p_payload->>'eventAt')::timestamptz;
  kind:=p_payload->>'kind';
  expected:=(p_payload->>'expectedVersion')::integer;
  select * into task from public.task_occurrences where id=(p_payload->>'taskId')::uuid;
  if not found or not public.is_workspace_member(task.workspace_id) then
    raise exception 'Task unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(task.workspace_id::text||':'||task.routine_id::text,0));
  select * into task from public.task_occurrences where id=task.id for update;
  select * into routine from public.routines where id=task.routine_id;
  select * into workspace from public.workspaces where id=task.workspace_id;
  if routine.schedule_mode<>'after_completion' or routine.parent_routine_id is not null
    or not exists(select 1 from public.v2_recurrence_households where workspace_id=task.workspace_id) then
    raise exception 'Atomic After Completion capability required' using errcode='42501'; end if;
  select id into actor_member from public.workspace_members where workspace_id=task.workspace_id
    and user_id=auth.uid() and status='active' limit 1;
  if actor_member is null then raise exception 'Active member required' using errcode='42501'; end if;
  -- Replay only a truly committed identical event; never generate a second successor.
  if exists(select 1 from public.task_events where id=event_id and task_id=task.id) then
    return jsonb_build_object('applied',true,'conflict',false,'actualVersion',task.version); end if;
  if task.version<>expected then
    return jsonb_build_object('applied',false,'conflict',true,'actualVersion',task.version); end if;
  if kind not in ('complete','skip','complete_target','undo','reopen_today','postpone','reassign','extra_postpone') then
    raise exception 'Unsupported After Completion mutation'; end if;
  perform set_config('house_care.v2_recurrence_workspace',task.workspace_id::text,true);
  -- Nonterminal actions still require the 16C transaction marker, otherwise
  -- the V1 task trigger correctly rejects them on an activated household.
  has_integrated:=coalesce((p_payload->>'integrated')::boolean,false);
  if kind in ('postpone','reassign','extra_postpone') or
    (kind='undo' and exists(select 1 from public.v2_extra_care_events e
      where e.id=nullif(p_payload->>'sourceEventId','')::uuid
        and e.parent_occurrence_id=task.id and e.event_type='POSTPONED')) then
    if has_integrated then
      return public.v2_apply_integrated_care(task.id,expected,kind,event_id,at_event,
        nullif(p_payload->>'extraRoutineId','')::uuid,
        nullif(p_payload->>'sourceEventId','')::uuid,
        nullif(p_payload->>'effectiveDueAt','')::timestamptz,
        nullif(p_payload->>'assigneeMemberId','')::uuid,
        nullif(p_payload->>'assignmentScope',''),
        coalesce((p_payload->>'clearAssignee')::boolean,false),
        '[]'::jsonb,'[]'::jsonb);
    elsif kind in ('postpone','reassign') then
      return public.apply_task_mutation(task.id,expected,kind,event_id,at_event,
        nullif(p_payload->>'effectiveDueAt','')::timestamptz,
        '[]'::jsonb,nullif(p_payload->>'assigneeMemberId','')::uuid,
        coalesce((p_payload->>'clearAssignee')::boolean,false),
        nullif(p_payload->>'assignmentScope',''));
    else
      raise exception 'Extra Care postponement requires Phase 16B';
    end if;
  end if;
  if kind in ('undo','reopen_today') then
    if kind='undo' then
      select id into source_id from public.task_events
      where id=(p_payload->>'sourceEventId')::uuid and task_id=task.id
        and event_type in ('COMPLETED','SKIPPED','POSTPONED','REASSIGNED');
    else
      select id into source_id from public.task_events
      where task_id=task.id and event_type in ('COMPLETED','SKIPPED','POSTPONED')
      order by event_at desc,id desc limit 1;
    end if;
    if source_id is null then
      return jsonb_build_object('applied',false,'conflict',true,'message','Source event missing'); end if;
    -- Only the known clean successor may be cancelled. Never delete history.
    for old_successor in select * from public.task_occurrences
      where routine_id=task.routine_id and routine_revision=task.routine_revision
        and id<>task.id and (successor_of_event_id=source_id or state='scheduled') for update loop
      if old_successor.state<>'scheduled' or old_successor.version<>1
        or old_successor.successor_of_event_id is distinct from source_id
        or exists(select 1 from public.task_events e where e.task_id=old_successor.id
            and e.event_type not in ('TASK_CREATED','ASSIGNED')) then
        return jsonb_build_object('applied',false,'conflict',true,'message','Successor has edits, history or unknown provenance'); end if;
      safe_successor_ids:=array_append(safe_successor_ids,old_successor.id);
    end loop;
  end if;
  successor:=p_payload->'afterCompletionSuccessor';
  if kind='complete_target' then
    if task.state<>'scheduled' then
      return jsonb_build_object('applied',false,'conflict',true,'message','Task is not scheduled'); end if;
    target_id:=(p_payload->>'targetEntityId')::uuid;
    select count(*)=1 into is_final from public.task_targets
      where task_id=task.id and completed_at is null;
    select entity_name_snapshot into target_name from public.task_targets
      where task_id=task.id and entity_id=target_id and completed_at is null;
    if not found then
      return jsonb_build_object('applied',false,'conflict',true,'message','Target already completed'); end if;
  else is_final:=kind in ('complete','skip'); end if;

  if is_final and kind in ('complete','skip','complete_target') and routine.revision<>task.routine_revision then
    return jsonb_build_object('applied',false,'conflict',true,'message','Routine revision changed'); end if;
  if is_final and kind in ('complete','skip','complete_target') and routine.status='active'
      and routine.archived_at is null then
    if successor is null or successor='null'::jsonb or jsonb_typeof(successor)<>'object' then
      return jsonb_build_object('applied',false,'conflict',true,'message','Atomic successor required'); end if;
    units:=case when routine.recurrence->>'kind'='daily' then 'day'
      else routine.recurrence->>'unit' end;
    n:=greatest(1,(routine.recurrence->>'interval')::integer);
    if units not in ('hour','day','week','month') then raise exception 'Unsupported After Completion interval'; end if;
    tz:=coalesce(nullif(routine.routine_timezone,''),workspace.timezone);
    base_at:=case when kind='skip' then task.scheduled_slot_at else at_event end;
    local_base:=base_at at time zone tz;
    expected_due:=case
      when units='hour' then base_at + make_interval(hours=>n)
      when units='day' then ((local_base::date+n) + local_base::time(0)) at time zone tz
      when units='week' then ((local_base::date+7*n) + local_base::time(0)) at time zone tz
      else ((local_base::date+make_interval(months=>n))::date + routine.time_of_day::time) at time zone tz end;
    given_due:=(successor->>'scheduledSlotAt')::timestamptz;
    terminal_id:=case when kind='complete_target' then
      (successor->>'successorOfEventId')::uuid else event_id end;
    if abs(extract(epoch from (given_due-expected_due)))>60
      or successor->>'successorOfEventId'<>terminal_id::text
      or (successor->>'routineId')::uuid<>routine.id
      or (successor->>'routineRevision')::integer<>routine.revision
      or (successor->>'workspaceId')::uuid<>task.workspace_id
      or successor->>'state'<>'scheduled' or jsonb_array_length(successor->'targets')>128
      or octet_length(successor::text)>25000 then
      return jsonb_build_object('applied',false,'conflict',true,'message','Invalid canonical successor'); end if;
    successor_id:=(successor->>'id')::uuid;
    -- The current task is still scheduled before its terminal mutation.
    -- It must not count as a *different* pending successor.
    if exists(select 1 from public.task_occurrences where routine_id=routine.id
      and routine_revision=routine.revision and state='scheduled' and id<>task.id) then
      return jsonb_build_object('applied',false,'conflict',true,'message','Another pending occurrence already exists'); end if;
  else successor:=null; end if;

  if kind='complete_target' then
    update public.task_targets set completed_at=at_event,completed_by_member_id=actor_member
      where task_id=task.id and entity_id=target_id;
    update public.task_occurrences set version=version+1 where id=task.id;
    select coalesce(jsonb_agg(value->>'snapshotId'), '[]'::jsonb) into snapshot_ids
      from jsonb_array_elements(coalesce(p_payload->'completionEffects','[]'::jsonb));
    insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
    values(event_id,task.workspace_id,task.id,'TARGET_COMPLETED',at_event,actor_member,
      jsonb_build_object('entityId',target_id,'entityName',target_name,
        'cleanlinessSnapshots',snapshot_ids));
    if is_final then
      update public.task_occurrences set state='completed',completed_at=at_event where id=task.id;
      insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
        values(terminal_id,task.workspace_id,task.id,'COMPLETED',at_event,actor_member,
          jsonb_build_object('completedByTargets',true,'targetEventId',event_id));
    end if;
    -- V1 target RPC remains untouched. Its historical health behavior is
    -- unchanged for non-enrolled households. V2 uses supplied bounded effects.
    if p_payload->'completionEffects' is not null then
      perform public.apply_v12_cleanliness_effects(task,at_event,actor_member,p_payload->'completionEffects');
    end if;
    result:=jsonb_build_object('applied',true,'conflict',false,'actualVersion',expected+1);
  elsif has_integrated then
    -- 16B atomic parent + Extra Care RPC, under the same routine lock.
    result:=public.v2_apply_integrated_care(task.id,expected,kind,event_id,at_event,
      null,nullif(p_payload->>'sourceEventId','')::uuid,null,null,null,false,
      coalesce(p_payload->'completionEffects','[]'::jsonb),
      coalesce(p_payload->'extraCompletions','[]'::jsonb));
  elsif kind='complete' or kind='skip' then
    result:=public.apply_task_mutation(task.id,expected,kind,event_id,at_event,null,
      coalesce(p_payload->'completionEffects','[]'::jsonb),null,false,null);
  elsif kind='undo' then
    result:=public.undo_task_mutation(task.id,expected,
      nullif(p_payload->>'sourceEventId','')::uuid,event_id,at_event);
  else
    result:=public.reopen_task_to_today(task.id,
      nullif(p_payload->>'sourceEventId','')::uuid,event_id,at_event);
  end if;
  if not coalesce((result->>'applied')::boolean,false) then return result; end if;
  -- Historical V1/16B Undo helpers can select by creation timestamp. Reconcile
  -- any server-verified provenance-linked survivor without touching edited or
  -- unrelated successors. The enclosing transaction keeps parent and child
  -- state changes atomic; the parent event ID prevents duplicate replay.
  for old_successor in select * from public.task_occurrences where id=any(safe_successor_ids)
      and state='scheduled' for update loop
    update public.task_occurrences set state='cancelled',version=version+1
      where id=old_successor.id;
    insert into public.task_events(workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
      values(task.workspace_id,old_successor.id,'CANCELLED',at_event,actor_member,
        jsonb_build_object('reason',case when kind='undo' then 'undo_after_completion_successor'
          else 'restore_to_today_successor' end,'undoOf',source_id));
  end loop;
  if successor is not null then
    -- The natural-key constraint and source-event unique index serialize
    -- duplicates across devices, while the enclosing transaction rolls back
    -- the completion if successor insertion cannot be committed.
    insert into public.task_occurrences(id,workspace_id,routine_id,routine_revision,
      trigger_ordinal,successor_of_event_id,routine_name_snapshot,action_name_snapshot,
      cleanliness_channel,care_level,scheduled_slot_at,effective_due_at,original_due_at,
      due_at,state,assignment_scope,assignee_member_id,supplies_snapshot,
      explanation_snapshot,version,created_at)
    values(successor_id,task.workspace_id,routine.id,routine.revision,
      (successor->>'triggerOrdinal')::integer,terminal_id,successor->>'routineNameSnapshot',
      successor->>'actionNameSnapshot',successor->>'cleanlinessChannel',successor->>'careLevel',
      given_due,given_due,given_due,given_due,'scheduled',successor->>'assignmentScope',
      nullif(successor->>'assigneeMemberId','')::uuid,coalesce(successor->'supplies','[]'::jsonb),
      coalesce(successor->'explanation','{}'::jsonb),1,
      coalesce((successor->>'createdAt')::timestamptz,now()));
    for row_target in select value from jsonb_array_elements(successor->'targets') loop
      insert into public.task_targets(workspace_id,task_id,entity_id,entity_name_snapshot,
        entity_type_name_snapshot,match_reasons)
      values(task.workspace_id,successor_id,(row_target->>'entityId')::uuid,
        row_target->>'entityName',row_target->>'entityTypeName',
        coalesce(row_target->'matchReasons','[]'::jsonb));
    end loop;
    -- Reproduce the exact optimistic creation/assignment audit records on the
    -- server. Their IDs are stable across two devices and offline retry.
    if jsonb_typeof(p_payload->'afterCompletionEvents')<>'array'
      or jsonb_array_length(p_payload->'afterCompletionEvents') not between 1 and 2 then
      raise exception 'Canonical successor audit events required'; end if;
    if not exists(select 1 from jsonb_array_elements(p_payload->'afterCompletionEvents') x
        where x->>'type'='TASK_CREATED') then
      raise exception 'Missing successor creation event'; end if;
    for row_event in select value from jsonb_array_elements(p_payload->'afterCompletionEvents') loop
      if row_event->>'type' not in ('TASK_CREATED','ASSIGNED')
        or (row_event->>'taskId')::uuid<>successor_id
        or (row_event->>'workspaceId')::uuid<>task.workspace_id then
        raise exception 'Invalid generated audit event'; end if;
      insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
        values((row_event->>'id')::uuid,task.workspace_id,successor_id,
          row_event->>'type',(row_event->>'at')::timestamptz,actor_member,
          coalesce(row_event->'metadata','{}'::jsonb));
    end loop;
  end if;
  return result;
end $$;
revoke all on function public.v2_apply_after_completion(jsonb) from public,anon;
grant execute on function public.v2_apply_after_completion(jsonb) to authenticated;

comment on table public.v2_recurrence_households is 'Explicit 16C atomic recurrence capability; V1 remains unchanged on households not activated.';
notify pgrst,'reload schema';
commit;
