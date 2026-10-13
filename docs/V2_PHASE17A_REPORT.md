# House Care V2 — Phase 17A implementation and validation

**Baseline:** exact Phase 16D ZIP, `v2.0.0-rc.2`; output `v2.0.0-rc.3`. **Scope:** Overview viewport and Care Card supply presentation only. **Release state:** source candidate, NOT production-certified.

## Pre-change investigation and invariants

- The initial Overview sizing was `height: calc(100dvh - 58px - safe-area-inset-top)`, bottom padding `77px + safe area`, a `40% / 60%` vertical split plus an extra grid gap, and an unconditional page-scroll fallback at `max-height:760px`. The shell already overrode its bottom padding for Overview through `overview-v2.css`, making correctness dependent on stylesheet order.
- The card originally showed *only shortage alerts* from `task.supplies`; Available requirements were invisible and Extra Care supplies were not included. Long alert strings consumed vertical space inside the same scroll container as the Complete/More actions.
- The supplied Phase 16D scheduler, materialization, outbox, task RPC, notifications, backup semantics, V1 compatibility and integrated Extra Care contracts were protected and are unchanged.

## Implementation

1. `useOverviewViewport` reads `visualViewport.height`, actual header `getBoundingClientRect().bottom`, viewport zoom and document font size; it responds to header resize, visual viewport resize/scroll, orientation and window resize, with listener cleanup. CSS `100dvh` provides a fallback without JavaScript. The layout uses an available-height variable rather than assuming a constant topbar. Native CSS short-height / narrow-width and JavaScript short/zoom/large-type cases allow ordinary page scrolling.
2. The page uses an Overview-specific shell padding override and a deliberate `70px + safe-area-inset-bottom` House Menu dock; the Overview FAB is 56px and 10px from the safe bottom. Fractional grid tracks do not accidentally sum to 100% **plus a gap**. The compact House State and Active Deck share the available viewport instead of placing task controls under fixed overlays.
3. Card details have their own keyboard-focusable scroll area, *separate* from the pinned Complete/More action bar. In fallback mode, the whole card grows and uses page scroll, not a clipped internal scroll region. Critical rail, Regular and Deep bars, House Menu and Undo remain mounted and use the existing components.
4. A presentation-only `requiredCardSupplies` projection merges the primary task snapshots and currently **due** Extra Care requirements by supply ID. `out_of_stock` → `reserve_only` → `low` → `available`, then missing/archived inventory last. Within a severity tie, labels sort by name then ID. Missing inventory is not claimed as Available.
5. Up to four status-labelled supply chips appear on the card. For more than four, `+N` opens the existing focus-managed `Sheet`, listing all unique requirements, current on-hand quantities/units when reported, and qualitative state. Zero quantities remain valid data; missing numbers are explicitly unspecified. These values do **not** represent amounts needed to perform the task; the underlying snapshots store IDs and names only.
6. EN/IT strings added. App/SW/manifest cache-busters updated to `2.0.0-rc.3` without changing data schema or introducing cloud requests.

## CSS and source measurements (not real device metrics)

| Item | Phase 16D source | Phase 17A source |
|---|---|---|
| Viewport/header computation | `100dvh - 58px - safe top` | visual viewport minus **measured** header, `dvh` fallback |
| Overview bottom reserve | 77px + safe bottom | 70px + safe bottom (menu size/dock adjusted) |
| Grid row construction | 40% + 60% + 11px gap | bounded 38fr/62fr tracks, 8px gap |
| Short-height fallback | CSS <=760px | CSS <=710px; dynamic `<700px` remaining or zoom / font magnification |
| Card action placement | last child of scrolling card | fixed below scrollable details |
| Visible required stock | shortages only, unlimited text | 4 status chips + `+N` accessible sheet |

These are source-measurable constants and component contracts, **not** viewport screenshot measurements or claims that the fitted experience has been verified on an actual phone. Under the native/browser fallback the actual page may scroll, intentionally.

## Regression results

| Verification | Result / limits |
|---|---|
| `npm test` | **PASS** — existing V1/V2 suite + Phase17A 6-supply order/dedupe tests, active due Extra Care, 4/+N, missing stock/quantity, EN/IT, source contracts |
| `npm run qa:static` | **PASS** — 30 source/asset audits |
| `npm run qa:syntax` | **PASS** — 147 TS/TSX files parsed, not full typecheck |
| `npm run build` | **BLOCKED** — missing React, router, Vite and TypeScript type dependencies (`TS2307`); npm registry DNS `EAI_AGAIN` |
| Chromium headless smoke | **BLOCKED** — timed out even on `about:blank` (no screenshot or DOM metrics captured) |
| iOS/Android browser, installed PWA, standalone screenshots | **NOT RUN** — no instrumented physical devices nor runnable app bundle |
| Cloud, RLS, migrations | **NOT RUN / NOT REQUIRED** — 17A makes no DB/RPC changes |

## Reproduction

From root after `npm install` on a network-enabled machine:

```bash
npm test
npm run qa:static
npm run qa:syntax
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
# Separate terminal, install Playwright independently:
V2_BASE_URL=http://127.0.0.1:4173 node tools/phase17a-browser-acceptance.mjs
```

The Playwright runner tests the **real running Vite application** with isolated local-mode seed data and outputs full-size screenshots and DOM viewport metrics for the specified EN/IT sizes. It was not executed in this environment. The included `docs/qa/phase17a-evidence/layout-fixture.html` can be used for manual CSS diagnosis but is **not** a real application screenshot, and no fake screenshots have been provided.

## Remaining mandatory acceptance blockers

Real browser/installed-PWA checks at iOS and Android sizes, dynamic address bar and keyboard, EN/IT long labels, large system text, zoom, focus restoration and modal Escape, no horizontal clipping, House Menu versus Complete overlap, light/night themes, reduced motion, Home/Timeline integration, and real PWA worker update from rc.2 to rc.3. Do not promote this source to production solely from passing Node tests. The unapplied 16A–16C cloud migrations and mixed V1/V2 constraints remain in effect; no SQL has been run.

**Stopped after Phase 17A.**
