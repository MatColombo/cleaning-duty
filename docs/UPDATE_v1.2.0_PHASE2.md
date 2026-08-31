# Update to v1.2.0 Phase 2

1. In Supabase → SQL Editor, run `supabase/migrations/20260831123000_v1_2_phase2_overview_undo.sql` once.
2. Replace the files in the existing GitHub repository with this package and commit.
3. Let Cloudflare rebuild the existing Worker automatically.

No changes are required to `send-push`, VAPID keys, cron, Supabase secrets, or Cloudflare build variables.
