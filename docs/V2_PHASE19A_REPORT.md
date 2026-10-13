# Phase 19A — Procedural Illustrated Home (client only)

Baseline: House Care V2 `2.0.0-rc.7` (Phase 18B). Candidate: **`2.0.0-rc.8`**. This ZIP contains 19A only; no scene-persistence code or SQL. Do not treat this report as installed-PWA acceptance.

## Scope and results

An `Illustrated Mode` toggle is available on the confirmed Home layout during normal viewing, initially enabled. It renders small, curated SVG markings keyed to the existing scene/element IDs and recognized semantic entity types. Room motifs include tiles, parquet, rays, waves, garden and neutral; object silhouettes include sink, oven, sofa, bed, table, shower, plant, washer, lamp, tool and generic fallback. Deterministic appearance seeds depend on scene ID and element ID, not translated or custom names. No art is saved.

Edit Mode remains the original accurate geometric canvas (movable/resizable placements, vertices, connections, pan/zoom/fit and pointer hit areas), without decorative overlays. Illustration is a noninteractive child of existing shapes; polygon elements clip it within the original boundary. Existing HTML labels, operational status text, overdue/due outlines and keyboard selection continue to carry meaning. No-art accessibility mode hides art and *restores* original object icons, not a blank object. Low zoom/compact layouts reduce detail; tiny objects omit fine accents. No extra device/network calls or animation loops.

## Preservation audit

| Invariant | Changes |
|---|---|
| Layout scene and element data shapes; semantic entities | None in 19A |
| Geometry hit regions, move/resize, polygon vertices and connections | Unchanged original handlers |
| Pan, zoom, fit, selected-element identity | Unchanged original handlers |
| Care/Deep scores and task projection | Unchanged domain code |
| Start Room / Complete / Skip / Later / Undo | Unchanged room-mode mutation paths |
| V1 tables, SQL, RPCs, backups, notifications | No changes |
| Illustrated rendering | New noninteractive SVG overlay, constrained by original bounds |
| EN/IT and accessibility | Localized toggle/status text; reduced-motion and no-art safeguards |

## Validation performed

`npm test`, `npm run qa:static` (30 checks), and `npm run qa:syntax` pass using system TypeScript to run pure-source tests. Specific 19A assertions cover deterministic recipe identity, unknown/custom naming fallback, zoom-detail levels, geometry isolation, no-art object-icon fallback and pointer-event isolation. The source suite includes legacy V1/V2 domain tests. This does **not** prove a real browser layout or keyboard/touch interactions.

Illustrated-versus-Edit **SVG comparison** is generated from the actual illustration component in a synthetic layout and saved as `design/v2/page-reference/v2-phase19a-home-comparison.svg`. It is **not** a running-app screenshot. The separate PNG is a rasterization of that development proof only. Review the provided browser checklist before approving.

### Measured isolated performance

Run `NODE_PATH=/path/to/global/node_modules node tools/phase19a-illustration-benchmark.cjs docs/qa/phase19a-evidence/benchmark.json` to reproduce. The supplied benchmark measures 10,000 deterministic recipe evaluations and 1,000 serializations of the actual SVG component. Results are stored with the run. These do not measure browser DOM nodes, frame time, JS heap on a phone, network traffic, full-page art density or PWA startup.

## Remaining gates

- Dependency-backed React/Vite/TypeScript build: **not completed** in this environment (dependencies unavailable).
- Real browser screenshots/scroll and pointer tests: **not run**.
- iOS/Android installed PWA, high zoom/large system text, reduced motion and screen reader: **not run**.
- Production Supabase: no SQL/deploy necessary, no access performed.

No Phase 19B persistence exists in this 19A snapshot.
