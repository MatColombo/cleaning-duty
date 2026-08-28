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
