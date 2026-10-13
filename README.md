# House Care PWA — v2.0.0-rc.9

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

For current V1 households, first export a backup. The Phase 16A branch adds an **unapplied** V2-only targeted CAS RPC migration; ordinary V2 cloud configuration writes intentionally remain queued until that migration is explicitly approved and deployed. Do not execute SQL on the shared project without permission. Legacy V1 RPC contracts remain unchanged, but concurrent V1 bulk configuration edits can still collide with V2: see the Phase 16A coexistence boundary. Existing V1.2.1 migrations are still required; backup schemas 2–9 remain importable.

- [Phase 16A persistence, state machine, SQL compatibility and test report](docs/V2_PHASE16A_DATA_INTEGRITY.md)
- [V2 release/regression report](docs/V2_PHASE15_RELEASE_REGRESSION.md)
- [Browser, device and PWA acceptance checklist](docs/qa/V2_BROWSER_ACCEPTANCE.md)
- [V2 implementation contract](docs/V2_IMPLEMENTATION_CONTRACT.md)
- [V2 release-candidate notes](docs/RELEASE_NOTES_V2_RC1.md)
- [Historical V1 upgrade instructions](docs/UPDATE_v1.2.1_R1.md)

**Do not deploy as a certified V2 final release** before the unverified typecheck/build, device interactions, actual PWA update and cloud push flows have been checked. See the report for exact gates.

## Phase 16B — Integrated Extra Care (V2 only, staging-gated)

The Phase 16B working tree implements parent-integrated Extra Care and keeps V1 linked-child history. See [`docs/V2_PHASE16B_INTEGRATED_EXTRA_CARE.md`](docs/V2_PHASE16B_INTEGRATED_EXTRA_CARE.md) for semantics, additive SQL/RLS, the explicit mixed-client boundary, testing evidence and **blocked cloud restore**. Run `npm test`, `npm run qa:static` and `npm run qa:syntax`; SQL is **not applied**, no cloud/PWA E2E is claimed. These are preserved Phase 16B historical instructions.


## Phase 16C - Completion-anchored recurrence and rolling fixed buffer

This working tree is now the **Phase 16C** source-only candidate. An After Completion task generates its successor from the actual completion event timestamp (Sep 1 due / Sep 3 completed / Sep 8 next due for five days). The fixed calendar scheduler keeps a bounded buffer of five **future** tasks per active routine, refilling when two or fewer remain, even for 18-month recurrences. Extra Care remains primary-integrated as in 16B.

- [Phase 16C implementation/report and blocked release gates](docs/V2_PHASE16C_IMPLEMENTATION_REPORT.md)
- [Phase 16C recurrence transition/decision table](docs/V2_PHASE16C_RECURRENCE_DECISIONS.md)
- [Phase 16C browser, notification and Supabase acceptance checklist](docs/qa/V2_PHASE16C_BROWSER_ACCEPTANCE.md)
- [Unapplied 16C forward migration](supabase/migrations/20261012160000_v2_phase16c_recurrence.sql)

**Do not deploy 16C SQL or enroll a household without explicit operator approval.** The capability is opt-in, requires the additive 16A and 16B migration series, and establishes a V2-only editing boundary for an activated household. Local-only backup import is supported. Cloud reset/import involving the integrated/atomic ledger remains blocked. Offline domain tests pass, but Postgres, browser/PWA E2E and dependency-backed build are still unverified. Stop after 16C.

## Phase 17A — Overview responsive fit and stock details

Overview now measures the actual header plus VisualViewport, centralizes the shell spacing override, retains the floating House Menu dock and uses an accessible page-scroll fallback on short/zoomed views. Complete/More stay outside the detail scroll region. Care Cards include up to four required supplies prioritized by canonical stock status; a `+N` button opens the existing accessible Sheet with current on-hand quantities/units (if reported) and all statuses. Due integrated Extra Care supplies are merged by ID. This is a presentation-only phase; no change to task, recurrence, stock mutation or persistence APIs. See [`docs/V2_PHASE17A_REPORT.md`](docs/V2_PHASE17A_REPORT.md) and [`docs/qa/V2_PHASE17A_BROWSER_ACCEPTANCE.md`](docs/qa/V2_PHASE17A_BROWSER_ACCEPTANCE.md). Production deployment remains blocked by missing dependency-backed build and real device checks.

## Phase 17B — Physical Active Deck (source candidate)

The deck now uses a single composited, pointer-captured front card. Horizontal drag follows finger/mouse and drives two lightweight rear surfaces; velocity influences inertia-aware next/previous navigation, with bounded transforms and elastic settlement. A task is **never completed by swiping**. Interactive card buttons remain explicit, keyboard arrows and Previous/Next buttons still browse, and reduced-motion prevents decorative transforms. Household-scoped task ID selection survives reloads/reorder with a deterministic adjacent survivor fallback. No backend calls occur during motion.

- [Gesture state machine](docs/V2_PHASE17B_GESTURE_STATE_MACHINE.md)
- [Implementation/validation report](docs/V2_PHASE17B_REPORT.md)
- [Real browser and PWA acceptance matrix](docs/qa/V2_PHASE17B_BROWSER_ACCEPTANCE.md)

