# House Care PWA — v2.0.0-rc.1

**Release candidate; not yet production-certified.** House Care V2 is a local-first / optional-Supabase household-maintenance PWA with a retro-vector presentation system. The task scheduler, assignment, cleanliness, stock, Home geometry, persistence, notifications and backup semantics remain those of the V1 baseline.

## V2 navigation and experience

- Overview (`/`): **House State** (separate Regular/Deep cleanliness and critical entities) plus an **Active Deck** of actionable Care Cards.
- Timeline (`/timeline`): completed, skipped, postponed, future seven-day work, date browsing and Restore to today.
- Home (`/home`): the original semantic home layout, spatial editing, inspector and room mode.
- Routines, Actions, Supplies, Analysis, Settings: their original features in the V2 visual system.
- A floating **House Menu** replaces the bottom navigation. Existing `/today`, `/insights` and `/task/:taskId` deep links remain compatible.

The artwork is assembled locally from authored SVG objects, poses, expressions and patterns; stable routine identities and bounded occurrence editions are deterministic. No generated artwork is stored in Supabase or backups. Visuals do not determine task semantics.

## Local development

Use Node.js 22+ and npm:

```bash
cp .env.example .env
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Default `.env.example` runs **local-only** without cloud credentials. For cloud mode, configure `VITE_APP_MODE=cloud`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`; optional Web Push also uses `VITE_VAPID_PUBLIC_KEY`. Never commit private credentials.

`npm run qa:static` performs offline source/asset checks. `npm run qa:release` is the **blocking code gate** (static audit, source syntax, regression tests, typecheck and Vite build); it must finish successfully on a dependency-complete machine. Browser, cloud and physical-device sign-off are additional mandatory gates. This archive has **no generated or fabricated lockfile** because the isolated build environment cannot access npm. Generate and commit `package-lock.json` using `npm install` and verify `npm ci` before promotion.

## Upgrade and release status

For current V1 households, first export a backup. V2 introduces no new database schema migration; the existing cloud database must already have all V1.2.1 linked-activity migrations. Legacy backup schemas 2–9 remain importable. Keep theme preferences and canonical occurrence identities intact.

- [V2 release/regression report](docs/V2_PHASE15_RELEASE_REGRESSION.md)
- [Browser, device and PWA acceptance checklist](docs/qa/V2_BROWSER_ACCEPTANCE.md)
- [V2 implementation contract](docs/V2_IMPLEMENTATION_CONTRACT.md)
- [V2 release-candidate notes](docs/RELEASE_NOTES_V2_RC1.md)
- [Historical V1 upgrade instructions](docs/UPDATE_v1.2.1_R1.md)

**Do not deploy as a certified V2 final release** before the unverified typecheck/build, device interactions, actual PWA update and cloud push flows have been checked. See the report for exact gates.
