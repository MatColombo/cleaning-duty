# House Care v1.2.0-r4.2 — Notification repair

This is a focused repair on top of v1.2.0-r4.1.

## What was wrong

r4 changed reminder scheduling from a single nullable assignee to the explicit `member | everyone | unassigned` assignment scope. The migration updated the scheduling function but did not rebuild all reminder jobs for already-materialized scheduled activities. Existing jobs could therefore remain stale, failed, or absent after the assignment upgrade.

A second weak point was device subscription state: the browser can still report an active PushSubscription after the server has disabled the corresponding row following a 404/410 response from the push provider. The Settings UI then looked enabled while `send-push` had no eligible endpoint.

## Fixes

- Rebuild reminder jobs for every currently scheduled occurrence belonging to an active routine with reminders enabled.
- Reset derived unsent jobs to a fresh recipient set and retry count.
- Preserve explicit assignment semantics:
  - `member`: one active member/account recipient;
  - `everyone`: one job per active household account;
  - `unassigned`: no notification job.
- Self-heal the current device PushSubscription when the cloud app loads.
- If Supabase had disabled a stale 404/410 endpoint, replace it with a new browser subscription.
- `send-push` now records lookup failures instead of silently cancelling a job when a database query fails.
- `send-push` response/log summary now includes `sent`, `failed`, `cancelled`, and `noSubscription` counts.
- Service-worker cache bumped to `v1.2.0-r4.2`.

## Deployment

### 1. Run the new SQL migration

In Supabase -> SQL Editor -> New query, run:

`supabase/migrations/20260831213000_v1_2_0_notification_repair.sql`

Run it once. It immediately rebuilds reminder jobs for current scheduled work.

### 2. Redeploy `send-push`

Redeploy:

`supabase/functions/send-push/index.ts`

Keep Verify JWT OFF. Do not change `CRON_SECRET`, VAPID keys, the service-role/secret key, or the cron schedule.

### 3. Deploy the web app

Replace the repository contents with the `cleaning-duty-pwa` folder from the r4.2 ZIP, commit, and push to the same branch used by Cloudflare.

### 4. Open the deployed app once on each notification-enabled device

The app will synchronize the browser PushSubscription with Supabase. If the previous endpoint had been disabled after a provider 404/410, it will replace it with a fresh subscription.

## First verification

Create or reschedule one activity to a few minutes in the future with:

1. reminder = At due;
2. assignment = yourself.

Then repeat with assignment = Everyone / household.

For Everyone there should still be one shared activity, but one reminder job per active household account.

## If a reminder still does not arrive

Run the read-only diagnostic file:

`supabase/setup/r4_2_notification_diagnostics.sql`

Interpretation:

- no `pending`/`sent` job for the test activity -> scheduling issue;
- `failed` + `No active push subscription for this recipient.` -> device subscription issue;
- another `last_error` -> Edge Function/provider error is now recorded explicitly;
- jobs remain `pending` after their `deliver_at` time and Edge Function logs show no invocation -> cron/Edge Function invocation issue (also confirm Verify JWT is OFF and the cron secret still matches).
