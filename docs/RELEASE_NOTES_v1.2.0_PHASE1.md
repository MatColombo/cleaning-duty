# House Care v1.2.0 — Phase 1 foundation

Phase 1 implements the canonical state and Cleanliness Engine v2 from `v1.2.0_FLOW_AND_FINISH_SPEC.md`. It intentionally does not implement the Overview, Home room-flow, Analysis, or brand/appearance phases yet.

## Implemented

- Immutable theoretical `scheduled_slot_at` separated from mutable `effective_due_at`.
- Canonical Regular/Deep cleanliness trajectories independent from occurrence counts.
- Exact v1.2 pre-due 10% floor and overdue 10→0 linear decay.
- `refresh_level_pct` model and auditable completion snapshots.
- Refresh no-op rule: a completion below current cleanliness records history but does not move the trajectory.
- Equal-per-item room/home aggregation and minimum-score handling for multiple same-channel routines.
- Paused/ended routines excluded from active cleanliness calculations.
- Completion/Skip/Reschedule runtime mutations preserve the v1.2 health semantics.
- A database monotonicity guard prevents an older cross-device household save from rolling health behind a newer completion.
- Deterministic/idempotent migration of existing completion history into canonical health trajectories.
- Existing documented product behavior retained: Deep completion can also refresh Regular care for the same physical item; Regular completion never refreshes Deep.
- Notifications use `effective_due_at`; one-off movement never changes `scheduled_slot_at`.
- Backup schema v8.

## Verification

The Phase 1 acceptance suite covers the v1.2 formula, Refresh-to behavior, occurrence independence, aggregate weighting, pause exclusion, DST, month-length recurrence, migration idempotency, and task materialization idempotency.
