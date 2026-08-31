# House Care v1.2.0 - State consistency corrective update

This corrective update addresses restore-to-today conflicts, skipped-cleanliness contamination, missing Deep critical-cleanliness cards, and interaction confirmation/closing behavior.

## Supabase update

If the earlier v1.2.0 corrective notification update is already installed, do not run it again and do not redeploy `send-push` again for this revision.

Open **Supabase -> SQL Editor -> New query** and run once:

`supabase/migrations/20260831173000_v1_2_0_state_consistency.sql`

The migration is idempotent. It:

- adds the first-class `reopen_task_to_today` RPC;
- allows legacy completed/skipped rows without a lifecycle event to be restored;
- clears stale `completed_at` values from non-completed occurrences;
- removes live cleanliness anchors proven to come from invalid or reopened completion evidence;
- preserves immutable completion snapshots/history for Analysis.

No VAPID, cron, Edge Function secret, or Cloudflare environment-variable change is required by this revision.

## Application deployment

Replace the repository contents with the files from the new browser-deploy package, preserving the repository `.git` directory, then commit and push as usual. The service-worker cache version is `v1.2.0-r2`, so installed PWAs can detect the update.

## Corrected behavior

- **Restore to do today** is a dedicated transaction rather than long-lived Undo. It reuses the same occurrence and does not depend on stale client version equality.
- Completed and skipped Finished items can be restored to today's To do state. A postponed-away-from-today item can also be restored from Finished.
- Restoring a completed occurrence reverses that occurrence's live cleanliness refresh and reopens its targets.
- Skipping never replenishes cleanliness. Stale completion timestamps on skipped/non-completed rows are repaired and cannot seed the Home cleanliness trajectory.
- Home and Overview both use the same canonical item/channel cleanliness engine.
- Critical cleanliness contains separate **Routine cleaning** and **Deep cleaning** groups. The configured item count applies per cleaning type.
- Done, Skip, Reschedule, Reassign, Restore, and room-mode Done/Skip require confirmation before mutation.
- Task interaction sheets close after a successful mutation. Routine, Action, Stock, and Home creation/edit sheets continue closing after Save.

## First-use verification

After SQL + app deployment, refresh/reopen the PWA and check:

1. Complete one activity, open Finished -> `...`, choose **Restore to do today**, confirm, and verify it returns to today's active work without a sync-conflict banner.
2. Skip one activity and restore it the same way. It must remain restored after the cloud refresh.
3. Skip a dirty activity and verify neither Home nor Overview cleanliness increases.
4. If both channels have low items, verify Critical cleanliness shows Routine cleaning and Deep cleaning separately.
5. Reschedule an activity and verify confirmation appears and the sheet closes after the change.
6. Save a Routine or Stock item and verify its sheet closes after the save completes.

If stale cleanliness was present before this update, the SQL removes invalid live anchors and the client reconstructs the canonical trajectory on the next cloud load.
