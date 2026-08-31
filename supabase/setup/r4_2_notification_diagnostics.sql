-- House Care v1.2.0 r4.2 notification diagnostics (read-only).
-- Run in Supabase SQL Editor if a reminder still does not arrive.

-- 1) Current job pipeline by status.
select status, count(*) as jobs
from public.notification_jobs
group by status
order by status;

-- 2) Latest reminder jobs with assignment and failure context.
select
  j.created_at,
  j.deliver_at,
  j.status,
  j.attempts,
  j.last_error,
  t.routine_name_snapshot,
  t.action_name_snapshot,
  t.assignment_scope,
  t.assignee_member_id,
  m.display_name as recipient,
  j.sent_at
from public.notification_jobs j
join public.task_occurrences t on t.id = j.task_id
join public.workspace_members m on m.id = j.member_id
order by j.created_at desc
limit 40;

-- 3) Device subscriptions. disabled_at must be null for an eligible device.
select
  p.created_at,
  p.last_seen_at,
  p.disabled_at,
  m.display_name as member,
  left(p.endpoint, 70) as endpoint_prefix
from public.push_subscriptions p
join public.workspace_members m on m.id = p.member_id
order by p.last_seen_at desc;
