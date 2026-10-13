-- Phase 16B. ADDITIVE; DO NOT APPLY without explicit production approval.
-- V1 RPC signatures/table meanings are untouched. New semantics are opt-in by
-- workspace using v2_activate_extra_care_household, never enabled by this file.
begin;

create table if not exists public.v2_extra_care_households (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid not null references auth.users(id)
);
create table if not exists public.v2_extra_care_events (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_occurrence_id uuid not null references public.task_occurrences(id) on delete cascade,
  extra_routine_id uuid not null references public.routines(id) on delete cascade,
  event_type text not null check (event_type in ('POSTPONED','COMPLETED','REOPENED')),
  event_at timestamptz not null,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  source_event_id uuid,
  parent_event_id uuid,
  check (event_type <> 'REOPENED' or source_event_id is not null)
);
create index if not exists v2_extra_care_events_parent_idx on public.v2_extra_care_events(workspace_id,parent_occurrence_id,event_at);
create index if not exists v2_extra_care_events_routine_idx on public.v2_extra_care_events(extra_routine_id,event_type);
create table if not exists public.v2_extra_care_effect_audit (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_occurrence_id uuid not null references public.task_occurrences(id) on delete cascade,
  extra_routine_id uuid not null references public.routines(id) on delete cascade,
  canonical_snapshot_id uuid references public.completion_snapshots(id) on delete set null,
  effect jsonb not null check (jsonb_typeof(effect) = 'object' and octet_length(effect::text) < 3000)
);
create table if not exists public.v2_extra_care_legacy_carries (
  id uuid primary key, -- source legacy child occurrence ID (stable idempotency)
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  origin_occurrence_id uuid not null references public.task_occurrences(id) on delete cascade,
  extra_routine_id uuid not null references public.routines(id) on delete cascade,
  target_ordinal integer not null check (target_ordinal >= 1)
);
-- Capture the exact pre-completion trajectory before all parent+extra effects,
-- including the absence of a row. This enables an exact atomic Undo.
create table if not exists public.v2_extra_care_before (
  source_event_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  item_id uuid not null references public.entities(id) on delete cascade,
  channel text not null check (channel in ('regular','deep')),
  before_state jsonb,
  primary key(source_event_id,routine_id,item_id,channel)
);

alter table public.v2_extra_care_households enable row level security;
alter table public.v2_extra_care_events enable row level security;
alter table public.v2_extra_care_legacy_carries enable row level security;
alter table public.v2_extra_care_before enable row level security;
alter table public.v2_extra_care_effect_audit enable row level security;
create policy "v2_extra_care_members_read" on public.v2_extra_care_households
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "v2_extra_care_events_read" on public.v2_extra_care_events
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "v2_extra_care_legacy_read" on public.v2_extra_care_legacy_carries
  for select to authenticated using (public.is_workspace_member(workspace_id));
-- No direct writes or before-state reads: all writes are authorized RPC calls.
revoke all on public.v2_extra_care_households,public.v2_extra_care_events,
  public.v2_extra_care_legacy_carries,public.v2_extra_care_before,public.v2_extra_care_effect_audit from anon,authenticated;
grant select on public.v2_extra_care_households,public.v2_extra_care_events,
  public.v2_extra_care_legacy_carries to authenticated;

-- Block legacy materialized-child and parent task mutations *only after* opt-in.
-- This is an intentional fail-closed mixed-V1/V2 editing boundary, not a V1 RPC change.
create or replace function public.v2_guard_integrated_legacy_tasks()
returns trigger language plpgsql security definer set search_path=public as $$
declare w uuid; r uuid;
begin
  w := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  r := case when tg_op = 'DELETE' then old.routine_id else new.routine_id end;
  if exists(select 1 from public.v2_extra_care_households where workspace_id=w)
     and current_setting('house_care.v2_extra_care_workspace',true) is distinct from w::text
     and (exists(select 1 from public.routines x where x.id=r and x.parent_routine_id is not null)
       or exists(select 1 from public.routines x where x.parent_routine_id=r and x.archived_at is null)) then
    raise exception 'V2 integrated Extra Care household: legacy child/primary task write blocked (workspace %)',w using errcode='42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
