# House Care V2 — Phase 3 Vector Rendering Foundation

## Status

Phase 3 source implementation is complete. No V2 page redesign, task-card procedural generator, or production cleaning-object vocabulary has been started.

Full application typecheck/build remains blocked by the Phase 0 environment limitation: frontend dependencies are not installed and outbound npm access is unavailable. The new pure TypeScript vector modules pass the repository test harness, and the two new React TSX files pass an isolated strict TypeScript syntax/type check with minimal React stubs.

## Implemented architecture

The V2 vector subsystem now lives under `src/visual/` and is independent from the legacy monochrome CSS-mask `Illustration` component.

Implemented modules:

- `version.ts` — `HOUSE_CARE_VISUAL_VERSION = 1`;
- `artboards.ts` — canonical artboards;
- `types.ts` — primitive metadata/render contracts;
- `id.ts` — safe scoped SVG IDs;
- `palette.ts` — semantic theme to vector palette mapping;
- `patterns.ts` — reusable pattern definitions;
- `misregistration.ts` — deterministic ink offsets;
- `primitives/foundation.ts` — three demo-only multicolor primitives;
- `registry.ts` — primitive registry;
- `render.ts` — pure inline SVG renderer;
- `SvgPrimitive.tsx` — React wrapper;
- `dev/VectorFoundationDemo.tsx` — development-only gallery component.

The demo-only primitives are deliberately not the Phase 4 production vocabulary. They exist solely to verify the renderer contract and effects.

## Canonical artboards

The subsystem supports:

| Role | ViewBox |
| --- | --- |
| Icon | `0 0 64 64` |
| Small object | `0 0 128 128` |
| Main object | `0 0 240 240` |
| Scene | `0 0 480 320` |
| Card art | `0 0 640 420` |

## Primitive metadata contract

Each primitive can expose:

- stable `id`;
- `family`;
- canonical artboard/viewBox;
- explicit safe inset;
- optional face anchor;
- optional left/right arm and leg anchors;
- supported action-family hints;
- supported environment-family hints;
- `demoOnly` flag where appropriate.

This metadata is visual-only and has no authority over domain/entity/task behavior.

## Palette system

`vectorPaletteFromTheme()` converts the existing persisted semantic `ThemePalette` into V2 vector inks.

The vector layer consumes:

- paper;
- surface;
- ink;
- muted ink;
- primary;
- primary soft;
- mustard;
- coral;
- danger;
- supporting turquoise.

The supporting turquoise is derived rather than persisted. Inline components may also inherit the Phase 2 CSS art aliases.

No new appearance fields or database values were added.

## Reusable SVG effects

The scoped definition system provides:

- fine halftone;
- medium halftone;
- coarse halftone;
- diagonal halftone;
- radial/comic halftone;
- sparkle pattern;
- action-ray pattern.

Definitions are emitted only when used by the primitive, limiting SVG weight.

### Ink misregistration

`deterministicInkOffset()` generates a stable offset bounded to ±1.5 SVG units by default.

Only illustration geometry receives the offset layer. Operational UI text is outside the vector primitive system and is never misregistered.

### Paper/grain

`src/styles/vector.css` adds `.hc-v2-paper`, a lightweight page-level repeatable CSS dot/grain treatment.

There is no per-card `feTurbulence` and no SVG turbulence in the vector system.

## Safe SVG IDs

Every render creates an instance-specific scope using:

- primitive ID;
- caller instance key;
- sanitized namespace;
- stable hash.

All local pattern/title IDs are namespaced through this scope.

The development demo currently contains 29 inline SVG instances and 208 SVG IDs, all unique across the complete document.

The React wrapper uses `useId()` when an explicit instance key is not supplied.

## SVG validation tooling

Added:

- `tools/svg-validation.cjs`;
- `tools/validate-v2-svg.cjs`;
- npm command `validate:vectors`.

Validation detects:

- missing SVG root/viewBox;
- raster `<image>` / `data:image` content;
- external references;
- duplicate IDs;
- embedded fonts;
- unauthorized fixed colors for procedural primitive/pattern source;
- excessive path count;
- excessive SVG file size.

Brand/export SVGs are structurally validated but may intentionally use fixed brand inks. Production primitive and pattern source directories may not.

`npm test` now runs the V2 SVG validator before domain tests.

## Development demo

Two development demonstrations exist without adding an application route:

- `src/visual/dev/VectorFoundationDemo.tsx` — React gallery component;
- `design/v2/page-reference/vector-foundation-demo.html` — self-contained static reference generated with `node tools/build-v2-vector-demo.cjs`.

The static demo shows:

- multicolor rendering;
- the same primitive under different semantic palettes;
- halftone patterns;
- registration enabled/disabled;
- scene/object artboards;
- repeated-instance ID scoping;
- a 24-instance stress strip.

## Performance/complexity checks

The Phase 3 pure renderer stress test renders 1,500 SVG instances in approximately 10–15 ms in the current Node environment (12 ms on the final recorded run).

The implementation deliberately avoids the expensive patterns most likely to hurt mobile rendering:

- no per-card turbulence;
- no raster data;
- no embedded fonts;
- no large filters;
- small path counts;
- only used defs per SVG;
- page-level paper texture rather than repeated filters.

A physical mobile/browser frame-time profile remains pending until the full frontend dependency/build blocker from Phase 0 is resolved. This is a runtime validation limitation, not a detected source regression.

## Verification

### Passed

- `npm run check:version`;
- `npm run validate:vectors` — 15 existing V2 SVG assets checked;
- full pure-domain `npm test` suite;
- new `v2_phase3_vector_foundation.test.ts`;
- deterministic ink-offset test;
- palette substitution test;
- safe-ID/collision tests;
- synthetic validator violation tests;
- 1,500-render stress test;
- 29-instance development-demo global ID collision check;
- isolated strict TypeScript check for the new React wrapper/gallery using minimal React stubs;
- vector rasterization sanity preview through ImageMagick/Inkscape.

### Still blocked by Phase 0 environment

- real dependency install;
- full React/Vite `npm run typecheck`;
- full production `npm run build`;
- live app/browser integration;
- physical mobile performance profiling.

The full typecheck/build currently fail first on missing packages such as React/Vite, consistent with the previously documented Phase 0 environment blocker.

## Phase boundary

Phase 3 does **not** include:

- production household/tool/supply SVG vocabulary;
- expression/limb library;
- semantic action/entity resolver;
- stable routine or occurrence seeds;
- `CardVisualRecipe`;
- Care Card generation;
- Overview redesign;
- database/schema changes.

Those remain Phase 4 and later work.
