-- PHASE 18B - FOR STAGING REVIEW ONLY. DO NOT APPLY WITHOUT OWNER APPROVAL.
-- Additive resource; none of the V1 RPC signatures or V1 table shapes are modified.
create table if not exists public.visual_overrides (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null check (subject_type in ('routine','action','entity')),
  subject_id uuid not null,
  generator_version integer not null check (generator_version between 1 and 32767),
  schema_version integer not null check (schema_version between 1 and 32767),
  overrides_json jsonb not null default '{}'::jsonb,
  revision integer not null check (revision >= 1),
  last_mutation_id uuid not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, subject_type, subject_id),
  check (jsonb_typeof(overrides_json) = 'object'),
  check (octet_length(overrides_json::text) <= 2048)
);
create index if not exists visual_overrides_household_idx on public.visual_overrides(workspace_id);
alter table public.visual_overrides enable row level security;
revoke all on public.visual_overrides from anon, authenticated;
grant select on public.visual_overrides to authenticated;
create policy v2_visual_read on public.visual_overrides for select to authenticated
  using (public.is_workspace_member(workspace_id));
-- Writes can ONLY use the CAS RPC. Direct INSERT/UPDATE/DELETE prohibited even for members.

create table if not exists public.v2_visual_applied_ops (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mutation_id uuid not null,
  subject_type text not null,
  subject_id uuid not null,
  revision integer not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, mutation_id)
);
alter table public.v2_visual_applied_ops enable row level security;
revoke all on public.v2_visual_applied_ops from anon, authenticated;

create or replace function public.v2_visual_json_valid(p_value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare k text; v jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 2048 then return false; end if;
  for k, v in select key, value from jsonb_each(p_value) loop
    if not (k = any(array['subjectId', 'expression', 'eyes', 'mouth', 'brows', 'pose', 'handGesture', 'scale', 'proportion', 'prop', 'scene', 'paletteVariant', 'animation'])) then return false; end if;
    if k = 'subjectId' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['bathtub', 'bed', 'bookcase', 'broom', 'bucket', 'cabinet', 'chair', 'cleaner-bottle', 'cloth', 'coffee-machine', 'countertop', 'detergent-bottle', 'dishwasher', 'dryer', 'duster', 'generic-appliance', 'generic-supply', 'generic-surface', 'generic-tool', 'house', 'kettle', 'microfiber-stack', 'mop', 'oven', 'paper-roll', 'refrigerator', 'scrub-brush', 'shower-head', 'sink', 'sofa', 'sponge', 'spray-bottle', 'squeegee', 'stovetop', 'table', 'tablet-pack', 'toilet', 'vacuum', 'washer'])) then return false; end if;
    end if;
    if k = 'expression' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['joyful', 'smile', 'proud', 'neutral', 'focused', 'worried', 'tired', 'sweaty', 'angry', 'sleepy', 'relieved', 'surprised'])) then return false; end if;
    end if;
    if k = 'eyes' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['joyful', 'smile', 'proud', 'neutral', 'focused', 'worried', 'tired', 'sweaty', 'angry', 'sleepy', 'relieved', 'surprised'])) then return false; end if;
    end if;
    if k = 'mouth' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['joyful', 'smile', 'proud', 'neutral', 'focused', 'worried', 'tired', 'sweaty', 'angry', 'sleepy', 'relieved', 'surprised'])) then return false; end if;
    end if;
    if k = 'brows' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['joyful', 'smile', 'proud', 'neutral', 'focused', 'worried', 'tired', 'sweaty', 'angry', 'sleepy', 'relieved', 'surprised'])) then return false; end if;
    end if;
    if k = 'pose' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['arms-down', 'thumbs-up', 'wave', 'point', 'fist-pump', 'hands-on-hips', 'hold-sponge', 'hold-cloth', 'scrub', 'shrug', 'celebrate', 'present'])) then return false; end if;
    end if;
    if k = 'handGesture' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['thumb', 'open', 'fist', 'point', 'hold'])) then return false; end if;
    end if;
    if k = 'scale' then
      if jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0.75 or (v::text)::numeric > 1.25
        or mod((v::text)::numeric * 20, 1) <> 0 then return false; end if;
    end if;
    if k = 'proportion' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['standard', 'compact', 'tall'])) then return false; end if;
    end if;
    if k = 'prop' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['none', 'sparkle-4', 'sparkle-6', 'action-rays', 'steam', 'droplets', 'shine'])) then return false; end if;
    end if;
    if k = 'scene' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['kitchen', 'bathroom', 'living', 'bedroom', 'dining', 'hallway', 'utility', 'outdoor', 'generic-interior'])) then return false; end if;
    end if;
    if k = 'paletteVariant' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['teal', 'coral', 'mustard', 'turquoise'])) then return false; end if;
    end if;
    if k = 'animation' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['none', 'tilt', 'blink', 'gesture'])) then return false; end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

