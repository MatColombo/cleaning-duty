# House Care V2 — Phase 16D implementation and regression report

**Date:** 2026-10-12  
**Baseline:** `HOUSE_CARE_V2_PHASE16C_UPDATED.zip`, with intact Phase 16A/16B/16C source and existing regression suites.  
**Scope:** Phase 16D fast startup, partitioned and guarded cached hydration, background sync reconciliation, boot instrumentation and deferred secondary-route modules. No product features, artwork redesign, backend mutation, schema changes or production deployment.  
**Candidate:** `2.0.0-rc.2`. **Status:** source/domain **PASS**; browser/build/cloud **BLOCKED/NOT RUN**.

## Repository audit and protected invariants

Before changes, `src/contexts/DataContext.tsx` waited for catalog → duplicate invite/membership check → all 18 cloud tables plus capability reads → recurrence materialization before marking the app ready. `src/App.tsx` imposed a 520 ms boot minimum and 360 ms exit transition. All routed pages were eagerly imported. Phase 16A already provided a durable per-account/household coordinator and overlay, and Phase 16C already provided a bounded count-based generator. Domain correctness depends on the full data projection, so this phase **does not** introduce potentially incomplete partial-table structures.

Protected: existing V1 RPC signatures/table meanings; V2 opt-in restrictions, protected historical task and Extra Care ledgers; offline outbox; CAS/idempotent writes and Undo; user+workspace boundaries; backups/restore exclusivity; notifications/deep links; local mode; EN/IT/appearance/accessibility; no Realtime, polling, background service or extra cloud feature.

## Implementation

1. **Warm cloud start:** after Supabase session initialization and a fresh RLS-backed active workspace catalog, the selected household's versioned and workspace-scoped local snapshot can enter state before the full cloud read. Cache eligibility checks app version, schema 2, data workspace ID, selected catalog membership and maximum online age (seven days). Snapshot lookup never serves as proof of membership. Cloud refresh runs via `SyncCoordinator.refresh()`, whose 16A projection retains queued or sending local mutations. On a cold load, the same authorized catalog allows the data read to omit a duplicate invite claim and membership-select round trip; RLS still covers the actual data reads.
2. **Offline/transport failure:** an unexpired locally available Supabase session and a cached membership catalog are required before reading a local offline snapshot. Prior Phase 16C caches are accepted only in this guarded offline recovery path. Authorization/RLS errors cannot be downgraded to network errors; denied access hides the household and evicts its cache. Offline membership is necessarily provisional; other-device membership revocation cannot be detected before reconnection.
3. **Data sequencing:** data/catalog exposure is gated to the current user, async loads use activation epochs, and a stale response cannot move data between households. Occurrence generation and its optional targeted queue mutation are executed after the first paint opportunity, with an epoch check and current state read. A restored or edited household cannot be overwritten by an old hydration task. Cached updates are best effort; an outbox write failure still blocks the acknowledged user edit as in 16A.
4. **Bundle/boot:** Overview remains eager; Home, Routines, Actions, Supplies, Analysis, Settings, Timeline and task deep-link resolver use lazy modules. Suspense includes an accessible loading fallback. Removed the fixed 520 ms hold; retained a short 120 ms exit (zero for reduced motion). Branded boot art, EN/IT phrase rotation, PWA setup and notifications were not redesigned.
5. **Telemetry:** navigation-local, non-uploaded marks for bundle execution, auth, catalog, selection, cache decoding, household/cloud read, actual 18-table fetch, materialization, first Overview animation frame and boot exit. The completed mark collection is stored in sessionStorage as `housecare:startup:last` for manual test capture; no user/household identifiers are recorded. Bumped package, README, worker and asset cache revision, icon query strings and manifest together to `2.0.0-rc.2`.
6. **Logout:** remove private snapshots, cached household catalog and selected-household preference; retain durable user-scoped outbox for future authenticated reconnection by that account. The app never projects one account's cache into a different account's session.

## Before/after measurements

