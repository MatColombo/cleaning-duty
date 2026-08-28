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