-- Server-side constraints apply even for privileged writes outside the RPC.
alter table public.visual_overrides add constraint v2_visual_whitelist_check
  check (public.v2_visual_json_valid(overrides_json));

create or replace function public.v2_commit_visual_override(
  p_workspace_id uuid, p_subject_type text, p_subject_id uuid,
  p_expected_revision integer, p_generator_version integer,
  p_overrides jsonb, p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_row public.visual_overrides%rowtype;
  v_applied public.v2_visual_applied_ops%rowtype;
  v_exists boolean;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Household membership denied' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 2147483640
    or p_mutation_id is null or p_generator_version <> 2
    or p_subject_type not in ('routine','action','entity') or p_subject_id is null
    or not public.v2_visual_json_valid(p_overrides) then
    raise exception 'Unsupported or malformed visual recipe' using errcode='22023';
  end if;
  -- Serialize mutations for this household and with the V2 coordinator CAS RPC.
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception 'Household does not exist' using errcode='42501'; end if;
  select * into v_applied from public.v2_visual_applied_ops
    where workspace_id=p_workspace_id and mutation_id=p_mutation_id;
  if found then
    if v_applied.subject_type <> p_subject_type or v_applied.subject_id <> p_subject_id then
      raise exception 'Mutation ID reused for another subject' using errcode='22023';
    end if;
    return jsonb_build_object('applied',true,'conflict',false,'duplicate',true,'revision',v_applied.revision);
  end if;
  v_exists := case p_subject_type
    when 'routine' then exists(select 1 from public.routines where id=p_subject_id and workspace_id=p_workspace_id and archived_at is null)
    when 'action' then exists(select 1 from public.action_definitions where id=p_subject_id and workspace_id=p_workspace_id and archived_at is null)
    else exists(select 1 from public.entities where id=p_subject_id and workspace_id=p_workspace_id and archived_at is null)
  end;
  if not v_exists then raise exception 'Visual subject does not belong to active household' using errcode='42501'; end if;
  select * into v_row from public.visual_overrides where workspace_id=p_workspace_id
    and subject_type=p_subject_type and subject_id=p_subject_id for update;
  if found then
    if v_row.revision <> p_expected_revision then
      return jsonb_build_object('applied',false,'conflict',true,'actualVersion',v_row.revision,'message','Visual artwork changed on another device');
    end if;
    update public.visual_overrides set overrides_json=p_overrides,
      generator_version=p_generator_version, schema_version=1,
      revision=v_row.revision+1, last_mutation_id=p_mutation_id, updated_by=auth.uid(), updated_at=clock_timestamp()
      where workspace_id=p_workspace_id and subject_type=p_subject_type and subject_id=p_subject_id;
  else
    if p_expected_revision <> 0 then
      return jsonb_build_object('applied',false,'conflict',true,'actualVersion',0,'message','Visual artwork was reset or removed');
    end if;
    insert into public.visual_overrides(workspace_id,subject_type,subject_id,generator_version,schema_version,
      overrides_json,revision,last_mutation_id,updated_by)
      values (p_workspace_id,p_subject_type,p_subject_id,p_generator_version,1,p_overrides,1,p_mutation_id,auth.uid());
  end if;
  insert into public.v2_visual_applied_ops(workspace_id,mutation_id,subject_type,subject_id,revision)
    values(p_workspace_id,p_mutation_id,p_subject_type,p_subject_id,p_expected_revision+1);
  return jsonb_build_object('applied',true,'conflict',false,'revision',p_expected_revision+1);
end;
$$;
revoke all on function public.v2_visual_json_valid(jsonb) from public;
revoke all on function public.v2_commit_visual_override(uuid,text,uuid,integer,integer,jsonb,uuid) from public;
grant execute on function public.v2_commit_visual_override(uuid,text,uuid,integer,integer,jsonb,uuid) to authenticated;

-- Orphan prevention during legacy V1 reset/delete: deleting a V1 subject clears ONLY
-- its corresponding V2 visual row. V1 RPC contracts and source rows are unchanged.
create or replace function public.v2_cleanup_visual_on_subject_delete()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from public.visual_overrides where workspace_id=old.workspace_id
    and subject_type=tg_argv[0] and subject_id=old.id;
  return old;
end;
$$;
create trigger v2_visual_routine_delete after delete on public.routines
  for each row execute function public.v2_cleanup_visual_on_subject_delete('routine');
create trigger v2_visual_action_delete after delete on public.action_definitions
  for each row execute function public.v2_cleanup_visual_on_subject_delete('action');
create trigger v2_visual_entity_delete after delete on public.entities
  for each row execute function public.v2_cleanup_visual_on_subject_delete('entity');
-- No Realtime publication, cron, edge function, storage, paid plan feature or V1 RPC changes.
