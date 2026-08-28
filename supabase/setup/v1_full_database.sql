-- House Care v1.0 - complete database setup for a FRESH Supabase project
-- Browser-only deployment helper. Run this entire file once in Supabase SQL Editor.
-- Generated from the six versioned migrations in strict order.


-- ============================================================================
-- BEGIN: supabase/migrations/20260828110000_phase1_core.sql
-- ============================================================================
-- House Care — Phase 1 core schema
-- Apply to a fresh Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null default 'Europe/Rome',
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create unique index if not exists workspace_members_invite_email_unique
  on public.workspace_members (workspace_id, lower(email)) where email is not null;
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.owner_user_id = auth.uid()
  );
$$;

create or replace function public.claim_workspace_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare
  claimed integer := 0;
  account_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or account_email = '' then return 0; end if;
  update public.workspace_members
     set user_id = auth.uid(), status = 'active'
   where user_id is null
     and status = 'invited'
     and lower(coalesce(email, '')) = account_email;
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.claim_workspace_invites() from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.claim_workspace_invites() to authenticated;

create table if not exists public.entity_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  icon text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists entity_types_workspace_idx on public.entity_types(workspace_id);

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type_id uuid not null references public.entity_types(id) on delete restrict,
  parent_id uuid references public.entities(id) on delete restrict,
  name text not null,
  labels text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index if not exists entities_workspace_idx on public.entities(workspace_id);
create index if not exists entities_parent_idx on public.entities(parent_id);

create table if not exists public.action_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  icon text,
  instructions text,
  revision integer not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists action_definitions_workspace_idx on public.action_definitions(workspace_id);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  action_id uuid not null references public.action_definitions(id) on delete restrict,
  recurrence jsonb not null,
  time_of_day time not null,
  assignment jsonb not null,
  revision integer not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists routines_workspace_idx on public.routines(workspace_id);

create table if not exists public.routine_targets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete restrict,
  primary key (routine_id, entity_id)
);
create index if not exists routine_targets_workspace_idx on public.routine_targets(workspace_id);

create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete restrict,
  routine_revision integer not null,
  routine_name_snapshot text not null,
  action_name_snapshot text not null,
  original_due_at timestamptz not null,
  due_at timestamptz not null,
  state text not null default 'scheduled' check (state in ('scheduled', 'completed', 'skipped', 'cancelled')),
  assignee_member_id uuid references public.workspace_members(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (routine_id, routine_revision, original_due_at)
);
create index if not exists task_occurrences_workspace_due_idx on public.task_occurrences(workspace_id, due_at);
create index if not exists task_occurrences_assignee_due_idx on public.task_occurrences(assignee_member_id, due_at);

create table if not exists public.task_targets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.task_occurrences(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete restrict,
  entity_name_snapshot text not null,
  entity_type_name_snapshot text not null,
  primary key (task_id, entity_id)
);
create index if not exists task_targets_workspace_idx on public.task_targets(workspace_id);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.task_occurrences(id) on delete cascade,
  event_type text not null check (event_type in ('TASK_CREATED','ASSIGNED','POSTPONED','REASSIGNED','COMPLETED','SKIPPED','REOPENED','CANCELLED')),
  event_at timestamptz not null default now(),
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  metadata jsonb not null default '{}'
);
create index if not exists task_events_task_idx on public.task_events(task_id, event_at);
create index if not exists task_events_workspace_idx on public.task_events(workspace_id, event_at);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.entity_types enable row level security;
alter table public.entities enable row level security;
alter table public.action_definitions enable row level security;
alter table public.routines enable row level security;
alter table public.routine_targets enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.task_targets enable row level security;
alter table public.task_events enable row level security;

create policy "workspace_select" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id) or owner_user_id = auth.uid());
create policy "workspace_insert" on public.workspaces for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "workspace_update_owner" on public.workspaces for update to authenticated
  using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

create policy "members_select" on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id) or user_id = auth.uid());
create policy "members_insert_owner" on public.workspace_members for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));
create policy "members_update_owner" on public.workspace_members for update to authenticated
  using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

