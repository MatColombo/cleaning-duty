# House Care v1.0.1 — maintenance release

## Fixed / improved

- Added first-class multi-home switching for cloud accounts.
- Added owner-only home archive, restore and permanent deletion.
- Permanent deletion requires the home to be archived first and typed-name confirmation in the UI.
- Archived homes cancel pending notification jobs; restoring recreates reminders for still-scheduled tasks.
- Offline runtime storage is now scoped by user + home, with best-effort migration of v1.0 cached state.
- Home editor dragging and resizing are continuous rather than grid-stepped during motion.
- Snap-to-grid is now optional, defaults off, and applies only when the gesture ends.
- SVG pointer coordinates now use the actual screen transform, improving accuracy on narrow/mobile layouts.
- Touch targets for resize and polygon handles are substantially larger without enlarging their visual appearance.
- Geometry numeric fields edit locally and commit on blur/Enter.
- Mobile inputs/selects/textareas use a 16px font size to prevent Safari auto-zoom on focus.

## Database change

Existing cloud installations must run:

`supabase/migrations/20260828170000_v1_0_1_workspace_management.sql`

No Edge Function or secret changes are required.
