# 23514 secondary trajectory save fix

## Cause
The SQL trigger `v1_reject_secondary_trajectory_write` intentionally rejects INSERT/UPDATE on health_trajectories for routines with parent_routine_id NOT NULL. `persistCleanlinessState()` previously upserted historical secondary trajectories as part of each workspace save or automatic reconciliation.

## Fix
`src/lib/cloudRepository.ts` now filters those rows out of the Supabase upsert while retaining historical rows in memory. No SQL rollback is required. The trigger remains enabled.

## Deploy
Apply this change on top of the latest V1 candidate, build, test and deploy. Do not reapply the older release in isolation. Verify routine save, reload, Regular/Deep and completion. This targeted patch does not implement transactional synchronization or stale-write protection.
