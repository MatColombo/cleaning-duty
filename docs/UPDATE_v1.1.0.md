# Update House Care v1.0.3 → v1.1.0

This release adds dual Routine/Deep care and Home-layout presentation controls.

## 1. Update Supabase first

In **Supabase → SQL Editor → New query**, paste and run the complete contents of:

`supabase/migrations/20260829190000_v1_1_dual_care_layout_style.sql`

Run it once.

The migration adds:

- `care_level` to Routines and generated Tasks;
- scene background color;
- room/item fill, text and text-background colors;
- label rotation;
- `bottom` as a supported label position.

Existing Routines and Tasks are kept as **Routine cleaning**. No existing task history or geometry is deleted.

## 2. Update GitHub

Replace the project files in the existing GitHub repository with the v1.1.0 `cleaning-duty-pwa` contents and commit.

Cloudflare should detect the commit, run the remote build and deploy to the existing Worker URL.

## 3. No other infrastructure changes

Do **not** change:

- `send-push`;
- VAPID keys;
- `CRON_SECRET`;
- Supabase Edge Function secrets;
- cron scheduler;
- Cloudflare build variables.

## 4. After deployment

Open the app and allow its service worker update to apply. Existing Routines remain Routine cleaning. Edit or create a Routine and select **Deep cleaning** only where you want long-term Deep care to be tracked.

In **Home → Care**, Deep health bars appear only for areas/items that are targeted by an active Deep Routine.