drop trigger if exists v2_guard_integrated_legacy_tasks on public.task_occurrences;
create trigger v2_guard_integrated_legacy_tasks
before update or delete on public.task_occurrences for each row
execute function public.v2_guard_integrated_legacy_tasks();

-- Read helper uses canonical ordinal, with V1 completed child history as a
-- completion floor. A skipped or missed parent does not discharge an obligation.
create or replace function public.v2_due_extra_care_ids(p_task_id uuid)
returns uuid[] language plpgsql security definer set search_path=public as $$
declare parent public.task_occurrences%rowtype; extra public.routines%rowtype;
  last_done integer; origin integer; first_ordinal integer; first_trigger integer;
  has_carry boolean; legacy_pending boolean; origin_postponed boolean; due_ids uuid[] := array[]::uuid[];
begin
  select * into parent from public.task_occurrences where id=p_task_id;
  if not found or parent.state <> 'scheduled' or parent.trigger_ordinal is null or parent.parent_occurrence_id is not null then return due_ids; end if;
  for extra in select * from public.routines where parent_routine_id=parent.routine_id and archived_at is null and status='active' loop
    if extra.created_at > parent.scheduled_slot_at then continue; end if;
    if exists(select 1 from public.v2_extra_care_events e where e.parent_occurrence_id=p_task_id
        and e.extra_routine_id=extra.id and e.event_type='POSTPONED'
        and not exists(select 1 from public.v2_extra_care_events reversal where reversal.source_event_id=e.id and reversal.event_type='REOPENED')) then continue; end if;
    select greatest(0,coalesce(max(done.ordinal),0)) into last_done from (
      select coalesce(old.trigger_ordinal,p.trigger_ordinal,0) ordinal
      from public.task_occurrences old left join public.task_occurrences p on p.id=old.parent_occurrence_id
      where old.routine_id=extra.id and old.state='completed'
      union all
      select p.trigger_ordinal ordinal from public.v2_extra_care_events e
        join public.task_occurrences p on p.id=e.parent_occurrence_id
      where e.extra_routine_id=extra.id and e.event_type='COMPLETED'
        and not exists(select 1 from public.v2_extra_care_events reversal where reversal.source_event_id=e.id and reversal.event_type='REOPENED')
    ) done;
    select min(trigger_ordinal) into first_ordinal from public.task_occurrences
      where routine_id=parent.routine_id and parent_occurrence_id is null and scheduled_slot_at>=extra.created_at
        and trigger_ordinal is not null;
    first_ordinal := coalesce(first_ordinal,parent.trigger_ordinal);
    first_trigger := ((first_ordinal + greatest(extra.trigger_every,1)-1) / greatest(extra.trigger_every,1))*greatest(extra.trigger_every,1);
    select exists(select 1 from public.v2_extra_care_legacy_carries c where c.extra_routine_id=extra.id
      and c.target_ordinal<=parent.trigger_ordinal and c.target_ordinal>last_done) into has_carry;
    select exists(select 1 from public.task_occurrences child where child.routine_id=extra.id
      and child.state='scheduled' and coalesce(child.trigger_ordinal,0)>last_done
      and (child.trigger_ordinal<=parent.trigger_ordinal)) into legacy_pending;
    select exists(select 1 from public.v2_extra_care_legacy_carries c
      where c.extra_routine_id=extra.id and c.origin_occurrence_id=parent.id and c.target_ordinal>parent.trigger_ordinal)
      into origin_postponed;
    if (not origin_postponed and parent.trigger_ordinal>=first_trigger
      and parent.trigger_ordinal/greatest(extra.trigger_every,1)>greatest(last_done,first_trigger-1)/greatest(extra.trigger_every,1))
      or has_carry or legacy_pending then due_ids := array_append(due_ids,extra.id); end if;
  end loop;
  return due_ids;
end; $$;
revoke all on function public.v2_due_extra_care_ids(uuid) from public,anon,authenticated;

