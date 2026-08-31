-- v1.2.0 corrective notification repair.
-- Keep reminder jobs aligned with effective execution time and rebuild pending
-- jobs for active scheduled occurrences after the v1.2 upgrade.

create or replace function public.task_notification_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.effective_due_at is not distinct from old.effective_due_at
     and new.due_at is not distinct from old.due_at
     and new.state is not distinct from old.state
     and new.assignee_member_id is not distinct from old.assignee_member_id
     and new.routine_id is not distinct from old.routine_id then return new; end if;
  perform public.schedule_notification_for_task(new.id);
  return new;
end;
$$;

drop trigger if exists task_notification_refresh on public.task_occurrences;
create trigger task_notification_refresh
after insert or update of effective_due_at, due_at, state, assignee_member_id, routine_id on public.task_occurrences
for each row execute function public.task_notification_refresh_trigger();

-- Rebuild current pending jobs idempotently. schedule_notification_for_task first
-- cancels any prior pending/processing/failed job for the same occurrence.
do $$
declare task_id uuid;
begin
  for task_id in
    select t.id
    from public.task_occurrences t
    join public.routines r on r.id = t.routine_id
    where t.state = 'scheduled'
      and t.assignee_member_id is not null
      and coalesce(r.status, 'active') = 'active'
  loop
    perform public.schedule_notification_for_task(task_id);
  end loop;
end $$;
