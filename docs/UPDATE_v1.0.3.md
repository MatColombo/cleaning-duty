# Update House Care v1.0.2 → v1.0.3

1. In **Supabase → SQL Editor**, run `supabase/migrations/20260829183000_v1_0_3_layout_labels.sql` once.
2. Upload/replace the v1.0.3 project files in the existing GitHub repository and commit.
3. Cloudflare will build and deploy automatically to the existing Workers URL.

No change is required to Cloudflare variables, Supabase Edge Function `send-push`, VAPID keys, `CRON_SECRET`, or the cron schedule.

The SQL migration only adds three label-display columns to `layout_elements`; it does not rewrite existing tasks, routines, history, rooms, or supplies.
