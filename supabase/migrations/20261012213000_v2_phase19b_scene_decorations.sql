-- Phase 19B — STAGING / REVIEW ONLY. DO NOT RUN ON SHARED SUPABASE WITHOUT EXPRESS APPROVAL.
-- Additive, V1 schema and RPC signatures remain unchanged. No Realtime, Storage or cron.
-- Explicit scene overrides only; default procedural scenes are never written.
create table if not exists public.scene_decorations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scene_id uuid not null,
  generator_version integer not null check (generator_version between 1 and 32767),
  schema_version integer not null check (schema_version between 1 and 32767),
  items_json jsonb not null default '[]'::jsonb,
  revision integer not null check (revision >= 1),
  last_mutation_id uuid not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  orphaned_at timestamptz,
  primary key (workspace_id, scene_id),
  constraint v2_scene_array check (jsonb_typeof(items_json) = 'array'),
  constraint v2_scene_json_bytes check (octet_length(items_json::text) <= 6144)
);
create index if not exists scene_decorations_household_idx on public.scene_decorations(workspace_id) where orphaned_at is null;
alter table public.scene_decorations enable row level security;
revoke all on public.scene_decorations from public, anon, authenticated;
grant select on public.scene_decorations to authenticated;
create policy v2_scene_read on public.scene_decorations for select to authenticated
  using (public.is_workspace_member(workspace_id));
-- No direct INSERT/UPDATE/DELETE grant: writes only via CAS RPC.

create table if not exists public.v2_scene_applied_ops (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mutation_id uuid not null,
  scene_id uuid not null,
  payload_hash text not null,
  revision integer not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, mutation_id)
);
create index if not exists v2_scene_ops_scene_idx on public.v2_scene_applied_ops(workspace_id,scene_id,created_at);
alter table public.v2_scene_applied_ops enable row level security;
revoke all on public.v2_scene_applied_ops from public, anon, authenticated;

create or replace function public.v2_scene_json_valid(p_value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare
  v_item jsonb;
  v_id text;
  v_seen text[] := ARRAY[]::text[];
  v_key text;
  v_number numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 16
    or octet_length(p_value::text) > 6144 then return false; end if;
  for v_item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_item) <> 'object' then return false; end if;
    for v_key in select jsonb_object_keys(v_item) loop
      if not (v_key = any(array['id','kind','ink','layer','x','y','scale','rotation','elementId'])) then return false; end if;
    end loop;
    v_id := v_item->>'id';
    if v_id is null or length(v_id) > 80 or v_id !~ '^[A-Za-z0-9_-]{1,80}$' or v_id = any(v_seen) then return false; end if;
    v_seen := array_append(v_seen,v_id);
    if jsonb_typeof(v_item->'kind') <> 'string' or not (v_item->>'kind' = any(array['plant','rug','lamp','shelf','starburst','tiles','sofa','counter','picture'])) then return false; end if;
    if jsonb_typeof(v_item->'ink') <> 'string' or not (v_item->>'ink' = any(array['teal','coral','mustard','ink'])) then return false; end if;
    if jsonb_typeof(v_item->'layer') <> 'string' or not (v_item->>'layer' = any(array['behind','above'])) then return false; end if;
    if (v_item ? 'elementId') and (jsonb_typeof(v_item->'elementId') <> 'string'
        or (v_item->>'elementId') !~ '^[A-Za-z0-9_-]{1,80}$') then return false; end if;
    for v_key in select unnest(array['x','y','scale','rotation']) loop
      if jsonb_typeof(v_item->v_key) <> 'number' then return false; end if;
      v_number := (v_item->>v_key)::numeric;
      if v_key = 'x' and (v_number < 0 or v_number > 1000 or mod(v_number,1) <> 0) then return false; end if;
      if v_key = 'y' and (v_number < 0 or v_number > 700 or mod(v_number,1) <> 0) then return false; end if;
      if v_key = 'scale' and (v_number < .5 or v_number > 2 or mod(v_number * 10,1) <> 0) then return false; end if;
      if v_key = 'rotation' and (v_number < -180 or v_number > 180 or mod(v_number,15) <> 0) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
-- Validate even against privileged manual DML.
alter table public.scene_decorations add constraint v2_scene_whitelist check (public.v2_scene_json_valid(items_json));

