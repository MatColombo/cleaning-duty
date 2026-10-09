# House Care V2 — Phase 4 implementation report

**Status:** Authored vector vocabulary implemented; browser/device validation remains open with Phase 0 dependency limitation.

**Source:** Phase 3 repository snapshot. The V2 implementation contract and retro-vector design system remain authoritative.

## Included in this phase

| Component | Quantity | Canonical source |
| --- | ---: | --- |
| Household/tool/supply/environment SVG primitives | 20 | `src/visual/primitives/authored.ts` |
| Reusable independent expressions | 12 | `src/visual/expressions.ts` |
| Gloved arm/hand pose templates | 12 | `src/visual/poses.ts` |
| Small vintage-print decoration motifs | 14 | `src/visual/decorations.ts` |
| Existing reusable screenprint pattern families | 7 | `src/visual/patterns.ts` |
| Development/QA sample palettes | Existing built-in themes + custom color controls | `tools/build-v2-visual-lab.cjs` |

The **20 objects** are: house, sink, shower-head, oven, stovetop, coffee-machine,
sofa, countertop, window, spray-bottle, sponge, cloth, mop, vacuum,
cleaner-bottle, plant, lamp, framed-art, generic-appliance and generic-surface.

## Technical and artistic boundaries

- Each object is a semantic-ink, face-free SVG body on the canonical 240×240
  artboard, with authored safe insets, classification families, optional
  face/limb anchors, an optional print registration silhouette and simple
  halftone detail.
- Expressions contain facial marks only. Pose templates attach authored
  arms/legs, gloved hands and context props through metadata anchors.
- A small manual composition helper combines independently selected objects,
  expressions, poses and decorations. It does **not** choose from task data,
  seeds, dates, randomness or KPIs.
- Theme adaptation continues to use `VectorPalette` from Phase 3. SVG exports
  under `design/v2/primitives/` use CSS variables, not fixed palette colors.
- The existing domain, page routes, task mutation services and persisted schema
  are untouched. No runtime AI or raster card art has been introduced.
- No SVG text paths or embedded fonts. All task title/metadata in the hand-
  composed Overview are HTML or reference SVG `<text>`, never path-converted.
- The three Phase 3 `demoOnly` primitives remain visibly separate from the 20
  production-ready vocabulary items.

## Visual Lab

`design/v2/page-reference/v2-visual-lab.html` is standalone and development-only.
It is not routed or bundled in the application. It shows all assets, seven
pattern families, the built-in semantic presets, editable custom colors,
texture/registration switches, sizes 48 / 96 / 160 / 240 px, and EN/IT long
label tests. Rebuild with `npm run build:v2-visual-lab`.

`design/v2/page-reference/v2-overview-manual.html` is a hand-composed UI study
made from only authored object vocabulary, pattern effects and operational
HTML. A second `v2-overview-manual-proof.svg` exists for direct vector QA.
It is a **visual acceptance reference**, not a functioning or connected app page.

The assets exported into `design/v2/primitives/` are deterministic copies of
TypeScript source modules, plus `vocabulary-manifest.json`. Rebuild with
`npm run build:v2-vocabulary`.

## Verification

- `npm test`: green, including V1 regressions, Phase 2/3 tests and
  `v2_phase4_authored_vocabulary.test.ts`.
- `npm run validate:vectors`: passes all exported/brand SVG files.
- Development Visual Lab browser-script syntax checked (`node --check`).
- Pure TypeScript vector code compiled strictly with globally installed `tsc`.
- SVG-only contact sheet and Overview proof rasterized via CairoSVG without
  embedding bitmap sources in authored vectors.
- Repeated inline SVG instance IDs tested for collisions.
- Pure manual SVG renders tested in an in-process benchmark; not equivalent to
  browser/device painting performance.

## Open verification inherited from Phase 0

The repository snapshot still lacks installed React/Vite dependencies. Full
frontend typecheck, Vite production build, live theme interaction testing,
small-device/browser screenshot capture and physical-device painting performance
are **not verified**. Chromium screenshot capture in this sandbox timed out;
static PNG previews are rasterized from the vector-only proof source instead.

Phase 4 does not claim these checks have passed. They must be closed before the
V2 release baseline is considered green.

## Excluded on purpose

- No semantic resolver or Action → Subject inference (Phase 5).
- No seeded routine/occurrence card recipes (Phase 5).
- No `CareCard` task UI, Active Deck logic or new navigation (later phases).
- No backend/schema/backup migration, card collection or trading.

## Phase 4 handoff

The next phase may consume explicit `AUTHORED_OBJECT_IDS`,
`EXPRESSION_IDS`, `POSE_IDS`, `DECORATION_IDS`, the metadata registry and
`renderManualCharacterSvg` without revising any business service.