create policy "entity_types_select" on public.entity_types for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "entity_types_insert" on public.entity_types for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "entity_types_update" on public.entity_types for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "entities_select" on public.entities for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "entities_insert" on public.entities for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "entities_update" on public.entities for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "actions_select" on public.action_definitions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "actions_insert" on public.action_definitions for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "actions_update" on public.action_definitions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "routines_select" on public.routines for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "routines_insert" on public.routines for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "routines_update" on public.routines for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "routine_targets_select" on public.routine_targets for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "routine_targets_insert" on public.routine_targets for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "routine_targets_delete" on public.routine_targets for delete to authenticated using (public.is_workspace_member(workspace_id));

create policy "tasks_select" on public.task_occurrences for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "tasks_insert" on public.task_occurrences for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "tasks_update" on public.task_occurrences for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "task_targets_select" on public.task_targets for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "task_targets_insert" on public.task_targets for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "task_events_select" on public.task_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "task_events_insert" on public.task_events for insert to authenticated with check (public.is_workspace_member(workspace_id));

comment on table public.task_events is 'Append-only audit stream. No UPDATE or DELETE policy is intentionally provided.';
comment on table public.task_targets is 'Immutable target snapshot for a generated task. No UPDATE or DELETE policy is intentionally provided.';

-- END: supabase/migrations/20260828110000_phase1_core.sql

-- ============================================================================
-- BEGIN: supabase/migrations/20260828111000_phase2_configuration.sql
-- ============================================================================
-- House Care — Phase 2 configuration, recurrence, supplies, metadata and backup restore.
-- Apply after 20260828110000_phase1_core.sql.

alter table public.entities
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.action_definitions
  add column if not exists default_supply_ids jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.routines
  add column if not exists schedule_mode text not null default 'fixed',
  add column if not exists schedule_exceptions jsonb not null default '{"excludedDates":[],"includedDateTimes":[]}'::jsonb,
  add column if not exists reminder jsonb not null default '{"mode":"none"}'::jsonb,
  add column if not exists supply_ids_override jsonb;

alter table public.task_occurrences
  add column if not exists supplies_snapshot jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'routines_schedule_mode_check'
  ) then
    alter table public.routines add constraint routines_schedule_mode_check
      check (schedule_mode in ('fixed', 'after_completion'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'actions_default_supply_ids_array_check'
  ) then
    alter table public.action_definitions add constraint actions_default_supply_ids_array_check
      check (jsonb_typeof(default_supply_ids) = 'array');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'routines_supply_ids_override_array_check'
  ) then
    alter table public.routines add constraint routines_supply_ids_override_array_check
      check (supply_ids_override is null or jsonb_typeof(supply_ids_override) = 'array');
  end if;
end $$;

create table if not exists public.metadata_field_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target text not null check (target in ('entity', 'action', 'supply')),
  name text not null check (char_length(name) between 1 and 120),
  field_type text not null check (field_type in ('text', 'number', 'boolean', 'choice', 'multi_choice')),
  options text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists metadata_field_definitions_workspace_idx on public.metadata_field_definitions(workspace_id);

create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  icon text,
  status text not null default 'available' check (status in ('available', 'low', 'reserve_only', 'out_of_stock')),
  quantity numeric,
  unit text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists supplies_workspace_idx on public.supplies(workspace_id);
create index if not exists supplies_workspace_status_idx on public.supplies(workspace_id, status) where archived_at is null;

create table if not exists public.supply_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete cascade,
  event_type text not null check (event_type in ('SUPPLY_CREATED','SUPPLY_UPDATED','STOCK_CHANGED','SUPPLY_ARCHIVED')),
  event_at timestamptz not null default now(),
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists supply_events_supply_idx on public.supply_events(supply_id, event_at);
create index if not exists supply_events_workspace_idx on public.supply_events(workspace_id, event_at);

alter table public.metadata_field_definitions enable row level security;
alter table public.supplies enable row level security;
alter table public.supply_events enable row level security;

