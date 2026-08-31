# Update to v1.2.0 Phase 3

This update assumes the v1.2.0 Phase 2 database changes are already installed.

1. Replace the files in the existing GitHub repository with this package and commit.
2. Let Cloudflare rebuild the existing Worker automatically.
3. Do **not** run a new SQL migration for Phase 3; none is required.

No changes are required to `send-push`, VAPID keys, `CRON_SECRET`, Supabase Edge Function secrets, the cron scheduler, or Cloudflare build variables.

## First-use checks

1. Open **Home** and confirm Regular/Deep Cleanliness appears above the layout.
2. Confirm rooms with due-today work have a dotted outline and overdue rooms have a dashed outline; a room with both should show both treatments.
3. Tap a room and confirm the detail surface shows cleanliness, Overdue, Due today, Upcoming, and **Start room**.
4. Start a room and complete or skip one occurrence. Confirm it disappears from the room queue and the same state is reflected in Overview.
5. Use **Undo** and confirm that exact occurrence returns in both Home and Overview.
6. Confirm future-only work appears in the room Upcoming list but does not decorate the room outline.
