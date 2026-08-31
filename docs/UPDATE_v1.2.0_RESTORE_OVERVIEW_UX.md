# House Care v1.2.0 - Restore + Overview UX corrective update (r3)

This update fixes the remaining skipped-item Restore-to-today cloud conflict and simplifies Overview task actions.

## 1. Supabase SQL update

Open **Supabase -> SQL Editor -> New query** and run once:

`supabase/migrations/20260831193000_v1_2_0_restore_and_overview_ux.sql`

Run it after the earlier v1.2.0 state-consistency migration.

The RPC now:

- locks the occurrence before restoring it;
- derives the authoritative completed/skipped/postponed action from the current cloud row plus lifecycle history;
- supports the stale-row case where the occurrence row still says `scheduled` but the latest lifecycle event says `SKIPPED` or `COMPLETED`;
- does not reject Restore merely because the client selected a different same-time/stale source event id;
- continues to reuse the same occurrence rather than creating a replacement row;
- preserves completion snapshots as audit history while removing the live cleanliness refresh when a completed occurrence is reopened.

No Edge Function, VAPID, cron, secret, or Cloudflare environment-variable change is required for this revision.

## 2. Application deployment

Deploy the contents of this browser-deploy package to the existing Git repository and let Cloudflare rebuild normally.

The service-worker cache is now `v1.2.0-r3`.

## 3. Overview interaction changes

- **Reschedule** now opens a dedicated rescheduling sheet. It contains only the occurrence summary, new date/time, and final Reschedule action.
- The `...` button opens **Task details** and no longer duplicates Reschedule or the large whole-task Done action.
- **Reassign** is launched from Task details into its own dedicated assignment sheet.
- Reschedule and Reassign both show a final confirmation after the user has selected the new value.
- Individual target completion is shown only for multi-target activities and is labelled **Complete target**, with helper text explaining that it is for partial completion.
- Successful Reschedule/Reassign/target/stock/Skip/Restore actions close their active sheet.

## 4. Critical cleanliness

Critical cleanliness is still calculated independently for Routine and Deep channels, but the UI now merges channels by item.

Each critical item explicitly shows whether the threshold breach is:

- **Routine cleaning**;
- **Deep cleaning**; or
- **Routine cleaning + Deep cleaning**.

When both channels are below the threshold, both percentages and both cleanliness bars are shown on the same item card.

## 5. First-use verification

After SQL + application deployment:

1. Skip an activity.
2. Open **Finished -> ... -> Restore to do today**.
3. Confirm the restore.
4. Verify it returns to active work and remains there after cloud refresh, without a cloud-version conflict.
5. On an active activity, press **Reschedule** and verify only the focused reschedule sheet opens.
6. Press `...` and verify Reschedule/whole-task Done are not duplicated there.
7. From `...`, press **Reassign**, select a person, then confirm the final assignment.
8. If an item is below the critical threshold for both channels, verify one card identifies **Routine cleaning + Deep cleaning** and shows both scores.
