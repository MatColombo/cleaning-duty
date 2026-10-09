# House Care V2 — Phase 15 Release and Regression Report

**Baseline:** Phase 14 `cleaning-duty-phase14-theme-boot-pwa.zip`.

**Prepared candidate:** `2.0.0-rc.1`.

**Decision:** **NO-GO FOR FINAL RELEASE.** Source-level hardening and pure tests are complete; full Vite build, live browser/device, cloud/push and installed-PWA acceptance are not. Do not rename the candidate to final `2.0.0` until those gates pass.

## Scope / changes actually made

- Retained all existing domain, scheduler, cleanliness, assignment, mutations, home spatial engine, local/cloud repository, notifications and task workflow source files unchanged from Phase 14.
- Normalized package, README, service worker, icon query strings, manifest, diagnostics version display and HTML to the `2.0.0-rc.1` candidate. Backup application_version is derived from `package.json`; pre-V2 fixture retains its historical `1.2.1-r4` origin.
- Updated SW asset revision to `retro-assets-v2-rc1` to invalidate the prior worker caches; preserved install/activate, skip-waiting, offline navigation, push and click logic.
- Removed unused `src/pages/TodayPage.tsx`, `src/components/Illustration.tsx`, `src/lib/illustrations.ts` and `public/illustrations/` after confirming there are no runtime imports. `/today` remains served by `LegacyRouteRedirect`; **Timeline and Overview retain the shared current task orchestration**.
- Removed 131 CSS rules whose selectors no longer appear in the active source (excluding known dynamic class families), reducing legacy CSS from **92,374 bytes to 79,176 bytes**. Consolidated 37 old root declarations and the V2 design roles into one token source (`src/styles/tokens.css`). Remaining legacy CSS is kept deliberately for common forms, Timeline, spatial editor and shared operational controls until visual parity is verified in a live browser. Detailed prune record: `docs/qa/phase15-css-cleanup.json`.
- Added `.env.example`, regression/upgrade simulation, static audit, syntax audit, optional browser screenshot helper and release checklist.

## Functional verification status

| Area | Evidence | Status |
|---|---|---|
| Recurrence, canonical trigger, exceptions, timezones | Existing V1/V2 pure regression tests | PASS (pure) |
| Cleanliness Regular/Deep, Refresh-to | Existing tests | PASS (pure) |
| Duplicate occurrence prevention, complete, skip, reschedule, reassign, undo/restore | Existing mutation/Timeline/Overview tests | PASS (pure) |
| Linked every-N activity, child independence | Existing V1.2.1/Phase 8 tests | PASS (pure) |
| Everyone vs Unassigned, advanced assignment | Existing tests | PASS (pure) |
| Stock, quantity, status and task-source history | Existing V1/Phase 12 tests | PASS (pure) |
| Home selection/room mode and geometry preservation | Phase 10 source/pure tests | PASS (pure) |
| Analysis canonical projections | Phase 13 tests | PASS (pure) |
| Backup import and export across V1→V2 | Pre-V2 fixture and Phase 15 identity round-trip | PASS (pure) |
| Navigation, legacy redirects, task resolver | Phase 6/7 and Phase 15 contracts | PASS (pure) |
| EN/IT and themes, extreme contrast, reduced-motion source guards | Existing Phase 9/13/14 suites | PASS (pure/source) |
| Real page interactions, browser accessibility and visual parity | `docs/qa/V2_BROWSER_ACCEPTANCE.md` | **NOT RUN** |

`npm test` passes in this environment, including the Phase 15 service-worker mock upgrade, backup round-trip and SVG bounds tests. Log: `docs/qa/phase15-test.log`.

## Procedural artwork and performance