-- Explicit owner-only opt-in converts only OUTSTANDING V1 child rows; keeps
-- every historical row and its task_events/cleanliness snapshots untouched.
create or replace function public.v2_activate_extra_care_household(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare child record; carry_ordinal integer; actor_member uuid; converted integer:=0;
begin
  if auth.uid() is null or not exists(select 1 from public.workspaces where id=p_workspace_id and owner_user_id=auth.uid()) then
    raise exception 'Only the household owner may activate V2 Extra Care' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text,0));
  if exists(select 1 from public.v2_extra_care_households where workspace_id=p_workspace_id) then
    return jsonb_build_object('activated',true,'alreadyActivated',true,'converted',0); end if;
  select id into actor_member from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and status='active' limit 1;
  if actor_member is null then raise exception 'Active owner membership required'; end if;
  for child in select t.*, parent.routine_id as parent_routine_id
    from public.task_occurrences t join public.routines r on r.id=t.routine_id
    join public.task_occurrences parent on parent.id=t.parent_occurrence_id
    where t.workspace_id=p_workspace_id and t.state='scheduled' and r.parent_routine_id is not null
    for update of t loop
    select min(trigger_ordinal) into carry_ordinal from public.task_occurrences p
      where p.routine_id=child.parent_routine_id and p.state<>'cancelled'
        and p.trigger_ordinal>=coalesce(child.trigger_ordinal,1)
        and p.scheduled_slot_at>=child.effective_due_at;
    carry_ordinal:=coalesce(carry_ordinal,greatest(coalesce(child.trigger_ordinal,1),1));
    insert into public.v2_extra_care_legacy_carries(id,workspace_id,origin_occurrence_id,extra_routine_id,target_ordinal)
      values (child.id,p_workspace_id,child.parent_occurrence_id,child.routine_id,carry_ordinal)
      on conflict(id) do nothing;
    -- Guard is not active until the capability row is inserted at the end.
    update public.notification_jobs set status='cancelled',locked_at=null
      where task_id=child.id and status in ('pending','processing','failed');
    update public.task_occurrences set state='cancelled',version=version+1 where id=child.id;
    insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
      values(gen_random_uuid(),p_workspace_id,child.id,'CANCELLED',now(),actor_member,
        jsonb_build_object('reason','v2_integrated_conversion','carryTargetOrdinal',carry_ordinal));
    converted:=converted+1;
  end loop;
  insert into public.v2_extra_care_households(workspace_id,enrolled_by) values(p_workspace_id,auth.uid());
  return jsonb_build_object('activated',true,'alreadyActivated',false,'converted',converted);
end; $$;
revoke all on function public.v2_activate_extra_care_household(uuid) from public,anon;
grant execute on function public.v2_activate_extra_care_household(uuid) to authenticated;

