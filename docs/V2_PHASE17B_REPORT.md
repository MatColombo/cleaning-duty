# House Care V2 — Phase 17B Implementation and Regression Report

**Baseline:** exact Phase 17A ZIP (`v2.0.0-rc.3`). **Output:** `v2.0.0-rc.4`, source candidate on the V2 testing track. **Scope:** Active Deck physics/gesture presentation only. **Stopped after 17B.**

## 1. Implementation and protected invariants

- Added a single-pointer motion controller directly to `ActiveDeck.tsx` using pointer capture, axis disambiguation, bounded real-time inline transforms, sampled horizontal velocity, inertia-aware acceptance, WAAPI outgoing/incoming/return easing and elastic overshoot. Finger, mouse and touch events share the same controller.
- Motion uses a tiny pure helper `deckGestures.ts`, no dependency/physics engine. Updates during drag touch DOM styles and CSS variables only, with no React render and no backend transport. Heavy `CareCard`/procedural SVG is mounted **once**, with two CSS-only rear panels whose offsets respond to drag.
- Selected task ID is household-scoped and survives reordering/refresh. If removed by completion, Undo/filters or recomputation, selection moves to an adjacent surviving ID and animations reset. Outgoing callbacks check the original identity before switching.
- Front-card actions are retained unchanged. Explicit Complete and More buttons remain functional and are not gesture targets. Synthesized click protection does not block a subsequent deliberate press. The stage retains keyboard left/right and button controls; hidden EN/IT instructions describe them. Reduced-motion disables decorative transforms and animation.
- Version/cache references advance from rc.3 to rc.4. No SQL, notifications, recurrence, task RPC changes, Supply business rules, backend calls or persistence changes. Previous Phase 16A–16C staging and mixed-client restrictions remain in effect.
- The historical Phase 15 regression changed from a hard-coded rc.3 check to asserting a 2.0.0 release-candidate pattern. This is test upkeep, not a production release decision.

## 2. Regression evidence

| Gate | Observed outcome | Evidence |
|---|---|---|
| `npm test` all V1/V2 pure tests | PASS | `docs/qa/phase17b-evidence/npm-test.log` |
| New 17B geometry and wiring tests | PASS (pure/static) | `tests/v2_phase17b_deck_gestures.test.ts` |
| `npm run qa:static` | PASS | `docs/qa/phase17b-evidence/static-audit.log` |
| `npm run qa:syntax` | PASS (AST parse, not typecheck) | `docs/qa/phase17b-evidence/syntax-audit.log` |
| `npm run typecheck` / `npm run build` | BLOCKED (React/Vite/type modules unavailable) | `docs/qa/phase17b-evidence/typecheck-blocked.log` |
| Browser local app E2E, viewport screenshots, focus/scroll | NOT RUN: Playwright unavailable | `docs/qa/phase17b-evidence/browser-blocked.log` and runner |
| iOS/Android installed PWA | NOT RUN: physical device unavailable | `docs/qa/V2_PHASE17B_BROWSER_ACCEPTANCE.md` |
| Supabase/cloud mutation traffic and SQL | NOT RUN; presentation has no new RPC/SQL | No deploy, no SQL execution |

## 3. Measured isolated performance (not browser rendering)

`node tools/phase17b-motion-benchmark.cjs` executed **250,000** bounded drag + release-velocity calculations (with transform string generation on every 25th iteration) under Node.js 22.16.0. Output is saved as `docs/qa/phase17b-evidence/cpu-motion-benchmark.json`. This measures pure CPU math, **not** actual touch-to-paint latency, real frame budget, Chromium GC, memory on phone, or app/PWA startup. Numbers can vary by host and load; rerun the script for comparison.

- **Observed isolated run:** 250,000 iterations in 834.989 ms; **3.3400 microseconds per loop**. Process heap delta 690,688 bytes (not a card DOM memory measurement).
- One full artwork-bearing CareCard is mounted regardless of deck length; up to two small decorative rear elements. This is a verified source structure, not a GPU/memory measurement.
- Frame p50/p95/max, JS heap and viewport are instrumented in the browser runner **but have no measured values in this archive**. Actual device FPS and phone memory remain BLOCKED.
- The gesture code contains no network/persistence operation. Absence of cloud writes during a real swipe still needs a browser-network trace.

## 4. Reproducible operation

```bash
node tools/phase17b-motion-benchmark.cjs
npm test
npm run qa:static
npm run qa:syntax
npm run typecheck             # blocked in this environment
node tools/phase17b-browser-acceptance.mjs # blocked here; requires app + Playwright
```

The real browser matrix, screenshots location and PWA/device checks are in `docs/qa/V2_PHASE17B_BROWSER_ACCEPTANCE.md`. No fabricated UI screenshots are included. Validation source files are included inside the ZIP.

## 5. Release restrictions

This is **not a certified release**. Run actual dependency-backed `typecheck`/`build`, real app Playwright gestures, Chrome/Safari mobile measurements, iOS/Android installed PWA acceptance, EN/IT and reduced-motion/accessibility checks before marking 17B as fully validated. No production deployment/SQL or `main` merge was performed.
