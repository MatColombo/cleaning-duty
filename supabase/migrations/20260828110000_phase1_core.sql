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
