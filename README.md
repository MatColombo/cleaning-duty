# House Care PWA — v1.0

Configurable household-care PWA for a shared home. Product source of truth: `docs/product-spec.md`.
Release notes: `docs/RELEASE_NOTES.md`.


## No administrator rights / no Node.js

Use the browser-only deployment route in `docs/DEPLOYMENT_NO_ADMIN.md`. Cloudflare builds the Vite app remotely, while Supabase setup is performed through its dashboard. `tools/browser-deploy-helper.html` generates the Web Push secrets locally in your browser.

## v1 scope

- Configurable home model, types, labels, metadata and visual floor/outdoor editor
- Reusable Actions, Routines and concrete auditable Tasks
- Flexible recurrence, exceptions and after-completion schedules
- Simple assignment by default; optional advanced no-code targeting/assignment
- Today workflow: Complete, partial target Done, Skip, Postpone, Reassign
- Qualitative-first Supplies and stock history
- Home cockpit with derived care status, task and supply overlays
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

The v1 package contains six timestamped migrations under `supabase/migrations/` so a fresh project can use:

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

**Settings → Backup → Export JSON**. v1 exports backup schema v6 and imports schemas v2-v6. Push subscriptions and derived notification jobs are runtime state and are excluded.

## Release boundary

v1 intentionally excludes CAD/3D, AI-generated schedules, sensor integrations, purchasing integrations, photos/video and large analytics dashboards. The stable primitives and audit model are designed so those can be evaluated later without replacing the core domain.