| Metric | Phase 16C | Phase 16D | Evidence quality |
| --- | --- | --- | --- |
| Source-defined minimum boot hold | 520 ms | 0 ms | Static code measurement, not observed startup |
| Source-defined non-reduced-motion exit | 360 ms | 120 ms | Static code measurement, not observed startup |
| Cloud data request prior to warm cached paint | 18 table queries (+ optional capability reads) | None once catalog authorization completes; same data queries then run for validation | Verified control flow; live network unmeasured |
| Duplicate invite claim/membership read after fresh catalog | Present | Eliminated from authorized selected-workspace data load | Static control flow; live count unmeasured |
| Snapshot parse, fixture | N/A | Real Node microbenchmark saved in `HOUSE_CARE_V2_PHASE16D_STARTUP_METRICS.json` | 1,000 local trials, **not** browser startup |
| Cold browser/PWA ms, warm browser/PWA ms, first useful paint and cloud bytes | Not captured | Not captured | **NOT MEASURED**; do not infer <1 s achieved |

The executable `tools/bench-phase16d-startup.cjs` and detailed `docs/V2_PHASE16D_STARTUP.md` document the trace marks and reproduction procedure. The attached JSON sets unmeasured device/network metrics to `null`, rather than fabricating results.

## Regression validation

| Gate | Result | Scope / limitations |
| --- | --- | --- |
| `NODE_PATH=$(npm root -g) npm test` | **PASS** | Existing V1/Phase 0/V2 tests + focused Phase 16D snapshot, household/user partitioning, schema/age guards, delayed refresh overlay, durable logout outbox; simulated coordinator transport |
| `NODE_PATH=$(npm root -g) npm run qa:static` | **PASS** | 30 static/release checks; SVG assets |
| `NODE_PATH=$(npm root -g) npm run qa:syntax` | **PASS** | TypeScript parser, 144 source files; not a typecheck |
| `NODE_PATH=$(npm root -g) npm run typecheck` | **BLOCKED** | React/router/Vite and type dependencies absent. Compiler has unresolved imports, so typed build cannot be certified |
| `NODE_PATH=$(npm root -g) npm run build` | **BLOCKED** | Stops at TypeScript dependency resolution; Vite bundle not produced |
| `npm install --ignore-scripts --no-audit --no-fund --package-lock=false` | **NOT COMPLETED** | Package registry unavailable/hung; no dependency-backed pass claimed |
| Live Supabase, RLS revocation, cold/warm HTTP waterfall | **NOT RUN** | No staging credentials, no approval for DB changes (none needed), no live cloud execution |
| Browser, installed-PWA, iOS/Android and screenshots | **NOT RUN** | Genuine app bundle unavailable; no screenshot claims |

## Files and test commands

- `src/contexts/DataContext.tsx`, `AuthContext.tsx`: safe cache activation, account and epoch gates, background reconciliation and delayed materialization.
- `src/lib/startupSnapshot.ts`, `startupNetwork.ts`, `startupTelemetry.ts`, `offline.ts`, `workspaces.ts`: cache version/scope, network/auth classification, marks and logout hygiene.
- `src/lib/cloudRepository.ts`: catalog-validated selected household read skips duplicate membership steps; 18-table timing marks.
- `src/App.tsx`, `src/pages/OverviewPage.tsx`: lazy routes, first-frame mark, shorter boot.
- `tests/v2_phase16d_startup.test.ts`, `tools/bench-phase16d-startup.cjs`, historical Phase 14/15 release-assertion updates.
- `docs/V2_PHASE16D_STARTUP.md`, `docs/qa/V2_PHASE16D_BROWSER_ACCEPTANCE.md`, evidence logs, coordinated rc2 metadata.

Run from ZIP repo root:

```bash
NODE_PATH=$(npm root -g) npm test
NODE_PATH=$(npm root -g) npm run qa:static
NODE_PATH=$(npm root -g) npm run qa:syntax
node tools/bench-phase16d-startup.cjs docs/qa/phase16d-microbenchmark.json
# On a machine with npm dependencies and a reproducible lockfile:
npm install
npm run typecheck
npm run build
npm run preview
```

## Remaining acceptance blockers

A real browser/standalone PWA is still needed for cold/warm auth/catalog/18-table/paint waterfall, HTTP byte accounting, <1s cached goal, expired and revoked auth, worker update, update banner, EN/IT/reduced-motion, deep links, offline restart, 2-account/2-household flows, restore and notifications. The original 16B/16C cloud ledger/RPC migration is still unapplied and not validated. This source should remain a release candidate until those mandatory gates pass. **Stop at 16D.**
