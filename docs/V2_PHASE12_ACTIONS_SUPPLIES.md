# House Care V2 — Phase 12: Actions and Supplies

**Scope:** presentation migration of Actions and Supplies only.  
**Baseline:** `cleaning-duty-phase11-routines-redesign.zip`.  
**Status:** source implementation complete; dependency-backed production build and browser acceptance remain unverified (the Phase 0 environment blocker persists).

## 1. Outcome

The Actions library and Supplies cabinet now use the V2 retro-vector system: an expressive, type-led page hero, authored multicolor SVG illustrations, semantic palette inks, restrained halftone accents, two-column-or-one-column responsive cards, compact operational text, and clear primary actions. They continue to use the original DataContext mutation APIs and domain fields.

The illustration classes do not create new Action/Supply types, derived task occurrences, persistent artwork data, stock quantities or revision semantics.

## 2. Actions

- `ActionsPage.tsx` handles search, family filtering, editor open/close and existing `addAction`, `updateAction`, `archiveAction` callbacks.
- `ActionLibraryCard.tsx` shows name, original optional icon, instructions, default supplies, stored revision and Edit/Archive actions. Archive is disabled if **any non-archived routine** references the Action, as before.
- `actionPresentation.ts` supplies action-family identification through the existing EN/IT matcher. It deterministically selects one authored tool (vacuum, mop, duster, cloth, brush, spray or generic tool) and a small repeatable expression/pose/ink variation from Action ID plus visual version. It never supplies a TaskOccurrence or triggers a recurrence.
- `ActionEditorSheet.tsx` preserves Name, Icon, Instructions, Default Supplies and custom Metadata, including all original create/update payload fields. Save completion closes the sheet; failed saves stay open with a localized accessible error.

## 3. Supplies

- `SuppliesPage.tsx` shows counts for Available, Low, Reserve only and Out of stock. Counts double as optional filters. Search and status filtering do not mutate data.
- `SupplyLibraryCard.tsx` shows name, optional icon, qualitative status, optional quantity/unit, stock history, Edit and Archive. All four qualitative quick-status buttons retain text and `aria-pressed` state. A quick change invokes **only** the existing offline-safe `setSupplyStatus` mutation, with a temporary busy state and localized retry message on failure.
- `supplyPresentation.ts` maps EN/IT supply names into safe authored SVGs, with a guaranteed `generic-supply` fallback. Status maps to independent expression/gesture pairs: proud, worried, focused, tired. Colors are semantic; the badge/status text remains authoritative.
- `SupplyEditorSheet.tsx` preserves Name, Icon, Status, optional Quantity/Unit and custom Metadata and passes the original `addSupply`/`updateSupply` payload shape. Optional quantity is still edited in the form. **No ad-hoc +/- buttons** were introduced because they would bypass/reinterpret the existing qualitative offline mutation path and optimistic status-version contract.
- `SupplyHistorySheet.tsx` reads canonical `data.supplyEvents` newest-first and formats timestamps in the workspace timezone. The task-context `sourceTaskId` continues to be recorded by the untouched mutation layer.
- Archive remains disabled when a non-archived Action requires that product or a non-archived Routine has a stock override referencing it, exactly as in V1.

## 4. Changed / added files

| Area | Paths |
|---|---|
| Actions library | `src/pages/ActionsPage.tsx`, `src/components/actions/{ActionLibraryCard,ActionEditorSheet,actionPresentation}.{tsx,ts}` |
| Supplies cabinet | `src/pages/SuppliesPage.tsx`, `src/components/supplies/{SupplyLibraryCard,SupplyEditorSheet,SupplyHistorySheet,supplyPresentation}.{tsx,ts}` |
| Design system | `src/styles/actions-v2.css`, `src/styles/supplies-v2.css`, two imports in `src/main.tsx` |
| QA | `tests/v2_phase12_actions_supplies.test.ts`, `tools/build-v2-phase12-proof.cjs`, `design/v2/page-reference/v2-phase12-actions-supplies.svg` |
| Tooling | one `build:v2-phase12-proof` package script |