Run `node tools/phase17b-motion-benchmark.cjs` for the **isolated CPU measurement**. Run `node tools/phase17b-browser-acceptance.mjs` against a real locally served Vite app after Playwright is installed for true interaction/frame/capture evidence. This environment cannot run the dependency-backed build or real app capture: **no browser screenshots or device FPS are asserted**. Do not deploy/promote on the basis of pure tests alone.

## Phase 18A — Character Studio preview (client-only)

Open **Character Studio** on a Routine Library Card, Action Library Card, or the selected item in Home Inspector. This is a local, disposable preview of the existing deterministic procedural artwork. Face, eyes, mouth, brows, pose, hand, object, scale, scene, palette, props and finite motion are editable only in the open dialog. Reset to Auto and Undo do not save data. Closing discards everything; there is no cloud persistence, backup field or visual-overrides schema until the separately approved Phase 18B.

Artifacts: `docs/V2_PHASE18A_REPORT.md`, `docs/V2_PHASE18A_DRAFT_SCHEMA.json`, `docs/V2_PHASE18A_PERSISTENCE_CONTRACT.md`, `docs/qa/V2_PHASE18A_BROWSER_ACCEPTANCE.md` and `design/v2/page-reference/v2-phase18a-studio-proof.html`.

## Phase 18B — Persist Character Studio recipe overrides (STAGED ONLY)

Phase 18B baseline `v2.0.0-rc.7`: Routine / Action / entity artwork choices can now be confirmed explicitly as small, validated JSON, stored locally or through the household-scoped Phase 16A durable outbox. Cloud writes require the **unapplied** `supabase/migrations/20261012190000_v2_phase18b_visual_overrides.sql` RPC and membership RLS; cloud saves fail visibly before that capability exists. Legacy V1 task RPC and schema contracts are not changed. The same renderer still produces the SVG locally; **no SVG, image or upload is persisted**.

V2 backup schema v10 exports these instructions; older v9 backup imports remain supported. Cloud full-restore involving saved artwork is **blocked before destructive reset** until a reviewed atomic V2 restore is available; legacy V1 resets delete orphan artwork via additive subject-delete triggers after the SQL migration is installed. See [`docs/V2_PHASE18B_SCHEMA_API_CONTRACT.md`](docs/V2_PHASE18B_SCHEMA_API_CONTRACT.md), [`docs/V2_PHASE18B_BACKUP_MATRIX.md`](docs/V2_PHASE18B_BACKUP_MATRIX.md), [`docs/V2_PHASE18B_REPORT.md`](docs/V2_PHASE18B_REPORT.md) and [`docs/qa/V2_PHASE18B_STAGING_CHECKLIST.md`](docs/qa/V2_PHASE18B_STAGING_CHECKLIST.md).

**DO NOT execute migrations/deploy to the shared Supabase project without express approval.** SQL/RLS, Cloudflare and physical PWA gates are not certified by this source delivery. Run `npm test`, `npm run qa:static`, `npm run qa:syntax`, `node tests/v2_phase18b_sql_contract.test.cjs`, `node tools/phase18b-traffic-benchmark.cjs` and full build on a dependency-complete machine before staging acceptance.


## Phase 19A + 19B — Illustrated Home and optional saved scene props (STAGED ONLY)

19A adds a local deterministic Illustrated Mode on confirmed Home layouts without changing spatial geometry, task projection or room-mode actions. 19B adds explicit user-confirmed customization of up to 16 **built-in vector decorations** per scene with bounded JSON, CAS revisions, offline outbox and normal-refresh visibility for household members. No persistence of generated defaults, no Realtime/Storage/photos/scripts, and no writes while dragging. Cloud Save requires **unapplied** `supabase/migrations/20261012213000_v2_phase19b_scene_decorations.sql`; until installed, cloud editing fails closed with a visible message. Legacy V1 APIs remain unchanged; backup schema 11 retains v9/v10 import compatibility. Cloud restore with saved decorations remains blocked pending a transactional V2 restore.

- Phase 19B report, schema and compatibility: `docs/V2_PHASE19B_REPORT.md`, `docs/phase19b_scene_decorations.schema.json`, `docs/V2_PHASE19B_BACKUP_COMPATIBILITY.md`.
- RLS staging script (not run): `supabase/staging/v2_phase19b_scene_rls.sql`. Rollback guidance: `supabase/migrations/20261012213001_v2_phase19b_rollback.sql.example`.
- Editor/browser checklist: `docs/qa/V2_PHASE19_BROWSER_STAGING_CHECKLIST.md`. Benchmarks: `tools/phase19a-illustration-benchmark.cjs` and `tools/phase19b-traffic-benchmark.cjs`.
- Comparison proof: `design/v2/page-reference/v2-phase19-home-comparison.svg` (component-generated demo, not actual app screenshot).

**Do not apply SQL to shared Supabase or deploy this source candidate without explicit approval.**