create policy "metadata_fields_select" on public.metadata_field_definitions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "metadata_fields_insert" on public.metadata_field_definitions for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "metadata_fields_update" on public.metadata_field_definitions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "supplies_select" on public.supplies for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "supplies_insert" on public.supplies for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "supplies_update" on public.supplies for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "supply_events_select" on public.supply_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "supply_events_insert" on public.supply_events for insert to authenticated with check (public.is_workspace_member(workspace_id));

comment on table public.supply_events is 'Append-only supply history. No direct UPDATE or DELETE policy is provided.';

-- Backup import needs an owner-only reset operation. Keeping this behind a
-- SECURITY DEFINER function avoids granting general DELETE access to the PWA.
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
  update public.entities set parent_id = null where workspace_id = target_workspace_id;
  delete from public.entities where workspace_id = target_workspace_id;
  delete from public.entity_types where workspace_id = target_workspace_id;
  delete from public.metadata_field_definitions where workspace_id = target_workspace_id;
  delete from public.workspace_members where workspace_id = target_workspace_id and role <> 'owner';
end;
$$;

revoke all on function public.reset_workspace_content(uuid) from public;
grant execute on function public.reset_workspace_content(uuid) to authenticated;

-- END: supabase/migrations/20260828111000_phase2_configuration.sql

-- ============================================================================
-- BEGIN: supabase/migrations/20260828112000_phase3_visual_home.sql
-- ============================================================================
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

-- END: supabase/migrations/20260828112000_phase3_visual_home.sql

-- ============================================================================
-- BEGIN: supabase/migrations/20260828113000_phase4_pwa_notifications.sql
-- ============================================================================
-- House Care — Phase 4 push scheduling, optimistic mutations, and offline sync support.
-- Apply after 20260828112000_phase3_visual_home.sql.

alter table public.supplies add column if not exists version integer not null default 1;

alter table public.task_events drop constraint if exists task_events_event_type_check;
alter table public.task_events add constraint task_events_event_type_check
  check (event_type in ('TASK_CREATED','ASSIGNED','POSTPONED','REASSIGNED','COMPLETED','SKIPPED','REOPENED','CANCELLED','NOTIFIED','NOTIFICATION_FAILED'));


create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index if not exists push_subscriptions_member_idx on public.push_subscriptions(member_id) where disabled_at is null;

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.task_occurrences(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  kind text not null check (kind in ('at_due','offset','previous_day')),
  deliver_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','cancelled','failed')),
  attempts integer not null default 0,
  locked_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_jobs_due_idx on public.notification_jobs(status, deliver_at);
create index if not exists notification_jobs_task_idx on public.notification_jobs(task_id);

alter table public.push_subscriptions enable row level security;
alter table public.notification_jobs enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.id = member_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "push_subscriptions_insert_own" on public.push_subscriptions for insert to authenticated
  with check (exists (select 1 from public.workspace_members m where m.id = member_id and m.user_id = auth.uid() and m.status = 'active' and m.workspace_id = workspace_id));
create policy "push_subscriptions_update_own" on public.push_subscriptions for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.id = member_id and m.user_id = auth.uid() and m.status = 'active'))
  with check (exists (select 1 from public.workspace_members m where m.id = member_id and m.user_id = auth.uid() and m.status = 'active' and m.workspace_id = workspace_id));
