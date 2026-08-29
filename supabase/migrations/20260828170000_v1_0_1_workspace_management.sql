-- House Care v1.0.1 — multi-home management
-- Adds workspace archive/restore/delete support for existing v1 deployments.

alter table public.workspaces
  add column if not exists archived_at timestamptz;

create index if not exists workspaces_owner_archived_idx
  on public.workspaces(owner_user_id, archived_at);

create or replace function public.archive_workspace(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only the household owner can archive this household.' using errcode = '42501';
  end if;

  update public.workspaces
     set archived_at = now()
   where id = target_workspace_id;

  -- Archived households must not continue producing push reminders.
  update public.notification_jobs
     set status = 'cancelled', locked_at = null
   where workspace_id = target_workspace_id
     and status in ('pending', 'processing', 'failed');
end;
$$;

create or replace function public.restore_workspace(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row record;
begin
  if auth.uid() is null or not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only the household owner can restore this household.' using errcode = '42501';
  end if;

  update public.workspaces
     set archived_at = null
   where id = target_workspace_id;

  -- Recreate reminder jobs for still-open tasks after restoration.
  for task_row in
    select id from public.task_occurrences
     where workspace_id = target_workspace_id and state = 'scheduled'
  loop
    perform public.schedule_notification_for_task(task_row.id);
  end loop;
end;
$$;

create or replace function public.delete_workspace_permanently(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only the household owner can delete this household.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.workspaces
     where id = target_workspace_id and archived_at is not null
  ) then
    raise exception 'Archive the household before deleting it permanently.' using errcode = '22023';
  end if;

  -- Explicit dependency order keeps permanent deletion reliable even where
  -- child tables also contain RESTRICT references to other workspace rows.
  delete from public.notification_jobs where workspace_id = target_workspace_id;
  delete from public.push_subscriptions where workspace_id = target_workspace_id;
  delete from public.task_events where workspace_id = target_workspace_id;
  delete from public.task_targets where workspace_id = target_workspace_id;
  delete from public.task_occurrences where workspace_id = target_workspace_id;
  delete from public.routine_targets where workspace_id = target_workspace_id;
  delete from public.routines where workspace_id = target_workspace_id;
  delete from public.supply_events where workspace_id = target_workspace_id;
  delete from public.supplies where workspace_id = target_workspace_id;
  delete from public.entity_relations where workspace_id = target_workspace_id;
  delete from public.layout_elements where workspace_id = target_workspace_id;
  delete from public.layout_scenes where workspace_id = target_workspace_id;
  delete from public.metadata_field_definitions where workspace_id = target_workspace_id;
  delete from public.action_definitions where workspace_id = target_workspace_id;
  update public.entities set parent_id = null where workspace_id = target_workspace_id;
  delete from public.entities where workspace_id = target_workspace_id;
  delete from public.entity_types where workspace_id = target_workspace_id;
  delete from public.workspace_members where workspace_id = target_workspace_id;
  delete from public.workspaces where id = target_workspace_id;
end;
$$;

revoke all on function public.archive_workspace(uuid) from public;
revoke all on function public.restore_workspace(uuid) from public;
revoke all on function public.delete_workspace_permanently(uuid) from public;
grant execute on function public.archive_workspace(uuid) to authenticated;
grant execute on function public.restore_workspace(uuid) to authenticated;
grant execute on function public.delete_workspace_permanently(uuid) to authenticated;
