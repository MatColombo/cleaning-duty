# Update House Care v1.1.1 → v1.1.2

## 1. Supabase first

Open **Supabase → SQL Editor → New query** and run the complete contents of:

`supabase/migrations/20260829213000_v1_1_2_task_state_integrity.sql`

Run it once. It repairs affected task rows and adds stale-write protection.

## 2. Update GitHub

Upload/replace the v1.1.2 project files in the existing GitHub repository and commit. Cloudflare will build and deploy automatically to the existing Worker URL.

## No other changes

Do not change `send-push`, VAPID keys, CRON_SECRET, Supabase Edge Function secrets, cron configuration, or Cloudflare build variables.

## Expected first load

Any occurrence that was incorrectly left `scheduled` despite terminal task history or all targets being complete should appear as Completed/Skipped instead of To do. Pending reminders for those repaired rows are cancelled by the migration.
