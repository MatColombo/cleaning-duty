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
