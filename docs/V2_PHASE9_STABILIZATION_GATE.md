# House Care V2 — Phase 9 Stabilization Gate

**Baseline:** `cleaning-duty-phase8-flagship-overview.zip` (Phase 8 source snapshot)  
**Scope:** Stabilize the existing House Menu, Timeline, Overview and SVG language. Expand reusable authoring vocabulary. **No new page design, recurrence, cleanliness, mutation, repository, Supabase or notification changes.**  
**Status:** **Source-level stabilization implemented; full V2 architecture gate CONDITIONAL/PENDING live browser and physical mobile verification.** Do not start Phase 10 on the assertion that all ten experiential criteria have passed.

## 1. Changes in this phase

### Authored vector assets

- `src/visual/primitives/expanded.ts`: **28 additional face-free semantic silhouettes** following the existing 240×240 vector contract, with semantic palette inks, optional face and limb anchors, safe-inset and action/environment metadata.
- `src/visual/registry.ts`: registers the new vocabulary without changing any of the initial 20 definitions or the three demo-only entries.
- `src/visual/procedural/aliases.ts`: adds carefully ordered English/Italian names for the additional exact subjects. Existing generator-v1 seed calculations, template selection, patterns, rendering and golden recipes remain unchanged. Specific multiword aliases (for example `pastiglie lavastoviglie`) take priority over the broader appliance (`lavastoviglie`) to avoid accidental classification.

**Expanded catalogue:**

| Group | New authored IDs | Count |
|---|---|---:|
| Appliances & fixtures | `bathtub`, `toilet`, `refrigerator`, `dishwasher`, `washer`, `dryer`, `kettle` | 7 |
| Furniture & surfaces | `chair`, `table`, `bookcase`, `bed`, `cabinet`, `floor-patch`, `mirror` | 7 |
| Tools | `bucket`, `duster`, `scrub-brush`, `broom`, `squeegee`, `generic-tool` | 6 |
| Supplies & props | `detergent-bottle`, `tablet-pack`, `paper-roll`, `microfiber-stack`, `generic-supply`, `rug`, `shelf-prop`, `room-window-fragment` | 8 |
| **Total new** | | **28** |

`generic-appliance` and `generic-surface` already existed in Phase 4; they have deliberately **not** been duplicated. Production vocabulary is **48 objects**, plus the unchanged 12 expressions, 12 hand poses, 14 decorations and 7 print patterns.

The whole objects catalogue has been regenerated into `design/v2/primitives/objects/` with the updated `vocabulary-manifest.json`. The **first 20 exported SVG files remain byte-for-byte identical** to Phase 8.

### SVG hygiene and tooling

- `tools/svg-validation.cjs`: detects repeated attributes on SVG elements. During QA it caught invalid duplicate `stroke` attributes on two newly authored primitives; those were corrected. A negative regression assertion now ensures the validator rejects the defect.
- `tools/build-v2-visual-lab.cjs`: displays all production objects, not just the original 20.
- `tools/build-v2-phase9-proof.cjs`: creates developer-only, real-vector QA sheets for all 48 primitives, a genuine 48 px untextured silhouette check, and six example generated Care Card illustrations (including EN/IT, repeated routine, and nonsensical name/fallback).
- `tools/bench-v2-phase9-vectors.cjs`: creates `docs/V2_PHASE9_RENDER_PROXY.json` with measured Node generation/runtime SVG-size proxy data; **not** a mobile/browser benchmark.
- `tests/v2_phase9_stabilization.test.ts`: geometry registration, authored IDs, palettes, scoped SVG IDs, EN/IT aliases, stable editions, unknown fallback, no-art semantics and motion/text source guards.
- `src/visual/README.md`: documents the expanded catalog, source-of-truth policy and QA commands.

### Narrow Overview stabilization

`src/styles/overview-v2.css` only:

- wraps longer due/context/stock text instead of forcing overlap;
- permits the task-scope selector to wrap on narrow widths;
- provides a **devtools-only** artwork-disable experiment: `document.body.dataset.v2NoArt = 'true'`. All real status, task text, meters and buttons remain in HTML. The toggle is not a persisted user feature.

No Overview component, Timeline component, mutation service, task projection or route has been rewritten in this phase.

## 2. Architecture-gate assessment (ten requested criteria)

