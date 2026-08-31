-- House Care v1.2.0 r4.2: deterministic notification-job repair.
-- Run after 20260831203000_v1_2_0_everyone_notifications.sql.
--
-- r4 introduced per-occurrence assignment scopes, but did not rebuild all
-- already-materialized scheduled reminders after changing scheduler semantics.
-- This migration refreshes every active scheduled occurrence so both specific
-- member and Everyone/household reminders start from a clean pending job set.

create or replace function public.schedule_notification_for_task(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  task_row public.task_occurrences%rowtype;
  routine_row public.routines%rowtype;
  workspace_tz text;
  reminder_mode text;
  reminder_time time;
  delivery timestamptz;
  execution_due timestamptz;
  resolved_scope text;
  recipient_id uuid;
begin
  select * into task_row from public.task_occurrences where id = target_task_id;
  if not found then return; end if;

  -- Any unsent job for this occurrence is derived state. Replace it rather than
  -- carrying retry counters or an obsolete recipient forward.
  update public.notification_jobs
     set status = 'cancelled', locked_at = null
   where task_id = target_task_id
     and status in ('pending','processing','failed');

  if task_row.state <> 'scheduled' then return; end if;
  if exists (select 1 from public.task_targets where task_id = target_task_id)
     and not exists (select 1 from public.task_targets where task_id = target_task_id and completed_at is null) then return; end if;

  select * into routine_row from public.routines where id = task_row.routine_id;
  if not found or coalesce(routine_row.status, 'active') <> 'active' then return; end if;

  reminder_mode := coalesce(routine_row.reminder->>'mode', 'none');
  if reminder_mode = 'none' then return; end if;

  execution_due := coalesce(task_row.effective_due_at, task_row.due_at);
  if execution_due is null then return; end if;

  if reminder_mode = 'at_due' then
    delivery := execution_due;
  elsif reminder_mode = 'offset' then
    delivery := execution_due - make_interval(mins => greatest(0, coalesce((routine_row.reminder->>'minutesBefore')::integer, 0)));
  elsif reminder_mode = 'previous_day' then
    workspace_tz := coalesce(routine_row.routine_timezone, (select timezone from public.workspaces where id = task_row.workspace_id), 'UTC');
    reminder_time := coalesce(nullif(routine_row.reminder->>'time', '')::time, (execution_due at time zone workspace_tz)::time);
    delivery := (((execution_due at time zone workspace_tz)::date - 1)::timestamp + reminder_time) at time zone workspace_tz;
  else
    return;
  end if;

  resolved_scope := coalesce(nullif(task_row.assignment_scope, ''), case when task_row.assignee_member_id is null then 'unassigned' else 'member' end);

  if resolved_scope = 'member' then
    if task_row.assignee_member_id is null then return; end if;
    if not exists (
      select 1 from public.workspace_members
       where id = task_row.assignee_member_id
         and workspace_id = task_row.workspace_id
         and status = 'active'
         and user_id is not null
    ) then return; end if;

    insert into public.notification_jobs(workspace_id, task_id, member_id, kind, deliver_at)
    values (task_row.workspace_id, task_row.id, task_row.assignee_member_id, reminder_mode, delivery);

  elsif resolved_scope = 'everyone' then
    for recipient_id in
      select id
        from public.workspace_members
       where workspace_id = task_row.workspace_id
         and status = 'active'
         and user_id is not null
       order by created_at, id
    loop
      insert into public.notification_jobs(workspace_id, task_id, member_id, kind, deliver_at)
      values (task_row.workspace_id, task_row.id, recipient_id, reminder_mode, delivery);
    end loop;
  end if;
end;
$$;
revoke all on function public.schedule_notification_for_task(uuid) from public;

-- Rebuild reminder jobs for every currently materialized scheduled occurrence.
-- schedule_notification_for_task is idempotent for unsent jobs because it first
-- cancels the existing derived jobs for that task and creates the authoritative
-- recipient set again with attempts = 0.
do $$
declare
  task_id uuid;
begin
  for task_id in
    select t.id
      from public.task_occurrences t
      join public.routines r on r.id = t.routine_id
     where t.state = 'scheduled'
       and coalesce(r.status, 'active') = 'active'
       and coalesce(r.reminder->>'mode', 'none') <> 'none'
     order by t.created_at, t.id
  loop
    perform public.schedule_notification_for_task(task_id);
  end loop;
end $$;