- V1 visual generator version and frozen golden recipe fixtures remain unchanged.
- Existing suite includes 10,000 synthetic deterministic recipes and arbitrary EN/IT/custom fallback cases; all pass.
- Authored SVG validator passes 109 assets. The one rendered front card uses 5 semantic hard inks; rear deck layers are CSS, the visible artwork is `aria-hidden`, and there is no per-card `feTurbulence` or raster `<image>`.
- Phase 15 Node-only proxy: 10,000 recipes, 240 SVG strings; **0.129 ms per SVG** in this run, median **7,431 bytes**, p95 **8,811 bytes**, maximum **9,805 bytes**, maximum **56 paths**. This measures **string generation only** and does **not** establish frame rate, visual fidelity, DOM layout or device memory. Evidence: `docs/qa/phase15-vector-perf.json`.
- More realistic mobile-browser profiling is mandatory before final release.

## Build, dependencies, syntax and PWA state

| Gate | Outcome | Evidence |
|---|---|---|
| Version source consistency | PASS | `npm run check:version` |
| Offline source/PWA asset audit (30 checks) | PASS | `docs/qa/phase15-static-audit.log` |
| Vector/source validation | PASS (109 SVG files) | `npm run validate:vectors` |
| Source TS/TSX syntax parsing | PASS (138 source files) | `docs/qa/phase15-syntax.log` |
| CSS source parsing | PASS (16 stylesheets) | `docs/qa/phase15-css-parse.log` |
| `npm install` / committed lockfile | **BLOCKED (EAI_AGAIN / ENOTCACHED)** | `docs/qa/phase15-npm-offline.log` and failed registry DNS access |
| `npm run typecheck` | **BLOCKED**; missing React/router types and JSX runtime; cascading diagnostics cannot be treated as a real source pass | `docs/qa/phase15-typecheck.log` |
| `npm run build` | **BLOCKED** at typecheck; Vite bundle not produced | `docs/qa/phase15-build.log` |
| V1 worker → V2 worker cache cleanup/offline deep link/push URL logic | PASS in a mocked service-worker environment | `tests/v2_phase15_release_hardening.test.ts` |
| Actual installed-PWA update/Android/iOS launcher/push | **NOT RUN** | `docs/qa/V2_BROWSER_ACCEPTANCE.md` |
| Real browser screenshots and interaction suite | **NOT RUN**; no dependency-complete running app | `docs/qa/V2_BROWSER_ACCEPTANCE.md` |

No package-lock was invented. A dependency-complete machine must produce a real lockfile and pass `npm ci` and `npm run qa:release`. Historic v1 release/migration notes intentionally retain their historic version labels. An additional combined `npm run qa:release` attempt timed out during the existing long-running procedural test portion; its incomplete log (`docs/qa/phase15-codegate.log`) is **not** a passing gate result. The separate complete `npm test` log and independent static/syntax checks above remain the recorded evidence.

## Outstanding release-blocking actions (ordered)

1. On a machine with npm access run `npm install`, commit lockfile, `npm ci`, `npm run qa:release`. Resolve **actual** compilation diagnostics, not missing-package cascades.
2. Verify real local-only seeded workspace and authentic browser interactions E01–E17; capture/approve V01–V17 on normal/narrow phones, large type, EN/IT, selected themes and no-art/reduced-motion.
3. Verify Home selection/edit/room mode, Action/Routine create/edit, Stock event, Timeline Restore and linked child against real app state (not static JSX).
4. Perform physical-device frame/memory/interaction profiling and accessibility keyboard/VoiceOver/TalkBack review.
5. In staging perform V1 installed worker → V2 production worker activation, update banner, cache retirement, offline reload, Android/iOS icon appearance and notification deep links.
6. In a compatible Supabase staging project verify cloud workspace, backup restore, offline conflict recovery, recipient scope and real push delivery; no schema changes should be introduced.
7. Run and approve the final release matrix; only then promote version from `2.0.0-rc.1` to `2.0.0` across canonical release metadata and publish release notes.

**No extra features were introduced in Phase 15. No final release or deployment was performed.**
