# House Care V2 — Phase 2 Brand Foundation

## Status

Implementation complete for the Phase 2 source changes. Full frontend runtime/build verification remains blocked by the unresolved Phase 0 dependency-install limitation in this execution environment.

No application page has been redesigned in this phase.

## Implemented

### Brand assets

Authored vector-only V2 assets were added under `design/v2/brand/` and mirrored to `public/brand/v2/` for runtime use:

- `house-care-wordmark.svg` — full wordmark;
- `house-care-mark.svg` — compact multicolor house/floor-plan mark;
- `house-care-mark-mono.svg` — one-color mark;
- `house-care-wordmark-decorative.svg` — display-sized decorative variant;
- `house-care-app-mark.svg` — launcher/PWA-ready compact mark without dense halftone.

All brand SVGs use vector primitives only. The wordmarks keep lettering as `<text>` rather than path-converted glyphs. No raster `<image>` data is embedded.

### Typography

The V2 two-role typography system is now formalized:

- display/brand: **Fraunces Variable** with serif fallbacks;
- operational UI: **Manrope Variable** with system-sans fallbacks.

`@fontsource-variable/fraunces` was added beside the existing Manrope package and imported from `src/main.tsx`.

Typography role classes live in `src/styles/typography.css`. Existing V1 headings are intentionally not restyled yet.

### Semantic House Care Retro palette

Added preset `house-care-retro` to the existing theme engine:

| Token | Value |
| --- | --- |
| Canvas | `#F4E8D0` |
| Surface | `#FFF9EC` |
| Surface Soft | `#E8DDC7` |
| Ink | `#153D3A` |
| Ink Muted | `#586663` |
| Primary | `#1F6B63` |
| Primary Soft | `#C7D7CB` |
| Due | `#C38A32` |
| Overdue | `#C65E48` |
| Danger | `#A93F3A` |

`fresh-sage` remains the default and first fallback. Existing appearance IDs, saved custom palettes and the current ten persisted semantic tokens are unchanged.

The future V2 art colors are CSS aliases derived from semantic values:

- paper → Canvas;
- surface → Surface;
- ink → Ink;
- primary → Primary;
- mustard → Due;
- coral → Overdue;
- danger → Danger;
- turquoise → derived `color-mix()` from Primary + Canvas.

No procedural-art-specific colors have been added to persistence.

### CSS architecture

Added:

- `src/styles/tokens.css`;
- `src/styles/base.css`;
- `src/styles/typography.css`;
- `src/styles/motion.css`.

Import order in `src/main.tsx` is currently:

1. Fraunces font;
2. Manrope font;
3. legacy `styles.css`;
4. V2 tokens;
5. V2 base;
6. V2 typography;
7. V2 motion.

The V2 files are intentionally conservative at this phase so they establish roles/tokens without redesigning V1 pages.

### Asset organization

Created:

- `design/v2/brand/`;
- `design/v2/primitives/`;
- `design/v2/patterns/`;
- `design/v2/page-reference/`;
- `design/v2/exports/`;
- `public/brand/v2/`;
- `src/visual/brand.ts`.

The primitive/pattern folders are placeholders only. Procedural SVG implementation is explicitly deferred to Phase 3+.

## Compatibility decisions

The following were deliberately not changed:

- `defaultThemeId` remains `fresh-sage`;
- theme persistence format;
- custom palette schema;
- `applyTheme()` semantics;
- Settings custom-color workflow;
- existing theme categories;
- current V1 page/component markup;
- PWA manifest icons;
- boot/loading branding.

The current Settings page automatically exposes House Care Retro because it enumerates `themePresets`.

## Verification

### Passed

`npm test` passes in full, including the new `v2_phase2_brand_foundation.test.ts`.

The new tests verify:

- House Care Retro is available;
- the palette passes existing contrast guardrails;
- Fresh Sage remains the default;
- legacy custom-palette fallback behavior remains intact;
- art inks derive from semantic tokens;
- all runtime brand SVG files exist;
- no brand SVG embeds raster images/data URLs;
- wordmark text remains text;
- the launcher mark contains no pattern/halftone texture.

All authored/exported/runtime SVG files also parse successfully as XML. The compact app mark and wordmark were raster-rendered from the SVG source as an additional geometry sanity check; no raster source was introduced into the repository.

### Pending because of Phase 0 environment blocker

`npm install` cannot complete in this sandbox because outbound npm access is unavailable. Therefore `node_modules` is absent.

As a consequence, `npm run typecheck` and `npm run build` currently fail at missing external modules such as React/React Router rather than at a Phase 2 TypeScript error. This is the same baseline infrastructure blocker documented in Phase 0.

A full browser check of:

- real Fraunces rendering;
- actual EN/IT page typography;
- live Settings theme switching;
- custom-color persistence;
- unchanged V1 page rendering

must be performed once dependencies can be installed.

## Phase boundary

No Phase 3 procedural rendering work has been implemented.
No V2 page redesign has been implemented.
No current PWA icon has been replaced.

