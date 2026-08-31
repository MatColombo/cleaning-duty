# Update to House Care v1.2.0

This package is the final v1.2.0 build. These steps assume your existing deployment is already on the v1.2.0 Phase 3 package and therefore already has the Phase 1/2 Supabase updates.

## GitHub / Cloudflare

1. Extract `cleaning-duty-pwa-v1.2.0-browser-deploy.zip`.
2. Replace the files in your existing GitHub repository with the contents of the `cleaning-duty-pwa` folder.
3. Commit and push.
4. Let Cloudflare rebuild the existing Worker deployment.

The final package adds two npm dependencies used by the design system (`@phosphor-icons/react` and `@fontsource-variable/manrope`), so Cloudflare must run its normal dependency installation before `npm run build`.

## Supabase

If Phase 1 and Phase 2 were already installed, **do not run a new SQL migration for Phase 4**. Appearance preferences use authenticated user metadata rather than a new application table.

Do not change:

- `send-push`;
- VAPID keys;
- `CRON_SECRET`;
- Supabase Edge Function secrets;
- cron scheduler;
- Cloudflare application environment variables.

## First-use checks

1. Open **Analysis** and switch 7 / 30 / 90 days. Confirm Regular and Deep Cleanliness trends render, or show Not tracked when appropriate.
2. Complete, skip and reschedule test occurrences. Confirm Analysis counts/history update and the actions remain distinct in Overview.
3. Open **Settings → Appearance**. Switch through all five presets and verify the whole app follows the semantic theme.
4. Choose **Custom**, edit palette tokens and confirm invalid contrast combinations are identified before save.
5. Confirm navigation uses the new icon treatment and text remains readable at mobile width.
6. With reduced motion enabled at OS/browser level, confirm page/sheet/card movement is removed while status/Undo feedback remains.
7. Using a keyboard, tab to a room in **Home**, activate it with Enter/Space, and confirm the room detail opens.
8. Reload after deployment once to allow the bumped `v1.2.0` service-worker cache to take control.

## If upgrading from v1.1.2 directly

Apply the existing Phase 1 canonical-state migration and Phase 2 `undo_task_mutation` SQL update before deploying this final package. The required SQL files remain in the repository's Supabase migration/update assets and earlier v1.2 update notes.
