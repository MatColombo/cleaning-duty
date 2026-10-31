# House Care V1 — target integrity repair candidate

## Status
Code-review candidate; NOT tested end-to-end against production. No database was changed by this package. `npm install` could not complete in the execution environment, so build and test are NOT verified.

## Why this patch
- Previously ordinary saves compared a whole in-memory workspace snapshot to `routine_targets`, then deleted whatever was missing.
- A stale, partially hydrated or outdated client could therefore remove many valid links.
- The prior SQL guard could not reliably protect every routine, and did not establish atomic/version-checked writes.
- Existing health trajectory hotfix continues to avoid writes for linked (secondary) routines.

## Migration and release order
1. Back up `routine_targets`, `routines`, `health_trajectories`, `completion_snapshots`, `task_occurrences`, `task_targets`.
2. Use staging with restored realistic data; run `20261031220000_v1_target_compare_and_swap.sql`.
3. Install dependencies; run `npm run build` and `npm test`. Exercise editing targets, saving a completion, undo, reactivation, two-device collision, linked routine.
4. Ensure ALL live clients load fresh data after deployment. The old client may still attempt direct deletes: SQL rejects them rather than silently deleting data.
5. After deploying compatible app, restore targets only from approved snapshots; compare with backed-up target configuration including `include_descendants`.
6. Monitor HTTP / PostgREST errors `40001`, `23514`, `42501` and score updates.

## Important limitations
- This function makes each **single routine's target replacement** atomic and optimistic, NOT the entire existing `saveCloudData` function. Other entities, occurrence rows and trajectory writes are still separate requests. Do not claim full workspace transactional safety.
- A new routine's target link may be inserted only after earlier routine upsert in the same client save; partial saves remain possible if unrelated requests fail.
- In-memory baselines are process-local. A full reload before modifying routines is essential. A stale baseline triggers a conflict instead of destructive overwrite.
- Clearing all targets of an existing routine is explicitly rejected pending an intentional dedicated editor operation.
- SQL function privileges should be reviewed against production workspace membership roles/RLS.
- Database restore of the 13 deleted targets is NOT executed by this migration.
- The `current_setting` trigger gate is an additional protection against accidental direct deletion, not a security perimeter against privileged SQL writers.
- This patch is a candidate, not a completed production roll-out.
