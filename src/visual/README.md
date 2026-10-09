# House Care V2 vector subsystem

Phase 3 establishes the inline multicolor SVG technical foundation.
Phase 4 adds a **finite authored vocabulary**, explicit face/pose composition
and designer/developer previews. The existing V1 monochrome-mask Illustration
component and all domain services remain unchanged.

## Pure rendering modules

- `version.ts` — visual language version (`1`); no recipe version bump in Phase 4.
- `artboards.ts` — 64, 128, 240, 480×320 and 640×420 coordinates.
- `types.ts` — semantic palette, primitive metadata, safe inset and anchors.
- `registry.ts` — authored primitive registry with 3 preserved Phase 3 demo entries.
- `primitives/authored.ts` — exactly 20 face-free household/tool/supply/env objects.
- `expressions.ts` — 12 independent eye/mouth emotional expressions.
- `poses.ts` — 12 authored black-ink arms/legs + white gloves and hand gestures.
- `decorations.ts` — 14 independent vintage-print motifs.
- `compose.ts` — **manual** explicit combination; no seeded choices.
- `render.ts` — scoped IDs, inline SVG, only used halftone definitions.
- `palette.ts`, `patterns.ts`, `misregistration.ts`, `id.ts` — Phase 3 foundations.

## React hosts

- `SvgPrimitive.tsx` renders a face-free primitive.
- `SvgCharacter.tsx` renders an explicitly selected expression and pose.

Both require a stable/unique `instanceKey` in repeated lists. If one is not
provided, React `useId` supplies a per-mount key. Artwork is presentational;
user actions and assistive operational labels must remain in semantic HTML.

## Art-authoring rules

1. Every object must stay recognizable **without** a face, halftone or pose.
2. Objects have a single semantic silhouette and optional interior detail,
   halftone wear, grounding shadow; no baked faces or white gloves.
3. Expressive faces use `metadata.faceAnchor`; limbs use `metadata.limbAnchors`.
4. Expose supported Action and environment families but **do not** resolve tasks
   to art in this phase.
5. Use semantic `palette.*` inks, not hardcoded color literals.
6. Keep the SVG geometric path budget below the validator thresholds.
7. Never embed raster art, external fonts/references, or operational text.
8. Background paper grain is a page-level CSS texture, never per-card turbulence.
9. The deliberate small-offset print misregistration affects the illustration
   registration layer only, never the UI copy.
10. Do not persist artwork or recipes in routines/occurrences/Supabase.

## Development-only review

Run:

```bash
npm run build:v2-vocabulary
npm run build:v2-visual-lab
npm run build:v2-proof
npm run validate:vectors
npm test
```

Open `design/v2/page-reference/v2-visual-lab.html` in a browser to inspect the
complete collection at different sizes, all theme palettes, custom colors, EN/IT
stress labels, and halftone/misregistration toggles.

Open `design/v2/page-reference/v2-overview-manual.html` for the responsive,
hand-composed operational concept; it is **not a shipping app page**.
`v2-overview-manual-proof.svg` and `v2-vocabulary-proof.svg` are direct, standalone
vector QA outputs using the same authored geometry and explicit manual choices.

Neither Visual Lab nor Overview proof introduces procedural generation or runs
in the production PWA. Phase 5 will add semantic resolving and card recipes.

## Phase 5 — Procedural card recipes (decorative projection only)

`src/visual/procedural/` provides a semantic resolver, v1 deterministic recipe
builder, bounded memory-only LRU and standalone art renderer. It consumes only
read-only task/action/entity/routine context and **never** writes task/domain
records or produces new occurrences.

```ts
import { cardVisualInputFromDomain, getCardVisualRecipe, renderCardVisualSvg } from './visual'
const visualInput = cardVisualInputFromDomain(task, workspaceData)
const recipe = getCardVisualRecipe(visualInput)
const art = renderCardVisualSvg(recipe, { instanceKey: `deck-${task.id}` })
```

The recipe is compact JSON-compatible parameters; it contains neither SVG nor
translated copy nor hardcoded hex colors. It is **not persisted**. Stable routine
choices are based on `routineId + actionId + primaryTargetId + visualVersion`;
only edition variations use `occurrenceId + triggerOrdinal`. Theme colors are
applied when rendering, after recipe generation. The same occurrence keeps its
visual identity if rescheduled or completed.

The source of truth for artwork is the existing V2 authored primitive registry.
Exact known entity subjects take priority; structured entity type families then
Action families, then an intentional generic fallback. Exact matches come from
target entity snapshots/names/types—not guessed from task titles. EN/IT aliases
are recognized as hints and arbitrary unknown names are supported.

The pure generator version is `1`. Preserve the v1 algorithm and its golden
fixtures when introducing later revisions: a new generator must live behind a
new version rather than silently rewriting old collected art. Historical
persistence of a version remains a separate product decision and is not added
in this phase.

For multiple inline SVGs in the same document, callers must use distinct
`instanceKey` values to scope SVG definition IDs. Operational labels and
buttons will be HTML in later phases, never inside generated artwork.


## Phase 9 — SVG catalog and stabilization gate

- `primitives/expanded.ts` adds 28 more **face-free** silhouettes, resulting in 48
  production-authored objects. It includes bathroom appliances/fixtures, kitchen
  appliances, furniture, floor/glass surfaces, tools and household stock/props.
- Phase 4 object IDs remain unchanged; the registry combines the original 20
  and expanded 28 plus the three separately flagged demo primitives.
- `procedural/aliases.ts` adds targeted EN/IT subject matches. These are
  decorative classification hints. Structured entity typing still outranks an
  incompatible item name and unknown labels retain the generic fallback.
- Keep the generator-v1 golden fixtures green. New alias recognition may refine
  the illustration of a previously generic subject **before V2 ships**. After
  release, this taxonomy must be frozen for v1; later changes require an
  explicit visual-version compatibility strategy so collected history is stable.
- `npm run build:v2-vocabulary` and `npm run build:v2-visual-lab` regenerate
  the designer handoff and development-only previews from the current registry.
- `npm run build:v2-phase9-proof` creates a 48-object contact sheet, a true
  48-pixel untextured size test, and a six-card edition/fallback proof as SVG.
- `npm run bench:v2-phase9-vectors` writes the **Node CPU/SVG-size proxy** into
  `docs/V2_PHASE9_RENDER_PROXY.json`. Never report its duration as mobile FPS.
- The Phase 9 no-art readability check is opt-in in browser devtools:
  `document.body.dataset.v2NoArt = 'true'`; reset with
  `delete document.body.dataset.v2NoArt`. The layout retains all operational
  HTML text/buttons and semantic meter values independently from art.
- Actual mobile-browser responsiveness, long Italian text at increased font
  sizes, screen-reader flow, and GPU frame-time profiling remain required for
  the **release gate** if frontend npm dependencies/browser are unavailable.