create policy "notification_jobs_select" on public.notification_jobs for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.schedule_notification_for_task(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  routine_row public.routines%rowtype;
  workspace_tz text;
  reminder_mode text;
  reminder_time time;
  delivery timestamptz;
begin
  select * into task_row from public.task_occurrences where id = target_task_id;
  if not found then return; end if;

  update public.notification_jobs
    set status = 'cancelled', locked_at = null
    where task_id = target_task_id and status in ('pending','processing','failed');

  if task_row.state <> 'scheduled' or task_row.assignee_member_id is null then return; end if;

  select * into routine_row from public.routines where id = task_row.routine_id;
  if not found then return; end if;
  reminder_mode := coalesce(routine_row.reminder->>'mode', 'none');
  if reminder_mode = 'none' then return; end if;

  if reminder_mode = 'at_due' then
    delivery := task_row.due_at;
  elsif reminder_mode = 'offset' then
    delivery := task_row.due_at - make_interval(mins => greatest(0, coalesce((routine_row.reminder->>'minutesBefore')::integer, 0)));
  elsif reminder_mode = 'previous_day' then
    select timezone into workspace_tz from public.workspaces where id = task_row.workspace_id;
    reminder_time := coalesce(nullif(routine_row.reminder->>'time', '')::time, (task_row.due_at at time zone workspace_tz)::time);
    delivery := (((task_row.due_at at time zone workspace_tz)::date - 1)::timestamp + reminder_time) at time zone workspace_tz;
  else
    return;
  end if;

  insert into public.notification_jobs(workspace_id, task_id, member_id, kind, deliver_at)
  values (task_row.workspace_id, task_row.id, task_row.assignee_member_id, reminder_mode, delivery);
end;
$$;

revoke all on function public.schedule_notification_for_task(uuid) from public;

create or replace function public.task_notification_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.due_at is not distinct from old.due_at
     and new.state is not distinct from old.state
     and new.assignee_member_id is not distinct from old.assignee_member_id
     and new.routine_id is not distinct from old.routine_id then
    return new;
  end if;
  perform public.schedule_notification_for_task(new.id);
  return new;
end;
$$;

drop trigger if exists task_notification_refresh on public.task_occurrences;
create trigger task_notification_refresh
after insert or update of due_at, state, assignee_member_id, routine_id on public.task_occurrences
for each row execute function public.task_notification_refresh_trigger();

create or replace function public.routine_notification_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare task_id uuid;
begin
  if new.reminder is not distinct from old.reminder then return new; end if;
  for task_id in select id from public.task_occurrences where routine_id = new.id and state = 'scheduled' loop
    perform public.schedule_notification_for_task(task_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists routine_notification_refresh on public.routines;
create trigger routine_notification_refresh
after update of reminder on public.routines
for each row execute function public.routine_notification_refresh_trigger();

-- Backfill jobs for already-materialized scheduled tasks.
do $$ declare task_id uuid; begin
  for task_id in select id from public.task_occurrences where state = 'scheduled' loop
    perform public.schedule_notification_for_task(task_id);
  end loop;
end $$;

create or replace function public.apply_task_mutation(
  target_task_id uuid,
  expected_version integer,
  mutation_kind text,
  event_id uuid,
  event_at timestamptz,
  new_due_at timestamptz default null,
  new_assignee_member_id uuid default null,
  clear_assignee boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  actor_member uuid;
  event_type text;
  event_metadata jsonb := '{}'::jsonb;
begin
  select * into task_row from public.task_occurrences where id = target_task_id for update;
  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then
    raise exception 'Task is unavailable';
  end if;
  if exists (select 1 from public.task_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version);
  end if;
  if task_row.version <> expected_version then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;
  if task_row.state <> 'scheduled' then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
  end if;
  select id into actor_member from public.workspace_members
    where workspace_id = task_row.workspace_id and user_id = auth.uid() and status = 'active' limit 1;

  if mutation_kind = 'complete' then
    update public.task_occurrences set state = 'completed', version = version + 1 where id = target_task_id;
    event_type := 'COMPLETED';
  elsif mutation_kind = 'skip' then
    update public.task_occurrences set state = 'skipped', version = version + 1 where id = target_task_id;
    event_type := 'SKIPPED';
  elsif mutation_kind = 'postpone' then
    if new_due_at is null then raise exception 'new_due_at is required'; end if;
    event_metadata := jsonb_build_object('from', task_row.due_at, 'to', new_due_at);
    update public.task_occurrences set due_at = new_due_at, version = version + 1 where id = target_task_id;
    event_type := 'POSTPONED';
  elsif mutation_kind = 'reassign' then
    if not clear_assignee and new_assignee_member_id is not null and not exists (
      select 1 from public.workspace_members where id = new_assignee_member_id and workspace_id = task_row.workspace_id and status = 'active'
    ) then raise exception 'Assignee is unavailable'; end if;
    event_metadata := jsonb_build_object('from', task_row.assignee_member_id, 'to', case when clear_assignee then null else new_assignee_member_id end);
    update public.task_occurrences
      set assignee_member_id = case when clear_assignee then null else new_assignee_member_id end, version = version + 1
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
revoke all on function public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,uuid,boolean) from public;
grant execute on function public.apply_task_mutation(uuid,integer,text,uuid,timestamptz,timestamptz,uuid,boolean) to authenticated;

create or replace function public.apply_supply_status_mutation(
  target_supply_id uuid,
  expected_version integer,
  new_status text,
  event_id uuid,
  event_at timestamptz,
  source_task_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  supply_row public.supplies%rowtype;
  actor_member uuid;
begin
  select * into supply_row from public.supplies where id = target_supply_id for update;
  if not found or supply_row.archived_at is not null or auth.uid() is null or not public.is_workspace_member(supply_row.workspace_id) then raise exception 'Supply is unavailable'; end if;
  if exists (select 1 from public.supply_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', supply_row.version);
  end if;
  if supply_row.version <> expected_version then
    return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', supply_row.version);
  end if;
  if new_status not in ('available','low','reserve_only','out_of_stock') then raise exception 'Invalid stock status'; end if;
  select id into actor_member from public.workspace_members where workspace_id = supply_row.workspace_id and user_id = auth.uid() and status = 'active' limit 1;
  update public.supplies set status = new_status, version = version + 1 where id = target_supply_id;
  insert into public.supply_events(id, workspace_id, supply_id, event_type, event_at, actor_member_id, metadata)
  values (event_id, supply_row.workspace_id, supply_row.id, 'STOCK_CHANGED', event_at, actor_member,
    jsonb_build_object('from', supply_row.status, 'to', new_status, 'sourceTaskId', source_task_id))
  on conflict (id) do nothing;
  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', expected_version + 1);
end;
$$;
revoke all on function public.apply_supply_status_mutation(uuid,integer,text,uuid,timestamptz,uuid) from public;
grant execute on function public.apply_supply_status_mutation(uuid,integer,text,uuid,timestamptz,uuid) to authenticated;

-- Phase 4 runtime notification jobs are derived and are not part of JSON backup.
create or replace function public.reset_workspace_content(target_workspace_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only the workspace owner may restore a backup';
  end if;
  delete from public.notification_jobs where workspace_id = target_workspace_id;
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

-- END: supabase/migrations/20260828113000_phase4_pwa_notifications.sql

-- ============================================================================
-- BEGIN: supabase/migrations/20260828114000_phase5_advanced_rules.sql
-- ============================================================================
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

-- END: supabase/migrations/20260828114000_phase5_advanced_rules.sql

-- ============================================================================
-- BEGIN: supabase/migrations/20260828115000_v1_hardening.sql
-- ============================================================================
-- House Care v1.0 — Phase 6 hardening and care tuning.

alter table public.workspaces
  add column if not exists care_sensitivity text not null default 'balanced';

alter table public.workspaces drop constraint if exists workspaces_care_sensitivity_check;
alter table public.workspaces add constraint workspaces_care_sensitivity_check
  check (care_sensitivity in ('relaxed', 'balanced', 'strict'));

-- Read-heavy indexes for the v1 audit/insights screen and household cockpit.
create index if not exists task_occurrences_workspace_state_due_idx
  on public.task_occurrences(workspace_id, state, due_at);
create index if not exists task_events_workspace_type_at_idx
  on public.task_events(workspace_id, event_type, event_at desc);
create index if not exists supply_events_workspace_supply_at_idx
  on public.supply_events(workspace_id, supply_id, event_at desc);

comment on column public.workspaces.care_sensitivity is
  'UI-only tuning for the derived care estimate. It never changes routine schedules or historical task state.';

-- END: supabase/migrations/20260828115000_v1_hardening.sql
