# Update House Care v1.1.0 → v1.1.1

This is a frontend-only maintenance release.

## 1. No Supabase SQL

Do not run a migration for v1.1.1. The database schema is unchanged.

## 2. Update GitHub

1. Extract the v1.1.1 browser-deploy ZIP.
2. Open the existing GitHub repository.
3. Replace the repository files with the contents of the new `cleaning-duty-pwa` folder.
4. Commit the changes.
5. Cloudflare should automatically build and deploy to the existing Workers URL.

## 3. Nothing else changes

Do not change Supabase Edge Functions, VAPID keys, `CRON_SECRET`, cron scheduling, Supabase secrets, or Cloudflare build variables.

## After deployment

Open Today. The default view should show only actionable work. Any stale scheduled occurrences from old Routine revisions are automatically marked cancelled during normal load and persisted back to Supabase.
