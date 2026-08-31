-- House Care v1.2.0 state-consistency corrective pass.
-- 1) Restore-to-today is a first-class transaction, not a version-sensitive Undo.
-- 2) Non-completed occurrences cannot retain a stale task-level completed_at.
-- 3) Remove cleanliness anchors proven to come from stale/undone completion evidence.

create or replace function public.normalize_task_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.state <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_task_completed_at on public.task_occurrences;
create trigger normalize_task_completed_at
before insert or update of state, completed_at on public.task_occurrences
for each row execute function public.normalize_task_completed_at();

-- Repair stale task-level timestamps left on non-completed rows by older clients.
update public.task_occurrences
set completed_at = null,
    version = version + 1
where state <> 'completed'
  and completed_at is not null;

-- Discard current anchors whose source snapshot is not backed by real completion
-- evidence, or whose completion was explicitly reopened. The client canonical
-- engine deterministically reconstructs the prior valid trajectory on next load.
delete from public.health_trajectories h
using public.completion_snapshots c, public.task_occurrences t
where h.last_refresh_completion_id = c.id
  and c.occurrence_id = t.id
  and (
    (
      not exists (
        select 1 from public.task_events e
        where e.task_id = c.occurrence_id
          and e.event_at = c.completed_at
          and (
            e.event_type = 'COMPLETED'
            or (e.event_type = 'TARGET_COMPLETED' and e.metadata->>'entityId' = c.item_id::text)
          )
      )
      and not (t.state = 'completed' and t.completed_at = c.completed_at)
    )
    or exists (
      select 1 from public.task_events e
      where e.task_id = c.occurrence_id
        and e.event_type = 'REOPENED'
        and e.event_at >= c.completed_at
        and coalesce(e.metadata->>'undoType', e.metadata->>'restoreType', '') = 'COMPLETED'
    )
  );

create or replace function public.reopen_task_to_today(
  target_task_id uuid,
  source_event_id uuid,
  event_id uuid,
  event_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.task_occurrences%rowtype;
  source_event public.task_events%rowtype;
  latest_reversible_id uuid;
  source_type text;
  source_at timestamptz;
  actor_member uuid;
  successor_id uuid;
begin
  select * into task_row
  from public.task_occurrences
  where id = target_task_id
  for update;

  if not found or auth.uid() is null or not public.is_workspace_member(task_row.workspace_id) then
    raise exception 'Task is unavailable';
  end if;

  if exists (select 1 from public.task_events where id = event_id) then
    return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version);
  end if;

  if source_event_id is not null then
    select * into source_event
    from public.task_events
    where id = source_event_id
      and task_id = target_task_id;

    if not found or source_event.event_type not in ('COMPLETED', 'SKIPPED', 'POSTPONED') then
      return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
    end if;

    select e.id into latest_reversible_id
    from public.task_events e
    where e.task_id = target_task_id
      and e.event_type in ('COMPLETED', 'SKIPPED', 'POSTPONED', 'REOPENED')
    order by e.event_at desc, e.id desc
    limit 1;

    if latest_reversible_id is distinct from source_event_id then
      return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
    end if;

    source_type := source_event.event_type;
    source_at := source_event.event_at;
  else
    -- Legacy rows may have terminal task state without a corresponding lifecycle
    -- event. Restoring them is still safe because this operation locks and reuses
    -- the existing occurrence instead of creating another one.
    if task_row.state not in ('completed', 'skipped') then
      return jsonb_build_object('applied', false, 'conflict', true, 'actualVersion', task_row.version);
    end if;

    source_type := upper(task_row.state);
    source_at := coalesce(task_row.completed_at, task_row.effective_due_at, task_row.due_at, event_at);
  end if;

  select id into actor_member
  from public.workspace_members
  where workspace_id = task_row.workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;

  if source_type = 'COMPLETED' then
    -- Restoring a fully completed activity means all of its targets are to do again.
    update public.task_targets
    set completed_at = null,
        completed_by_member_id = null
    where task_id = target_task_id;

    -- Remove only live anchors currently owned by this occurrence. Completion
    -- snapshots remain immutable audit records for Analysis/history.
    delete from public.health_trajectories h
    where h.last_refresh_completion_id in (
      select c.id
      from public.completion_snapshots c
      where c.occurrence_id = target_task_id
    );
  end if;

  update public.task_occurrences
  set state = 'scheduled',
      completed_at = null,
      effective_due_at = event_at,
      due_at = event_at,
      version = version + 1
  where id = target_task_id;

  -- Completion-relative routines create a successor as a consequence of Complete
  -- or Skip. Reopening the source retires the currently actionable successor so
  -- the routine cannot expose two simultaneous to-do rows.
  if source_type in ('COMPLETED', 'SKIPPED') and exists (
    select 1 from public.routines r
    where r.id = task_row.routine_id
      and r.schedule_mode = 'after_completion'
  ) then
    for successor_id in
      select id
      from public.task_occurrences
      where routine_id = task_row.routine_id
        and id <> target_task_id
        and state = 'scheduled'
    loop
      update public.task_occurrences
      set state = 'cancelled', version = version + 1
      where id = successor_id;

      insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
      values (
        gen_random_uuid(), task_row.workspace_id, successor_id, 'CANCELLED', event_at, actor_member,
        jsonb_build_object('reason', 'restore_to_today_successor', 'restoreOf', source_event_id)
      );
    end loop;
  end if;

  insert into public.task_events(id, workspace_id, task_id, event_type, event_at, actor_member_id, metadata)
  values (
    event_id, task_row.workspace_id, target_task_id, 'REOPENED', event_at, actor_member,
    jsonb_build_object('restoreOf', source_event_id, 'restoreType', source_type, 'restoreSourceAt', source_at, 'reason', 'restore_to_today')
  );

  return jsonb_build_object('applied', true, 'conflict', false, 'actualVersion', task_row.version + 1);
end;
$$;

revoke all on function public.reopen_task_to_today(uuid,uuid,uuid,timestamptz) from public;
grant execute on function public.reopen_task_to_today(uuid,uuid,uuid,timestamptz) to authenticated;
