-- House Care — Phase 3 visual home editor, semantic connections and visual targeting.
-- Apply after 20260828111000_phase2_configuration.sql.

alter table public.routine_targets
  add column if not exists include_descendants boolean not null default false;

create table if not exists public.layout_scenes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  scene_kind text not null default 'floor' check (scene_kind in ('floor', 'outdoor')),
  scene_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists layout_scenes_workspace_idx on public.layout_scenes(workspace_id, scene_order);

create table if not exists public.layout_elements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scene_id uuid not null references public.layout_scenes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  layout_role text not null default 'object' check (layout_role in ('area', 'object')),
  shape text not null default 'rect' check (shape in ('rect', 'polygon')),
  x numeric not null default 80,
  y numeric not null default 80,
  width numeric not null default 260 check (width > 0),
  height numeric not null default 180 check (height > 0),
  rotation numeric not null default 0,
  z_index integer not null default 0,
  points jsonb,
  label_position text not null default 'center' check (label_position in ('center', 'top')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists layout_elements_workspace_idx on public.layout_elements(workspace_id);
create index if not exists layout_elements_scene_idx on public.layout_elements(scene_id, z_index);
create index if not exists layout_elements_entity_idx on public.layout_elements(entity_id);
create unique index if not exists layout_elements_active_scene_entity_uidx
  on public.layout_elements(scene_id, entity_id) where archived_at is null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'layout_elements_points_check'
  ) then
    alter table public.layout_elements add constraint layout_elements_points_check
      check (points is null or jsonb_typeof(points) = 'array');
  end if;
end $$;

create table if not exists public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_entity_id uuid not null references public.entities(id) on delete cascade,
  to_entity_id uuid references public.entities(id) on delete cascade,
  target_scene_id uuid references public.layout_scenes(id) on delete cascade,
  relation_kind text not null check (relation_kind in ('door', 'passage', 'stairs', 'link')),
  label text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_entity_id is not null or target_scene_id is not null),
  check (to_entity_id is null or to_entity_id <> from_entity_id)
);
create index if not exists entity_relations_workspace_idx on public.entity_relations(workspace_id);
create index if not exists entity_relations_from_idx on public.entity_relations(from_entity_id);
create index if not exists entity_relations_to_idx on public.entity_relations(to_entity_id);

alter table public.layout_scenes enable row level security;
alter table public.layout_elements enable row level security;
alter table public.entity_relations enable row level security;

create policy "layout_scenes_select" on public.layout_scenes for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "layout_scenes_insert" on public.layout_scenes for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "layout_scenes_update" on public.layout_scenes for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "layout_elements_select" on public.layout_elements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "layout_elements_insert" on public.layout_elements for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "layout_elements_update" on public.layout_elements for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "entity_relations_select" on public.entity_relations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "entity_relations_insert" on public.entity_relations for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "entity_relations_update" on public.entity_relations for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- Phase 2 created this owner-only restore function. Replace it so Phase 3
-- layout data is also cleared during a full JSON restore.
create or replace function public.reset_workspace_content(target_workspace_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only the workspace owner may restore a backup';
  end if;

  delete from public.task_events where workspace_id = target_workspace_id;
  delete from public.task_targets where workspace_id = target_workspace_id;
  delete from public.task_occurrences where workspace_id = target_workspace_id;
  delete from public.routine_targets where workspace_id = target_workspace_id;
  delete from public.routines where workspace_id = target_workspace_id;
  delete from public.action_definitions where workspace_id = target_workspace_id;
  delete from public.supply_events where workspace_id = target_workspace_id;
  delete from public.supplies where workspace_id = target_workspace_id;
  delete from public.entity_relations where workspace_id = target_workspace_id;
  delete from public.layout_elements where workspace_id = target_workspace_id;
  delete from public.layout_scenes where workspace_id = target_workspace_id;
  update public.entities set parent_id = null where workspace_id = target_workspace_id;
  delete from public.entities where workspace_id = target_workspace_id;
  delete from public.entity_types where workspace_id = target_workspace_id;
  delete from public.metadata_field_definitions where workspace_id = target_workspace_id;
  delete from public.workspace_members where workspace_id = target_workspace_id and role <> 'owner';
end;
$$;

revoke all on function public.reset_workspace_content(uuid) from public;
grant execute on function public.reset_workspace_content(uuid) to authenticated;

comment on table public.layout_elements is 'Visual placements only. Semantic home entities and task history remain independent from geometry.';
comment on table public.entity_relations is 'Semantic connections between home entities or a home entity and another layout scene.';
