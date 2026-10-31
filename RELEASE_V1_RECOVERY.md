# V1 recovery candidate + routine reactivation

Based on `cleaning-duty-main (1).zip` with the previous `house-care-v1-recovery-candidate.zip` overlay.

## UI change
Routines page now shows **Riattiva / Reactivate** for non-archived routines with `status = ended`. Uses existing `setRoutineStatus(id, 'active')`. It restores the linked routines' status too (existing behavior), preserves historical cancelled/completed occurrences, and schedules future occurrences through the current scheduler. Archived routines are NOT restored.

## SQL migration
`supabase/migrations/20261031191500_v1_safety_guards.sql`:
- prevents deletion of the last routine target in a workspace with active recurring routines (fails closed; deliberate removal of all targets must first deactivate routines / disable guard with an administrator)
- guards against health trajectories with due <= anchor on new writes (NOT VALID to avoid rejecting historical rows)
- rejects new trajectory writes for secondary routines; does not delete historic rows.

## Known limitations / release gate
- SQL does NOT make the existing multi-request client save atomic. Safe atomic persistence requires a versioned RPC + client integration and a multi-client test; do not call this an all-problems fix.
- The previous recovery candidate requires full regression tests and production-like build. The older candidate has not been verified for every UI view, undo, concurrency or offline sync.
- Existing stale trajectories must be reconciled separately; the migration does not fabricate completion events, restore missing target associations or update percentages.
- The last-target trigger can intentionally reject some valid edits; test routine editing, deletion, restoration and workspace cleanup on staging before production.
- Existing `setRoutineStatus` reactivation affects linked children; confirm this matches the intended product semantics.

## Suggested deployment sequence
1. Backup, staging clone, verify migrated schema.
2. Apply migration on staging, inspect constraints and test editing / deletion of targets.
3. Run `npm ci && npm run typecheck && npm test && npm run build` in CI or developer environment.
4. Verify end/reactivate routine, scheduled slots, backlog coalescing, undo, secondary cleaning, two-device race and offline sync.
5. Deploy code and migration only after passing these gates.
