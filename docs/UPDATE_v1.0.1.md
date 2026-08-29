# House Care v1.0.1 — update an existing online installation

This is a maintenance update. **No new secret, Edge Function change, or Cloudflare variable is required.**

## Important order

Run the Supabase database update **before** uploading the new frontend. The v1.0.1 frontend reads the new `workspaces.archived_at` column.

### 1. Update Supabase

1. Open your existing Supabase project.
2. Open **SQL Editor** → **New query**.
3. Open this project file:
   `supabase/migrations/20260828170000_v1_0_1_workspace_management.sql`
4. Copy the whole file into the Supabase SQL Editor.
5. Click **Run** once.
6. A successful run should complete without an error. Do not run the old full-database script again.

### 2. Update GitHub

Replace the files in your existing GitHub repository with the contents of this v1.0.1 project and commit them to the same production branch (`main` in the original setup).

Cloudflare will detect the commit and automatically run the existing build/deploy configuration:

- Build: `npm run build`
- Deploy: `npx wrangler deploy`

Your existing `workers.dev` URL stays unchanged.

### 3. Confirm the update

After Cloudflare reports a successful deployment:

1. Open House Care.
2. If an **Update** banner appears, press it. Otherwise reload the app once.
3. Tap the current home name in the top bar.
4. Confirm that all active homes are listed and can be switched.
5. Open **Edit home** on a phone and verify that dragging/resizing follows the finger continuously.
6. Edit Width/Height manually: the value should save only after leaving the field or pressing Enter.

## v1.0.1 changes

- Multi-home switcher in the top bar.
- Create another home from the switcher.
- Archive/restore homes; archived homes stop pending push reminders.
- Permanent deletion only after archive and exact-name confirmation.
- Selected home remembered on the device.
- Cloud offline cache/queues/conflicts isolated per home.
- Smooth continuous drag/resize; grid snap applies on release and is off by default.
- Larger invisible touch targets for resize/polygon handles.
- Correct SVG touch-coordinate mapping on scaled phone layouts.
- Geometry number inputs commit on blur/Enter instead of every keystroke.
- Mobile form controls use 16px text to prevent iPhone focus zoom.
