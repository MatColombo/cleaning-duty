# House Care V2 — Phase 5 semantic resolver and deterministic card generator

**Status:** Source implementation and pure tests complete. Full frontend / mobile-browser validation remains blocked by missing Phase 0 dependencies.

**Baseline:** The Phase 4 authored-vocabulary ZIP; no source code from older, non-current archives was merged.

## Phase boundaries

This phase implements only a **decorative, read-only visual projection** over existing records. It does not change recurrence, occurrence lifecycle, completion/skip/reschedule/reassignment, cleanliness, assignment, stock, push, sync, backups, database schema, routing or pages. No generator output is persisted. No card ownership, trading, card games, XP or streak mechanisms are present.

## Files and responsibilities

- `src/visual/procedural/taxonomy.ts` — 11 subject, 17 Action and 9 environment families; closed template, palette, border and stamp options.
- `aliases.ts` — normalized, whole-word English/Italian aliases. Accents/case are handled; arbitrary user names are supported. Keywords are hints, not authority.
- `resolver.ts` — read-only `CardVisualInput` adapter from existing `TaskOccurrence`, `Routine`, `ActionDefinition`, `Entity` and `EntityType`, plus semantic resolution and generic fallback.
- `recipe.ts` — seeded v1 generator: exact routine identity, occurrence edition, limited choices, bounded ornaments, misregistration and distress. No `Math.random()`.
- `cache.ts` — in-memory LRU (default 512; max 4096). Input-keyed including semantic strings; a target rename cannot return a stale recipe.
- `render-card.ts` — SVG-only art preview using the Phase 4 silhouettes, faces, gloved poses and vintage ornaments, with isolated SVG IDs and theme-relative inks. Operational information is not inside the artwork.
- `index.ts` — isolated public API; re-exported from `src/visual/index.ts` for later page integration.
- `src/visual/render.ts` — small backward-compatible addition: optional `registrationOffset` supplied by a recipe, so inline SVG instance IDs do not affect print offsets.

## Resolution order

1. **Exact subject** from the authoritative entity's structured type or compatible entity name (e.g. Oven/Forno, Sink/Lavello, Coffee machine/Macchina del caffe).
2. **Structured entity family** fallback (e.g. Appliance -> generic-appliance). Specific conflicting structured types beat misleading object-name words. Generic/broad entity types permit more specific recognizable names.
3. **Action family** fallback (e.g. Vacuum -> vacuum; Descale -> cleaner-bottle).
4. **Branded generic** fallback (generic-surface + print vocabulary).

Environment uses the explicit room/type when provided, then a target-derived hint, then a small known-object default and ultimately `generic-interior`. Only IDs from the authored primitive registry are returned. A missing or unrecognized entity never produces a broken image path.

The adapter prefers captured `TaskOccurrence.targets` snapshots to preserve explainability for archived/renamed entities. It does not infer semantic identity from Home layout geometry. Parent area naming is read as environment context only.

## Deterministic identity

**Stable routine seed:** `hash(JSON.stringify([routineId, actionId, primaryTargetId, visualVersion]))`.

**Occurrence seed:** `hash(JSON.stringify([stableSeed, occurrenceId, triggerOrdinal]))`.

- Stable routine choices: palette-ink variant, six composition templates, four borders, background halftone pattern, personality.
- Occurrence choices: facial nuance, gloved pose, 1–3 decorative accents, halftone density, small registration offsets, geometric distress, localized-stamp **ID** and optional ordinal.
- The `extra-care` stamp is only applied to a real linked occurrence with `parentOccurrenceId`; trigger ordinal alone is not enough.
- The generator does not read wall clock, due status, task completion, Stock level, locale, current theme or UI order. UI state overlays will be introduced later without changing identity seeds.
- A change of current app palette recolors the same recipe by substituting the semantic `VectorPalette` **after** generation; no hex values or CSS strings are written into the recipe itself.
- Output JSON is a compact, frozen description, never SVG source/raster bytes.

**Historical identity caution:** `visualGeneratorVersion` remains 1. The frozen `tests/fixtures/v2-visual-v1-golden.json` contains five representative recipes (repeated routine, Italian names, linked extra, unknown item). Do not change existing v1 behavior without explicitly introducing a new renderer/generator version and a migration strategy. A future optional persistent user-customization/version override would be separate from Phase 5.

## Developer outputs

- Run `npm run build:v2-procedural-proof` to reconstruct `design/v2/page-reference/v2-procedural-cards.html` and `v2-procedural-cards-proof.svg` using the actual generator.
- The standalone HTML contains six SVG cards (two editions of the same oven, Italian sink and coffee, generic fallback, bathroom shower). Its built-in theme chooser only changes CSS inks. It is intentionally not a production route.
- The contact sheet was rasterized as a **QA PNG only**; generated artwork and repo source remain vector-only.

## Verification

- `npm test` passes existing Phase 0–4 and V1 regression suites plus `v2_phase5_procedural_cards.test.ts`.
- The Phase 5 test creates and verifies **10,000 diverse synthetic inputs**, checks repeatability, every fallback, EN/IT aliases, unknown targets, registry membership, palette adaptation, bounded decoration, LRU invalidation, historical pre-V2 fixtures, golden visual-v1 snapshots and SVG ID hygiene.
- In the recorded initial run, 10,000 inputs with duplicate determinism checks completed in about **1.6 seconds**, including validation of 24 rendered SVG samples. This is a Node synthetic test, not a mobile rendering benchmark.
- Isolated strict TypeScript compilation (`--strict --noUnusedLocals --noUnusedParameters`) passes for all new modules; the existing pure regression test suite and SVG validators remain green.
- The combined six-card SVG development proof was rasterized via CairoSVG without errors; the PNG is a QA output outside the repository, not a runtime asset.
- No backend files or migrations, `src/types/domain.ts`, scheduling/cleanliness/mutation services, or page JSX were changed.

## Validation still open

Phase 0's npm dependency installation remains incomplete in this environment. `npm run typecheck` and `npm run build` were attempted and **failed on missing React, react-router-dom and React JSX runtime declarations**. No Phase 5 pure TypeScript errors were identified by its standalone strict compilation. Therefore the full Vite/React build, live cloud/local UI test and physical mobile performance measurements are **not claimed**. These must be closed before shipping V2.

## Explicit stop

No Phase 6 shell navigation, Phase 7 Timeline or Phase 8 Overview has been implemented. Those phases can consume the read-only `CardVisualRecipe` API when they start.