| Criterion | Evidence | Status |
|---|---|---|
| 1. Actual UI resembles approved retro mockup without raster card art | Full vector contact sheet and recipe proof demonstrate the visual grammar; no genuine rendered V2 application screenshot was possible in this environment | **Partial; visual browser signoff pending** |
| 2. Procedural output is intentional | Limited motif palette, curated subject/tool/environment templates, bounded accents; inspected proof cards | **Pass at SVG-art level** |
| 3. Repeat routines recognizable | Same routine/target/action keeps stable subject, template, palette, border and pattern; covered in tests | **Pass in pure renderer** |
| 4. Editions vary without randomizing identity | Controlled expressions, pose, stamps and 1–3 accents; fixed seed and golden tests | **Pass in pure renderer** |
| 5. Unknown/custom tasks degrade gracefully | Generic surface composition and EN/IT alias coverage; new nonsense-label test | **Pass** |
| 6. Active Deck improves workflow over prior list | Phase 8 provides one actionable front card, Prev/Next and real mutations; no user-timed comparison has been run | **Needs interaction/usability validation** |
| 7. Mobile performance acceptable | One full procedural SVG in foreground, no rear SVG; Node CPU and SVG-size proxy measured | **Device/browser profiling pending** |
| 8. Long Italian/user labels safe | Targeted `overflow-wrap`, card internal scroll and short/narrow viewport fallback, source tests | **Source-level pass; browser/font-scaling QA pending** |
| 9. Reduced motion | Existing `prefers-reduced-motion` rules disable card/Overview animation; tested source | **Source-level pass; device setting QA pending** |
| 10. UI understandable without artwork | Statuses, labels, meters, controls in semantic HTML; no-art devtools CSS; static test | **Source-level pass; browser/screen reader QA pending** |

The approved image mockup has more elaborate 1950s ink/illustration detail than the current production SVGs. The current vector interpretation intentionally follows the design-system's **70% modern clarity / 30% retro treatment**; its basic visual family is present, but do not claim pixel parity with concept renders.

## 3. Validation and performance

### Automated

- `npm test`: complete available V1 and V2 regression suite, including 10,000 Phase 5 synthetic generator cases, Phase 8 task action/Undo/linked-child tests, and new Phase 9 tests. Record final execution outcome in the delivery summary.
- `npm run validate:vectors`: 108 production/export SVG files checked; source validator now catches duplicate element attributes.
- Independently XML-parsed all 48 exported object SVGs and developer-only Phase 9 proof sheets.
- New isolated Phase 9 strict TypeScript compilation passes.
- Original 20 authored exports and baseline mutation/cleanliness/Overview/Timeline operational files are unchanged.

### Node render/size proxy (not a mobile performance claim)

See `V2_PHASE9_RENDER_PROXY.json` for exact environment and results. At the recorded run:

- 10,000 pure recipes generated in ~4.29 s (environment-specific);
- 240 full card SVG strings produced in ~72 ms, **0.30 ms/string** average, without browser painting;
- card source bytes approximately **7.4 KB median**, **8.8 KB p95**, **9.8 KB maximum** in six representative input families;
- 27 median / 56 maximum path elements; at most three nested SVG roots;
- one actual full-detail artwork is mounted for the foreground Overview card; rear cards are simple CSS layers.

This cannot measure mobile frame time, GPU memory, font rendering or actual responsive clipping.

### Build and browser constraints inherited from Phase 0

The uploaded source archive does not include installed frontend dependencies/lockfile; npm registry access remains restricted in this environment. Until React/Vite dependencies are installed, a complete `npm run typecheck`, `npm run build`, browser interaction test and mobile screenshot/profile cannot be certified. Do not conflate the pure TS/svg tests with frontend build success.

## 4. Release-gate manual acceptance: must run before Phase 10

After successfully installing dependencies, run:

```sh
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Review at 390×844, 320×568, landscape/tablet and at **200% effective text scaling**:

1. Screenshot Overview, Timeline and floating House Menu in default/retro, night, greyscale and deliberately custom theme. Compare with the approved retro mockup for visual character, **not exact pixel identity**.
2. Ensure 390×844 normally shows House State and Active Deck with no unexpected full-page vertical scroll. At 320×568 or enlarged text, verify **accessible page overflow** and no lost buttons.
3. Switch to Italian and assign long names such as `Pulizia approfondita del grande mobile contenitore con ripiani` and a long stock product. Check title, due row, critical-item accessibility, buttons, Extra Care and error state.
4. In browser devtools run `document.body.dataset.v2NoArt='true'`. Verify score readings, due state, assignment, stock, task title, Complete/Reschedule/More and critical-entity labels all remain visible and usable. Remove the attribute afterwards.
5. Turn on OS/browser Reduced Motion. Verify navigation, completion stamp, deck changes and House Menu work without required animation.
6. Test with zero tasks, many tasks (20–50), mixed overdue/due, and a linked parent/child, including keyboard Prev/Next and the task detail sheet.
7. On a real mid-range Android/iOS device, record initial paint, button responsiveness, long main-thread tasks and frame pacing when opening/advancing a deck. Do not estimate this from the Node timings.
8. Do a 5-task observation comparing the old list and new deck: time-to-find urgent task, taps to inspect another task, completion+Undo confidence. Serial deck navigation is a possible trade-off; do not assume it is strictly better.
9. Confirm install/update/offline/sync banners, task deep links, `/timeline` and workspace switching remain usable with the floating House Menu.

**Gate decision:** Phase 9 source/asset/tooling work is complete, but the **full architecture gate remains pending** on the browser/device/UX checks above. Begin secondary page redesign only after those checks pass or the risk is explicitly accepted by the project owner.

## 5. Phase boundary

Not implemented: Home redesign, Routines redesign, Actions/Supplies redesign, Analysis redesign, editing of recurrence/domain persistence, persisted visual recipes, trading, in-app card games, runtime AI images or new V2 schema. Those remain outside Phase 9.
