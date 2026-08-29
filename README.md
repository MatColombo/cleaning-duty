# House Care PWA — v1.1.2

Configurable household-care PWA for a shared home. Product source of truth: `docs/product-spec.md`.
Release notes: `docs/RELEASE_NOTES.md`.


## No administrator rights / no Node.js

Use the browser-only deployment route in `docs/DEPLOYMENT_NO_ADMIN.md`. Cloudflare builds the Vite app remotely, while Supabase setup is performed through its dashboard. `tools/browser-deploy-helper.html` generates the Web Push secrets locally in your browser.


## v1.1.2 task lifecycle integrity

- Prevents stale configuration saves from reopening completed/skipped tasks.
- Repairs legacy scheduled tasks whose immutable history or target completion shows they are terminal.
- Today treats terminal history as authoritative even before cloud repair is persisted.
- Pending push jobs are cancelled for repaired terminal tasks, and all-complete targets cannot be re-notified.

Existing cloud installations must run `supabase/migrations/20260829213000_v1_1_2_task_state_integrity.sql` once before deploying the frontend.

## v1.1.1 Today correctness release

- Today defaults to **To do** and no longer mixes completed/skipped work into the normal work queue.
- Added **To do / Completed / All** plus **For me / Household** filters.
- Open work is separated into **Due now** and **Later today** so a newly generated next occurrence is not mistaken for the task just completed.
- Routine name is the primary task title; Action + concrete targets are secondary context.
- Editing a Routine retires every still-open occurrence from the previous revision, including already-overdue ones. Startup also repairs stale scheduled occurrences from superseded Routine revisions.
- Today defensively deduplicates visible task occurrences by task ID and natural occurrence key.
- Task details are visually distinct from the Today card and include a whole-task Complete action while the task is scheduled.
- Frontend-only release: no Supabase SQL, Edge Function, secrets, cron, or Cloudflare-variable changes.

## v1.1.0 feature release

- Adds two care dimensions: **Routine care** for short-term upkeep and optional **Deep care** for long-term condition. Deep care appears only where an active Deep-cleaning Routine targets the place/item.
- Routine creation now has one simple **Cleaning level** choice. Existing Routines and Tasks remain Routine cleaning after upgrade.
- Deep-clean completion refreshes both care dimensions; Routine cleaning restores only Routine care. Effective care is derived so neglected Deep care reduces overall condition without hiding a freshly completed Routine clean.
- Home cockpit and layout Care overlay show stacked game-style Routine/Deep health bars.
- Home layout automatically centers and fits placed content when a scene opens; the 100% button refits the content. Zoom remains internal to the layout canvas.
- Rooms/items can have fill color, automatically darker contour, text color, optional text background, label position (top/center/bottom), and label orientation (horizontal/diagonal/vertical).
- Each floor/outdoor scene can have its own background color.
- Requires one Supabase SQL migration. No Edge Function, push-secret, cron, or Cloudflare-variable changes are required.

## v1 scope

- Configurable home model, types, labels, metadata and visual floor/outdoor editor
- Reusable Actions, Routines and concrete auditable Tasks
- Flexible recurrence, exceptions and after-completion schedules
- Simple assignment by default; optional advanced no-code targeting/assignment
- Today workflow: Complete, partial target Done, Skip, Postpone, Reassign
- Qualitative-first Supplies and stock history
- Home cockpit with dual Routine/Deep care health bars, task and supply overlays
- English / Italian
- PWA install, Web Push, badges, offline daily actions and conflict-safe sync
- JSON export/import
- v1 Insights: audit explorer, completion trends, workload and cautious qualitative stock outlook
- Optional starter household content and care-sensitivity tuning

## Local use — no account required

Requires Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Keep `VITE_APP_MODE=local`. Local data stays in that browser.

## Online deployment

Use the complete step-by-step guide:

**`docs/DEPLOYMENT.md`**

The production stack is Supabase + Cloudflare Workers Static Assets + Web Push.

## Database migrations

The package contains timestamped migrations under `supabase/migrations/` so a fresh project can use:

```bash
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

## Build

```bash
npm run build
```

Cloudflare deployment:

```bash
npx wrangler login
npm run deploy
```

## Backup

**Settings → Backup → Export JSON**. v1.1 exports backup schema v7 and imports schemas v2-v7. Push subscriptions and derived notification jobs are runtime state and are excluded.

## Release boundary

v1 intentionally excludes CAD/3D, AI-generated schedules, sensor integrations, purchasing integrations, photos/video and large analytics dashboards. The stable primitives and audit model are designed so those can be evaluated later without replacing the core domain.
