# House Care PWA - v1.2.1-r3

A configurable household-care PWA with Overview, a pannable Home layout, Routines, Actions, Stock, Analysis and Settings. This release adds linked every-N activities and a clearer daily view on top of v1.2.0-r4.2.

## Upgrading your existing app

**Start with [docs/UPDATE_v1.2.1_R1.md](docs/UPDATE_v1.2.1_R1.md).**

For a project already upgraded through r4.2:

1. Export a household backup.
2. Apply `supabase/migrations/20260911133000_v1_2_1_linked_activities.sql` in Supabase SQL Editor.
3. Redeploy the existing `supabase/functions/send-push/index.ts`; keep JWT verification off and existing secrets/cron unchanged.
4. Push the contents of this `cleaning-duty-pwa` folder to the repository used by Cloudflare.

Do not rerun historical setup/repair scripts merely because they are included here. The ZIP contains one project root, not two alternatives.

## New in this version

Recurring routines can append separately actionable work on every N scheduled occurrences. Each extra has its own activity title, action, targets, Regular/Deep channel, products and cleanliness participation. It inherits its parent's cadence, assignment, reminder and lifecycle. Skips do not reset the counter.

A Counts toward cleanliness toggle excludes a routine's contributions and completion refresh without removing its tasks or reminders. Overview uses a horizontal cleanliness rail with explicit channel labels, numerical scores and mood feedback; urgency/today and Upcoming have distinct visual grouping. Cards show activity title, then item - action name; notifications show activity title and item. A new house/floor-plan icon is included.

Read [docs/RELEASE_NOTES_v1.2.1.md](docs/RELEASE_NOTES_v1.2.1.md) for scope and limits.

## Local development and build

Use Node.js 22+ and install the declared project dependencies:

```bash
cp .env.example .env
npm install
npm test
npm run build
npm run dev
```

The normal production build remains `tsc -b && vite build`. Keep private `.env` files out of Git. For local-only use, keep `VITE_APP_MODE=local`.

Cloudflare deployment uses the existing build variables and `npm run build`. Initial deployment documentation remains in `docs/DEPLOYMENT.md` and `docs/DEPLOYMENT_NO_ADMIN.md`; apply all required timestamped migrations for a new database. Existing installations should follow the version-specific update guide instead.

## Backup

Settings > Backup > Export JSON creates schema 9 backups. Schemas 2-8 remain importable. Linked routine/task IDs and stock snapshots are retained. Account-specific preferences, push subscriptions and derived reminder jobs are not portable household backup data.

## Verification boundary

All eight pure TypeScript domain suites and source/asset checks pass. npm installation could not reach the package registry in the packaging environment, so a complete dependency-backed React/Vite build was not run there. Live Supabase migration execution, device push delivery and browser end-to-end interaction checks are also deployment checks, not claimed local passes. See the update guide.

Historical release notes and migrations are retained for traceability; they do not replace the v1.2.1 upgrade instructions above.
