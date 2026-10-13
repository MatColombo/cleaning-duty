-- PHASE 16A: STAGED ONLY. DO NOT APPLY TO THE SHARED PROJECT WITHOUT APPROVAL.
-- Additive V2-only transactional, per-field CAS patch. No V1 table, RPC contract
-- or task event semantics are changed. Run RLS/coexistence checks in staging.
create table if not exists public.v2_sync_applied_ops (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mutation_id uuid not null,
  applied_at timestamptz not null default now(),
  primary key (workspace_id, mutation_id)
);
alter table public.v2_sync_applied_ops enable row level security;
-- No direct client policies: the checked RPC is the only writer/reader.
revoke all on public.v2_sync_applied_ops from anon, authenticated;

create or replace function public.v2_apply_entity_changes(
  p_workspace_id uuid, p_mutation_id uuid, p_changes jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c jsonb;
  v_table text;
  v_key jsonb;
  v_before jsonb;
  v_after jsonb;
  v_current jsonb;
  v_normal_before jsonb;
  v_columns text;
  v_where text;
  v_field text;
  v_allowed_key text[];
  v_owner_only boolean;
  v_owner boolean;
  v_count integer;
  v_ref_table text;
  v_links jsonb;
  v_position integer := 0;
  v_valid_tables text[] := array[
    'workspaces','workspace_members','metadata_field_definitions','entity_types',
    'entities','layout_scenes','layout_elements','entity_relations','supplies',
    'supply_events','action_definitions','routines','routine_targets',
    'task_occurrences','task_targets','task_events','health_trajectories',
    'completion_snapshots'
  ];
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Household access denied' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array'
    or jsonb_array_length(p_changes) > 800 or pg_column_size(p_changes) > 1048576 then
    raise exception 'Invalid or oversized V2 patch' using errcode = '22023';
  end if;
  select public.is_workspace_owner(p_workspace_id) into v_owner;
  -- Serializes V2 writes per household; normal V1 task RPCs keep their own
  -- version checks. Existing V1 config writes do not participate in this lock.
  perform 1 from public.workspaces where id = p_workspace_id for update;
  if exists (select 1 from public.v2_sync_applied_ops
             where workspace_id = p_workspace_id and mutation_id = p_mutation_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'duplicate', true);
  end if;

  -- Pass 1: lock and check EVERY field before applying ANY change; an early
  -- conflict thus cannot commit the first half of a multi-entity operation.
  for c in select value from jsonb_array_elements(p_changes) loop
    v_position := v_position + 1;
    v_table := c->>'table';
    v_key := c->'key';
    v_before := c->'before';
    v_after := c->'after';
    if jsonb_typeof(c) <> 'object' or not (c ?& array['table','key','before','after'])
       or v_table is null or not (v_table = any(v_valid_tables)) or jsonb_typeof(v_key) <> 'object'
       or (v_before <> 'null'::jsonb and jsonb_typeof(v_before) <> 'object')
       or (v_after <> 'null'::jsonb and jsonb_typeof(v_after) <> 'object') then
      raise exception 'Malformed V2 entity patch' using errcode = '22023';
    end if;
    v_allowed_key := case v_table
      when 'routine_targets' then array['routine_id','entity_id']
      when 'task_targets' then array['task_id','entity_id']
      when 'health_trajectories' then array['routine_id','item_id','cleanliness_channel']
      else array['id'] end;
    if (select array_agg(k order by k) from jsonb_object_keys(v_key) as keys(k))
        is distinct from (select array_agg(k order by k) from unnest(v_allowed_key) as keys(k))
       or exists (select 1 from jsonb_each_text(v_key) e where e.value is null) then
      raise exception 'Invalid entity key' using errcode = '22023';
    end if;
    if v_table = 'workspaces' then
      if v_key->>'id' <> p_workspace_id::text then raise exception 'Wrong household' using errcode = '42501'; end if;
    elsif coalesce(v_after->>'workspace_id', p_workspace_id::text) <> p_workspace_id::text then
      raise exception 'Cross-household write denied' using errcode = '42501';
    end if;
    v_owner_only := v_table = any(array['workspaces','workspace_members']);
    if v_owner_only and not v_owner then raise exception 'Owner permission required' using errcode = '42501'; end if;
    if v_after = 'null'::jsonb and v_table <> all(array['routine_targets','health_trajectories']) then
      raise exception 'Only specific join/health rows may be deleted' using errcode = '42501';
    end if;
    if v_before <> 'null'::jsonb and v_table = any(array['task_events','supply_events','completion_snapshots','task_targets']) then
      raise exception 'Audit and target snapshots are append-only' using errcode = '42501';
    end if;
    if v_after <> 'null'::jsonb and (select count(*) from jsonb_object_keys(v_after)) = 0 then
      raise exception 'Empty entity patch' using errcode = '22023';
    end if;
    -- A finite table whitelist is not enough: also verify every submitted
    -- column really exists and forbid edits to identity, ownership and scope.
    for v_field in select distinct k from (
      select jsonb_object_keys(v_key) as k
      union all select jsonb_object_keys(case when v_after = 'null'::jsonb then '{}'::jsonb else v_after end)
      union all select jsonb_object_keys(case when v_before = 'null'::jsonb then '{}'::jsonb else v_before end)
    ) columns loop
      if not exists (select 1 from pg_attribute a where a.attrelid = format('public.%I', v_table)::regclass
                     and a.attname = v_field and a.attnum > 0 and not a.attisdropped) then
        raise exception 'Unknown column %', v_field using errcode = '22023';
      end if;
      if v_before <> 'null'::jsonb and v_after <> 'null'::jsonb
          and v_field = any(array['id','workspace_id','owner_user_id','user_id','created_at'])
          and v_after ? v_field then
        raise exception 'Immutable identity field' using errcode = '42501';
      end if;
    end loop;
    if v_after <> 'null'::jsonb and v_before <> 'null'::jsonb
      and exists (select 1 from jsonb_object_keys(v_after) k where not (v_before ? k)) then
      raise exception 'Every written field requires its previous value' using errcode = '22023';
    end if;
    if v_after <> 'null'::jsonb and v_before = 'null'::jsonb then
      if v_table <> 'workspaces' and (v_after->>'workspace_id' is distinct from p_workspace_id::text) then
        raise exception 'New row needs its household scope' using errcode = '42501';
      end if;
      if exists (select 1 from jsonb_object_keys(v_key) k where v_after->>k is distinct from v_key->>k) then
        raise exception 'Entity ID changed' using errcode = '42501';
      end if;
    end if;
    v_where := case when v_table = 'workspaces' then 't.id = $2' else 't.workspace_id = $2' end;
    execute format('select to_jsonb(t) from public.%I t where %s and to_jsonb(t) @> $1 for update', v_table, v_where)
      into v_current using v_key, p_workspace_id;
    if v_before = 'null'::jsonb then
      if v_current is not null then
        return jsonb_build_object('applied', false, 'conflict', true, 'table', v_table, 'key', v_key, 'position', v_position);
      end if;
    else
      if v_current is null then
        return jsonb_build_object('applied', false, 'conflict', true, 'table', v_table, 'key', v_key, 'position', v_position);
      end if;
      execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', v_table)
        into v_normal_before using v_before;
      if exists (select 1 from jsonb_object_keys(v_before) k
                 where v_current->k is distinct from v_normal_before->k) then
        return jsonb_build_object('applied', false, 'conflict', true, 'table', v_table, 'key', v_key, 'position', v_position);
      end if;
    end if;
  end loop;

  -- Pass 2: apply the validated subset only. The RPC transaction guarantees
  -- all-or-nothing. Append-only events retain their original UUIDs.
  for c in select value from jsonb_array_elements(p_changes) loop
    v_table := c->>'table'; v_key := c->'key'; v_before := c->'before'; v_after := c->'after';
    v_where := case when v_table = 'workspaces' then 't.id = $2' else 't.workspace_id = $2' end;
    if v_after = 'null'::jsonb then
      execute format('delete from public.%I t where %s and to_jsonb(t) @> $1', v_table, v_where)
        using v_key, p_workspace_id;
    else
      -- A SECURITY DEFINER function must not trust unrelated UUID FKs merely
      -- because the row's own workspace_id was provided correctly. Parents
      -- inserted earlier in this same atomic patch are visible to this check.
      v_links := case v_table
        when 'entities' then '{"type_id":"entity_types","parent_id":"entities"}'::jsonb
        when 'layout_elements' then '{"scene_id":"layout_scenes","entity_id":"entities"}'::jsonb
        when 'entity_relations' then '{"from_entity_id":"entities","to_entity_id":"entities","target_scene_id":"layout_scenes"}'::jsonb
        when 'supply_events' then '{"supply_id":"supplies","actor_member_id":"workspace_members"}'::jsonb
        when 'routines' then '{"action_id":"action_definitions","parent_routine_id":"routines"}'::jsonb
        when 'routine_targets' then '{"routine_id":"routines","entity_id":"entities"}'::jsonb
        when 'task_occurrences' then '{"routine_id":"routines","parent_occurrence_id":"task_occurrences","assignee_member_id":"workspace_members"}'::jsonb
        when 'task_targets' then '{"task_id":"task_occurrences","entity_id":"entities"}'::jsonb
        when 'task_events' then '{"task_id":"task_occurrences","actor_member_id":"workspace_members"}'::jsonb
        when 'health_trajectories' then '{"routine_id":"routines","item_id":"entities"}'::jsonb
        when 'completion_snapshots' then '{"occurrence_id":"task_occurrences","source_routine_id":"routines","trajectory_routine_id":"routines","item_id":"entities","actor_member_id":"workspace_members"}'::jsonb
        else '{}'::jsonb end;
      for v_field in select jsonb_object_keys(v_links) loop
        if v_after ? v_field and v_after->>v_field is not null then
          v_ref_table := v_links->>v_field;
          execute format('select count(*) from public.%I where id = $1 and workspace_id = $2', v_ref_table)
            into v_count using (v_after->>v_field)::uuid, p_workspace_id;
          if v_count <> 1 then raise exception 'Cross-household entity reference denied'
            using errcode = '42501'; end if;
        end if;
      end loop;
      if v_table = 'task_events' and v_before = 'null'::jsonb
         and coalesce(v_after->>'event_type','') not in ('TASK_CREATED','ASSIGNED','CANCELLED','REOPENED') then
        raise exception 'Use the canonical task RPC for lifecycle events' using errcode = '42501';
      end if;
      select string_agg(format('%I', k), ', ' order by k) into v_columns from jsonb_object_keys(v_after) k;
      if v_before = 'null'::jsonb then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',
                       v_table, v_columns, v_columns, v_table) using v_after;
      else
        execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I,$1)) where %s and to_jsonb(t) @> $3',
                       v_table, v_columns, v_columns, v_table, v_where) using v_after, p_workspace_id, v_key;
      end if;
    end if;
  end loop;
  insert into public.v2_sync_applied_ops(workspace_id, mutation_id) values (p_workspace_id, p_mutation_id);
  return jsonb_build_object('applied', true, 'conflict', false, 'rows', jsonb_array_length(p_changes));
exception when unique_violation or foreign_key_violation then
  -- Raising, not returning, is essential: it rolls back an entire transaction
  -- in the face of an insertion race with legacy or another device.
  raise exception 'Concurrent or invalid entity dependency; reload and resolve conflict' using errcode = 'PZ409';
end;
$$;
revoke all on function public.v2_apply_entity_changes(uuid,uuid,jsonb) from public, anon;
grant execute on function public.v2_apply_entity_changes(uuid,uuid,jsonb) to authenticated;
comment on function public.v2_apply_entity_changes(uuid,uuid,jsonb) is
 'V2-only, atomic idempotent field-level CAS. V1 RPCs unchanged. Requires staging RLS approval.';