create or replace function public.v2_commit_scene_decorations(
  p_workspace_id uuid, p_scene_id uuid, p_expected_revision integer,
  p_generator_version integer, p_items jsonb, p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_row public.scene_decorations%rowtype;
  v_receipt public.v2_scene_applied_ops%rowtype;
  v_hash text;
  v_item jsonb;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Household membership denied' using errcode='42501';
  end if;
  if p_scene_id is null or p_mutation_id is null or p_expected_revision is null
    or p_expected_revision < 0 or p_expected_revision > 2147483640
    or p_generator_version <> 1 or not public.v2_scene_json_valid(p_items) then
    raise exception 'Unsupported scene decoration request' using errcode='22023';
  end if;
  -- Serialize with existing CAS paths using the workspace lock.
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception 'Household does not exist' using errcode='42501'; end if;
  v_hash := md5(p_items::text || '|' || p_expected_revision::text || '|' || p_generator_version::text);
  select * into v_receipt from public.v2_scene_applied_ops
    where workspace_id=p_workspace_id and mutation_id=p_mutation_id;
  if found then
    if v_receipt.scene_id <> p_scene_id or v_receipt.payload_hash <> v_hash then
      raise exception 'Mutation ID reused with different content' using errcode='22023';
    end if;
    return jsonb_build_object('applied',true,'conflict',false,'duplicate',true,'revision',v_receipt.revision);
  end if;
  if not exists(select 1 from public.layout_scenes
      where workspace_id=p_workspace_id and id=p_scene_id and archived_at is null) then
    raise exception 'Scene missing, archived or owned by another household' using errcode='42501';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if v_item ? 'elementId' and not exists(select 1 from public.layout_elements
      where workspace_id=p_workspace_id and scene_id=p_scene_id
        and id=(v_item->>'elementId')::uuid and archived_at is null) then
      raise exception 'Decoration anchor missing or outside the scene' using errcode='42501';
    end if;
  end loop;
  select * into v_row from public.scene_decorations
    where workspace_id=p_workspace_id and scene_id=p_scene_id for update;
  if found then
    if v_row.orphaned_at is not null or v_row.revision <> p_expected_revision then
      return jsonb_build_object('applied',false,'conflict',true,'actualVersion',v_row.revision,'message','Scene was deleted or changed on another device');
    end if;
    update public.scene_decorations set generator_version=1,schema_version=1,items_json=p_items,
      revision=v_row.revision+1,last_mutation_id=p_mutation_id,updated_at=clock_timestamp(),updated_by=auth.uid()
      where workspace_id=p_workspace_id and scene_id=p_scene_id;
  else
    if p_expected_revision <> 0 then
      return jsonb_build_object('applied',false,'conflict',true,'actualVersion',0,'message','Scene artwork no longer exists');
    end if;
    insert into public.scene_decorations(workspace_id,scene_id,generator_version,schema_version,items_json,revision,last_mutation_id,updated_by)
      values(p_workspace_id,p_scene_id,1,1,p_items,1,p_mutation_id,auth.uid());
  end if;
  insert into public.v2_scene_applied_ops(workspace_id,mutation_id,scene_id,payload_hash,revision)
    values(p_workspace_id,p_mutation_id,p_scene_id,v_hash,p_expected_revision+1);
  -- No cron; prune only old idempotency receipts during a confirmed save.
  delete from public.v2_scene_applied_ops where workspace_id=p_workspace_id and scene_id=p_scene_id
    and created_at < now() - interval '90 days';
  return jsonb_build_object('applied',true,'conflict',false,'revision',p_expected_revision+1);
end;
$$;
revoke all on function public.v2_commit_scene_decorations(uuid,uuid,integer,integer,jsonb,uuid) from public, anon;
grant execute on function public.v2_commit_scene_decorations(uuid,uuid,integer,integer,jsonb,uuid) to authenticated;
revoke all on function public.v2_scene_json_valid(jsonb) from public, anon;
grant execute on function public.v2_scene_json_valid(jsonb) to authenticated;

-- V1 hard delete/reset must not leave live decoration rows on removed geometry.
-- Unlike cascade deletion this creates a recoverable tombstone, not silent loss.
create or replace function public.v2_orphan_scene_decorations()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.scene_decorations set orphaned_at=clock_timestamp(),updated_at=clock_timestamp()
    where workspace_id=old.workspace_id and scene_id=old.id and orphaned_at is null;
  return old;
end;
$$;
create trigger v2_orphan_scene_on_delete after delete on public.layout_scenes
  for each row execute function public.v2_orphan_scene_decorations();
-- For an archived scene the client will hide rows, preserving recoverable custom art.
-- Missing/archived element anchors are ignored by the client and rejected on the next save.
-- Old V1 tables/RPCs and the V1 reset signature are unchanged.