-- Same validated path is used for parent and virtual-extra effects. Unlike the
-- V1 helper, the extra source is allowed to differ from parent.routine_id.
create or replace function public.v2_apply_extra_cleanliness(
  p_parent public.task_occurrences,p_extra uuid,p_at timestamptz,p_member uuid,p_effects jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare e jsonb; snapshot uuid; actual_snapshot uuid; item uuid; trajectory uuid; channel text; applied boolean;
begin
  if jsonb_typeof(p_effects)<>'array' or jsonb_array_length(p_effects)>128 then raise exception 'Invalid Extra Care effects'; end if;
  for e in select value from jsonb_array_elements(p_effects) loop
    if (e->>'sourceRoutineId')::uuid<>p_extra then raise exception 'Incorrect Extra Care source'; end if;
    snapshot:=(e->>'snapshotId')::uuid; item:=(e->>'itemId')::uuid;
    trajectory:=(e->>'trajectoryRoutineId')::uuid; channel:=e->>'cleanlinessChannel';
    applied:=coalesce((e->>'healthRefreshApplied')::boolean,false);
    if channel not in ('regular','deep') or not exists(select 1 from public.entities where id=item and workspace_id=p_parent.workspace_id)
      or not exists(select 1 from public.routines where id=trajectory and workspace_id=p_parent.workspace_id and affects_cleanliness) then
      raise exception 'Invalid Extra Care health target'; end if;
    -- Source routine targets are resolved by the V2 client; server verifies
    -- item is in this household, plus the source routine and channel.
    insert into public.completion_snapshots(id,workspace_id,occurrence_id,source_routine_id,trajectory_routine_id,item_id,
      cleanliness_channel,completed_at,refresh_level_pct_snapshot,cleanliness_before_pct,cleanliness_after_pct,
      health_refresh_applied,scheduled_slot_at,actor_member_id)
    values(snapshot,p_parent.workspace_id,p_parent.id,p_extra,trajectory,item,channel,p_at,
      (e->>'refreshLevelPctSnapshot')::numeric,(e->>'cleanlinessBeforePct')::numeric,
      (e->>'cleanlinessAfterPct')::numeric,applied,p_parent.scheduled_slot_at,p_member)
    on conflict(occurrence_id,trajectory_routine_id,item_id,cleanliness_channel,completed_at) do nothing;
    select id into actual_snapshot from public.completion_snapshots
      where occurrence_id=p_parent.id and trajectory_routine_id=trajectory and item_id=item
        and cleanliness_channel=channel and completed_at=p_at;
    if actual_snapshot is null then raise exception 'Missing canonical Extra Care snapshot'; end if;
    insert into public.v2_extra_care_effect_audit(id,workspace_id,parent_occurrence_id,extra_routine_id,canonical_snapshot_id,effect)
      values(snapshot,p_parent.workspace_id,p_parent.id,p_extra,actual_snapshot,e) on conflict(id) do nothing;
    if applied then
      if e->>'healthAnchorAt' is null or e->>'healthDueAt' is null or e->>'healthOverdueEndAt' is null then
        raise exception 'Incomplete Extra Care health effect'; end if;
      insert into public.health_trajectories(workspace_id,item_id,routine_id,cleanliness_channel,
        health_anchor_at,health_anchor_pct,health_due_at,health_overdue_end_at,last_refresh_completion_id,updated_at)
      values(p_parent.workspace_id,item,trajectory,channel,(e->>'healthAnchorAt')::timestamptz,
        (e->>'healthAnchorPct')::numeric,(e->>'healthDueAt')::timestamptz,
        (e->>'healthOverdueEndAt')::timestamptz,actual_snapshot,p_at)
      on conflict(routine_id,item_id,cleanliness_channel) do update
      set health_anchor_at=excluded.health_anchor_at,health_anchor_pct=excluded.health_anchor_pct,
        health_due_at=excluded.health_due_at,health_overdue_end_at=excluded.health_overdue_end_at,
        last_refresh_completion_id=excluded.last_refresh_completion_id,updated_at=excluded.updated_at
      where excluded.health_anchor_at>=public.health_trajectories.health_anchor_at;
    end if;
  end loop;
end; $$;
revoke all on function public.v2_apply_extra_cleanliness(public.task_occurrences,uuid,timestamptz,uuid,jsonb) from public,anon,authenticated;

create or replace function public.v2_apply_integrated_care(
  p_task_id uuid,p_expected_version integer,p_kind text,p_event_id uuid,p_event_at timestamptz,
  p_extra_routine_id uuid default null,p_source_event_id uuid default null,p_due_at timestamptz default null,
  p_assignee_id uuid default null,p_assignment_scope text default null,p_clear_assignee boolean default false,
  p_completion_effects jsonb default '[]'::jsonb,p_extra_completions jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare parent public.task_occurrences%rowtype; expected uuid[]; received uuid[]; x jsonb;
  actor_member uuid; source public.task_events%rowtype; postponement public.v2_extra_care_events%rowtype;
  effects jsonb; extra_snapshot_ids jsonb:='[]'::jsonb; all_ids jsonb:='[]'::jsonb;
  snaps uuid[]; before_rec record; previous jsonb; previous_json jsonb; previous_id uuid; related record;
  result jsonb; current_id uuid; event_metadata jsonb; successor record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Serialize all siblings of one routine to avoid double-paying an overdue N-trigger.
  select * into parent from public.task_occurrences where id=p_task_id;
  if not found or parent.parent_occurrence_id is not null then raise exception 'Primary occurrence unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(parent.workspace_id::text||':'||parent.routine_id::text,0));
  select * into parent from public.task_occurrences where id=p_task_id for update;
  if not public.is_workspace_member(parent.workspace_id)
    or not exists(select 1 from public.v2_extra_care_households where workspace_id=parent.workspace_id) then
    raise exception 'Integrated Extra Care capability required' using errcode='42501'; end if;
  select id into actor_member from public.workspace_members where workspace_id=parent.workspace_id
    and user_id=auth.uid() and status='active' limit 1;
  if actor_member is null then raise exception 'Active member required' using errcode='42501'; end if;
  if exists(select 1 from public.task_events where id=p_event_id and task_id=p_task_id)
    or exists(select 1 from public.v2_extra_care_events where id=p_event_id and parent_occurrence_id=p_task_id) then
    return jsonb_build_object('applied',true,'conflict',false,'actualVersion',parent.version); end if;
  if parent.version<>p_expected_version then
    return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
  -- This GUC applies only to this transaction. V1 RPC calls cannot spoof it.
  perform set_config('house_care.v2_extra_care_workspace',parent.workspace_id::text,true);
  if p_kind='extra_postpone' then
    if parent.state<>'scheduled' or p_extra_routine_id is null
      or not p_extra_routine_id=any(public.v2_due_extra_care_ids(p_task_id)) then
      return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
    insert into public.v2_extra_care_events(id,workspace_id,parent_occurrence_id,extra_routine_id,event_type,event_at,actor_member_id)
    values(p_event_id,parent.workspace_id,parent.id,p_extra_routine_id,'POSTPONED',p_event_at,actor_member);
    update public.task_occurrences set version=version+1 where id=parent.id;
  elsif p_kind='complete' then
    if parent.state<>'scheduled' then return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
    if jsonb_typeof(p_extra_completions)<>'array' or jsonb_array_length(p_extra_completions)>32
      or jsonb_typeof(p_completion_effects)<>'array' or jsonb_array_length(p_completion_effects)>128 then raise exception 'Oversized completion payload'; end if;
    expected:=public.v2_due_extra_care_ids(p_task_id);
    select coalesce(array_agg((value->>'routineId')::uuid order by value->>'routineId'),array[]::uuid[]) into received
      from jsonb_array_elements(p_extra_completions);
    select coalesce(array_agg(id order by id),array[]::uuid[]) into expected from unnest(expected) id;
    if expected<>received or cardinality(received)<>jsonb_array_length(p_extra_completions) then
      return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
    effects:=p_completion_effects;
    for x in select value from jsonb_array_elements(p_extra_completions) loop
      if (x->>'eventId')::uuid is null or jsonb_typeof(x->'effects')<>'array' then raise exception 'Invalid Extra Care completion'; end if;
      effects:=effects||(x->'effects');
    end loop;
    -- Exact prestate for affected trajectory keys, recorded once per source event.
    for x in select value from jsonb_array_elements(effects) loop
      if coalesce((x->>'healthRefreshApplied')::boolean,false) then
        select to_jsonb(h) into previous from public.health_trajectories h
          where h.routine_id=(x->>'trajectoryRoutineId')::uuid and h.item_id=(x->>'itemId')::uuid
            and h.cleanliness_channel=x->>'cleanlinessChannel' and h.workspace_id=parent.workspace_id for update;
        insert into public.v2_extra_care_before(source_event_id,workspace_id,routine_id,item_id,channel,before_state)
          values(p_event_id,parent.workspace_id,(x->>'trajectoryRoutineId')::uuid,(x->>'itemId')::uuid,
            x->>'cleanlinessChannel',previous)
        on conflict do nothing;
      end if;
    end loop;
    update public.task_targets set completed_at=coalesce(completed_at,p_event_at),
      completed_by_member_id=coalesce(completed_by_member_id,actor_member) where task_id=parent.id;
    update public.task_occurrences set state='completed',completed_at=p_event_at,version=version+1 where id=parent.id;
    perform public.apply_v12_cleanliness_effects(parent,p_event_at,actor_member,p_completion_effects);
    select coalesce(jsonb_agg(value->>'snapshotId'),'[]'::jsonb) into all_ids from jsonb_array_elements(effects);
    for x in select value from jsonb_array_elements(p_extra_completions) loop
      perform public.v2_apply_extra_cleanliness(parent,(x->>'routineId')::uuid,p_event_at,actor_member,x->'effects');
      insert into public.v2_extra_care_events(id,workspace_id,parent_occurrence_id,extra_routine_id,event_type,event_at,actor_member_id,parent_event_id)
      values((x->>'eventId')::uuid,parent.workspace_id,parent.id,(x->>'routineId')::uuid,'COMPLETED',p_event_at,actor_member,p_event_id);
    end loop;
    select coalesce(jsonb_agg(value->>'snapshotId'),'[]'::jsonb) into extra_snapshot_ids from jsonb_array_elements(p_completion_effects);
    -- A legacy snapshot natural-key collision may map the virtual Extra Care
    -- snapshot onto an existing canonical row. Expose the actual committed ids
    -- so post-refresh optimistic Undo can restore the correct trajectories.
    select coalesce(jsonb_agg(s.id::text),'[]'::jsonb) into all_ids
      from public.completion_snapshots s where s.occurrence_id=parent.id and s.completed_at=p_event_at;
    -- Include server-captured prestate in the task event projection. After
    -- refreshing an offline client, optimistic Undo must still know the exact
    -- prior trajectory state; no caller-provided prestate is trusted.
    select coalesce(jsonb_agg(jsonb_build_object(
      'workspaceId',b.before_state->>'workspace_id',
      'routineId',b.before_state->>'routine_id',
      'itemId',b.before_state->>'item_id',
      'cleanlinessChannel',b.before_state->>'cleanliness_channel',
      'healthAnchorAt',b.before_state->>'health_anchor_at',
      'healthAnchorPct',(b.before_state->>'health_anchor_pct')::numeric,
      'healthDueAt',b.before_state->>'health_due_at',
      'healthOverdueEndAt',b.before_state->>'health_overdue_end_at',
      'lastRefreshCompletionId',b.before_state->>'last_refresh_completion_id',
      'updatedAt',b.before_state->>'updated_at')),'[]'::jsonb)
      into previous_json from public.v2_extra_care_before b
      where b.source_event_id=p_event_id and b.before_state is not null;
    event_metadata:=jsonb_build_object('cleanlinessSnapshots',extra_snapshot_ids,'integratedExtraIds',to_jsonb(expected),
      'integratedSnapshotIds',all_ids,'trajectoryBefore',previous_json);
    insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
    values(p_event_id,parent.workspace_id,parent.id,'COMPLETED',p_event_at,actor_member,event_metadata);
  elsif p_kind='undo' or p_kind='reopen_today' then
    if p_kind='undo' and p_source_event_id is null then raise exception 'Undo needs source event'; end if;
    select * into postponement from public.v2_extra_care_events
      where id=p_source_event_id and parent_occurrence_id=parent.id and event_type='POSTPONED';
    if found and p_kind='undo' then
      if exists(select 1 from public.v2_extra_care_events where source_event_id=postponement.id and event_type='REOPENED') then
        return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
      insert into public.v2_extra_care_events(id,workspace_id,parent_occurrence_id,extra_routine_id,event_type,event_at,actor_member_id,source_event_id)
      values(p_event_id,parent.workspace_id,parent.id,postponement.extra_routine_id,'REOPENED',p_event_at,actor_member,postponement.id);
      update public.task_occurrences set version=version+1 where id=parent.id;
    else
      if p_kind='reopen_today' then
        select * into source from public.task_events where task_id=parent.id
          and event_type in ('COMPLETED','SKIPPED','POSTPONED') order by event_at desc,id desc limit 1;
      else
        select * into source from public.task_events where id=p_source_event_id and task_id=parent.id;
      end if;
      if not found or source.event_type not in ('COMPLETED','SKIPPED','POSTPONED','REASSIGNED') then
        return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
      if exists(select 1 from public.task_events later where later.task_id=parent.id
          and (later.event_at>source.event_at or (later.event_at=source.event_at and later.id<>source.id))
          and later.event_type in ('COMPLETED','SKIPPED','POSTPONED','REASSIGNED','TARGET_COMPLETED','REOPENED')) then
        return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
      if source.event_type='COMPLETED' and source.metadata ? 'integratedExtraIds' then
        -- Do not roll back an unrelated newer health refresh.
        for before_rec in select * from public.v2_extra_care_before where source_event_id=source.id loop
          select h.last_refresh_completion_id into previous_id from public.health_trajectories h
            where h.routine_id=before_rec.routine_id and h.item_id=before_rec.item_id
              and h.cleanliness_channel=before_rec.channel for update;
          select c.id into current_id from public.completion_snapshots c
            where c.id=previous_id and c.occurrence_id=parent.id and c.completed_at=source.event_at;
          if previous_id is not null and current_id is null then
            return jsonb_build_object('applied',false,'conflict',true,'actualVersion',parent.version); end if;
        end loop;
        for before_rec in select * from public.v2_extra_care_before where source_event_id=source.id loop
          delete from public.health_trajectories where routine_id=before_rec.routine_id and item_id=before_rec.item_id
            and cleanliness_channel=before_rec.channel;
          if before_rec.before_state is not null then
            insert into public.health_trajectories(workspace_id,routine_id,item_id,cleanliness_channel,
              health_anchor_at,health_anchor_pct,health_due_at,health_overdue_end_at,last_refresh_completion_id,updated_at)
            select (before_rec.before_state->>'workspace_id')::uuid,(before_rec.before_state->>'routine_id')::uuid,
              (before_rec.before_state->>'item_id')::uuid,before_rec.before_state->>'cleanliness_channel',
              (before_rec.before_state->>'health_anchor_at')::timestamptz,(before_rec.before_state->>'health_anchor_pct')::numeric,
              (before_rec.before_state->>'health_due_at')::timestamptz,(before_rec.before_state->>'health_overdue_end_at')::timestamptz,
              nullif(before_rec.before_state->>'last_refresh_completion_id','')::uuid,
              (before_rec.before_state->>'updated_at')::timestamptz;
          end if;
        end loop;
        update public.task_targets set completed_at=null,completed_by_member_id=null where task_id=parent.id and completed_at=source.event_at;
        update public.task_occurrences set state='scheduled',completed_at=null,version=version+1,
          effective_due_at=case when p_kind='reopen_today' then p_event_at else effective_due_at end
          where id=parent.id;
        for related in select * from public.v2_extra_care_events where parent_event_id=source.id and event_type='COMPLETED' loop
          insert into public.v2_extra_care_events(id,workspace_id,parent_occurrence_id,extra_routine_id,event_type,event_at,actor_member_id,source_event_id)
          values(gen_random_uuid(),parent.workspace_id,parent.id,related.extra_routine_id,'REOPENED',p_event_at,actor_member,related.id);
        end loop;
        if exists(select 1 from public.routines where id=parent.routine_id and schedule_mode='after_completion') then
          for successor in select id from public.task_occurrences where routine_id=parent.routine_id
             and id<>parent.id and state='scheduled' and (p_kind='reopen_today' or created_at>=source.event_at) loop
            update public.task_occurrences set state='cancelled',version=version+1 where id=successor.id;
            insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
              values(gen_random_uuid(),parent.workspace_id,successor.id,'CANCELLED',p_event_at,actor_member,
                jsonb_build_object('reason',case when p_kind='undo' then 'undo_after_completion_successor' else 'restore_to_today_successor' end,'undoOf',source.id));
          end loop;
        end if;
        insert into public.task_events(id,workspace_id,task_id,event_type,event_at,actor_member_id,metadata)
        values(p_event_id,parent.workspace_id,parent.id,'REOPENED',p_event_at,actor_member,
          case when p_kind='undo' then jsonb_build_object('undoOf',source.id,'undoType',source.event_type)
          else jsonb_build_object('restoreOf',source.id,'restoreType',source.event_type) end);
      elsif p_kind='undo' then
        result:=public.undo_task_mutation(parent.id,p_expected_version,source.id,p_event_id,p_event_at);
        return result;
      else
        result:=public.reopen_task_to_today(parent.id,p_source_event_id,p_event_id,p_event_at);
        return result;
      end if;
    end if;
  elsif p_kind in ('skip','postpone','reassign') then
    result:=public.apply_task_mutation(parent.id,p_expected_version,p_kind,p_event_id,p_event_at,p_due_at,
      '[]'::jsonb,p_assignee_id,p_clear_assignee,p_assignment_scope);
    return result;
  else
    raise exception 'Unsupported integrated mutation %',p_kind;
  end if;
  return jsonb_build_object('applied',true,'conflict',false,'actualVersion',p_expected_version+1);
end; $$;
revoke all on function public.v2_apply_integrated_care(uuid,integer,text,uuid,timestamptz,uuid,uuid,timestamptz,uuid,text,boolean,jsonb,jsonb) from public,anon;
grant execute on function public.v2_apply_integrated_care(uuid,integer,text,uuid,timestamptz,uuid,uuid,timestamptz,uuid,text,boolean,jsonb,jsonb) to authenticated;

comment on table public.v2_extra_care_households is 'Explicit V2 enrollment. V1 linked RPCs are unchanged; legacy task edits fail closed after activation.';
notify pgrst,'reload schema';
commit;
