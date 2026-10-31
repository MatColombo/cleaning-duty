# House Care V1 — recovery and overdue consolidation patch (candidate)

Based on uploaded source v1.2.1-r4. Contains modified source files only.

## Changes
- Guards numeric cleanliness trajectory scores against NaN.
- Excludes secondary routines from current and historical cleanliness.
- Preserves routine targets on failed upsert by upserting BEFORE selective cleanup; refuses all-empty target snapshots when database already has targets.
- Reconciles newer persisted completion snapshots into stale in-memory health trajectories.
- For fixed-calendar routines, hides all older due scheduled instances in Today and Overview and allows completing the newest due instance to close earlier scheduled instances, with audit events and **no additional cleanliness refresh**. Does not consolidate future, secondary or after-completion tasks.
- Regression test for fixed-schedule grouping.

## Important limitations — DO NOT deploy blindly
- There is no database-side transaction/optimistic concurrency guard for target cleanup: cross-device stale full workspace saves can still overwrite valid target changes. A proper Supabase RPC transaction/row revision is required for full protection.
- Health trajectory concurrent writes are not yet version-guarded at the database level. Reconciliation from snapshots only works when an applied completion snapshot exists.
- Auto-completed older task records are counted as completed in existing historical analytics; add a reporting exclusion if needed.
- The backlog display filter is applied to Today and Overview, not all ancillary counts/room widgets.
- Automated test for occurrence grouping passed with system TypeScript. Full Vite build and full suite not executed (dependencies not available in uploaded ZIP).
- Existing cloud data still needs backups and one-time reconciliation of incomplete historical records.

## Deployment
1. Merge carefully with any production patches after v1.2.1-r4.
2. Install dependencies and run npm run typecheck, npm test, npm run build.
3. Check Today and Overview for fixed schedules with multiple missed occurrences, and ensure only the newest remains actionable.
4. Complete the newest and inspect task_events (automaticBacklogClosure: true), task_occurrences and health_trajectories.
5. Check secondary routines, Regular and Deep values, multi-device sync, offline replay and Undo.
6. Do not deploy until integration tests and concurrency safeguards are satisfactory.