**Not changed:** DataContext, schema/domain types, scheduler, cleanliness, TaskOccurrence services, local/offline mutation handlers, Supabase, Home, Overview, Timeline and Routines.

## 5. Visual implementation and guardrails

- SVGs are built from the authored V2 registry; no base64/raster embeds, background tasks, or runtime AI.
- Artwork IDs are scoped using the existing `SvgCharacter`/`renderManualCharacterSvg` host. Optional detail variance is seeded by Action/Supply ID plus `HOUSE_CARE_VISUAL_VERSION`, not time or random input.
- Existing semantic CSS inks ensure retro and custom themes recolor the art without persisting new palette fields.
- Titles, instructions, supplies, stock state and controls remain normal HTML; `body[data-v2-no-art="true"]` hides visual art only.
- Mobile layouts collapse the card grid and resize illustrations. `overflow-wrap:anywhere` covers arbitrarily long user-entered names.
- Reduced motion is honored. Focus indicators are visible on buttons, search and selectors. Editor/supply-status errors use `role="alert"`.

## 6. Validation performed

| Check | Result |
|---|---|
| Strict TypeScript compilation of new pure presentation modules / pure tests | **Pass** (included in test compile) |
| Phase 12 focused test (after final error-handling changes) | **Pass** |
| V1 + V2 pure regression runner (before final error-message-only changes) | **Pass**, including existing 10,000-recipe procedural suite |
| Full regression runner reattempt after final error-message-only changes | **Timed out in the pre-existing Phase 5 procedural stress suite**; phases before that, including Phase 12, passed; no failing assertion reported |
| `npm run check:version` | **Pass** (`1.2.1-r4`) |
| `npm run validate:vectors` | **Pass** (108 authored/brand SVG files) |
| New TSX syntax check | **Pass** for seven files |
| New CSS parse check | **Pass** for two files |
| Development SVG contact sheet XML / unique IDs / zero raster embeds | **Pass** |
| Comparison with Phase 11 core domain and other-page source | **Unchanged** |
| Full React/Vite typecheck + production build | **Not verified**: no `node_modules` or npm registry DNS in this environment |
| Live PWA/browser/mobile visual and operational acceptance | **Not verified**; requires a browser-running app with installed dependencies |

`design/v2/page-reference/v2-phase12-actions-supplies.svg` is a **source-vector art proof**, not an actual screenshot of the application. The PNG QA preview is outside the repository snapshot.

## 7. Browser acceptance checklist (still open)

1. **Actions:** create a definition with custom name, 4-character icon, instructions, multiple supply IDs and metadata; save, reload, edit and verify revision/scheduling effects match V1. Verify archive disabled for actions referenced by non-archived routines and enabled for unused actions.
2. **Supplies:** create/edit with all statuses, missing and present quantities, fractional quantity, custom units, metadata; verify save, reload, optional history and archive eligibility. Check quick status changes online/offline, including conflict/version behavior.
3. **Task context:** report stock from a task and verify its `STOCK_CHANGED` history event records `sourceTaskId`; check display on Supplies and inside task sheets.
4. **Filters and artwork:** test EN/IT names, generic fallback, no-art mode, deep/dark/custom palettes and very long user-provided strings.
5. **Interaction/a11y:** narrow 320/375 px screens, tablet/desktop 2-column views, 200% zoom, keyboard-only focus, reduced motion, large Italian text, focus restoration after sheet dismissal and accessible status-button names.
6. **Smoke build:** `npm install`, `npm run typecheck`, `npm run build`, `npm test`, then launch local-only mode and validate browser interactions before release approval.

## 8. Exit and handoff

Actions and Supplies both use V2 presentation while retaining the existing domain model and mutation entry points. This completes the **Phase 12 source scope**. Full runtime acceptance remains gated by the unresolved Phase 0 dependency/build availability and Phase 9 device/browser stabilization gate. Do not start Phase 13 as part of this snapshot.
