-- House Care v1.1.2 — task lifecycle integrity and stale-write protection.
-- Safe to run once on an existing v1.1.1 database.

-- Whole-household configuration saves and runtime task mutations use different
-- write paths. Never let an older task snapshot overwrite a newer runtime row.
create or replace function public.prevent_stale_task_occurrence_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.version, 1) < coalesce(old.version, 1) then
    return old;
  end if;

  -- A terminal occurrence can only be reopened by a strictly newer version.
  -- This keeps an equal-version stale snapshot from making completed/skipped
  -- work actionable again while preserving room for an explicit future reopen.
  if old.state in ('completed', 'skipped', 'cancelled')
     and new.state = 'scheduled'
     and coalesce(new.version, 1) <= coalesce(old.version, 1) then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_stale_task_occurrence_update on public.task_occurrences;
create trigger prevent_stale_task_occurrence_update
before update on public.task_occurrences
for each row execute function public.prevent_stale_task_occurrence_update();

-- Repair rows affected by the pre-v1.1.2 race. Immutable lifecycle history wins.
with latest_lifecycle as (
  select distinct on (task_id)
    task_id,
    event_type
  from public.task_events
  where event_type in ('COMPLETED', 'SKIPPED', 'CANCELLED', 'REOPENED')
  order by task_id, event_at desc, id desc
)
update public.task_occurrences t
set state = case latest_lifecycle.event_type
    when 'COMPLETED' then 'completed'
    when 'SKIPPED' then 'skipped'
    when 'CANCELLED' then 'cancelled'
    else t.state
  end,
  version = t.version + 1
from latest_lifecycle
where t.id = latest_lifecycle.task_id
  and t.state = 'scheduled'
  and latest_lifecycle.event_type in ('COMPLETED', 'SKIPPED', 'CANCELLED');

-- A task whose entire target snapshot is complete is completed even if an older
-- save rolled back only the occurrence row and left the target rows intact.
update public.task_occurrences t
set state = 'completed', version = t.version + 1
where t.state = 'scheduled'
  and exists (
    select 1 from public.task_targets tt where tt.task_id = t.id
  )
  and not exists (
    select 1 from public.task_targets tt
    where tt.task_id = t.id and tt.completed_at is null
  );

-- Extra notification defence: cancel stale jobs first, then refuse to schedule
-- a reminder when all targets are already complete even if a future client bug
-- temporarily presents the occurrence as scheduled.
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

  if exists (select 1 from public.task_targets where task_id = target_task_id)
     and not exists (select 1 from public.task_targets where task_id = target_task_id and completed_at is null) then
    return;
  end if;

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

-- Clean up any reminder jobs already attached to terminal tasks.
update public.notification_jobs j
set status = 'cancelled', locked_at = null
from public.task_occurrences t
where j.task_id = t.id
  and t.state <> 'scheduled'
  and j.status in ('pending', 'processing', 'failed');
