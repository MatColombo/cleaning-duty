# House Care V2 — Phase 10 Home Redesign Handoff

**Baseline:** Phase 9 source snapshot (`cleaning-duty-phase9-stabilization.zip`)
**Scope:** Home-only presentation refactor; V2 SVG artwork and room-mode presentation
**Status:** **Source implementation complete; release/architecture approval conditional** on full dependency-backed typecheck/build and real-browser/mobile functional and visual acceptance. Phase 9's live-browser/device gate is also still open.
**Not in scope:** Phase 11 Routines or any other secondary-page redesign; data/schema, scheduling, cleanliness, spatial geometry, or task-mutation changes.

## 1. Product outcome

- **Home header:** compact V2 retro-vector branded header with the original edit-mode toggle and two **separate**, existing-engine Regular / Deep cleanliness scores. Normal mode uses a composed SVG house mascot; edit mode subdues decoration.
- **Home canvas:** the actual `HomeLayoutCanvas` component and its pan, zoom, fit, selection, editing, geometry, relationships, background, and room-status drawing logic are not modified. Existing due/overdue outlines remain the source of map emphasis; the surrounding frame adds only an explanatory text legend.
- **Normal inspector:** extracted `HomeInspector` with an authored SVG selected-entity/room motif, both cleanliness channels, current work, canonical Overdue / Today / Upcoming room groups, linked-activity appendix, explicit qualitative Stock alerts, and Start Room action.
- **Room mode:** extracted `RoomModeController` (same original `completeTask`, `skipTask`, Undo-event tracking and session-local Later order) and `RoomModeSheet` (one Phase 5 procedural V2 Care Card image and intact Done / Skip / Later UI). No extra occurrences or room-specific task model.
- **Compatibility:** `/home?item=<entityId>` now reveals a real, unarchived semantic entity and its current layout placement/scene when one exists; an unplaced entity remains inspectable without manufacturing layout data.
- **Readability:** state words and percentages are ordinary HTML and survive no-art mode. Responsive layouts protect long labels; SVG is decorative. Reduced-motion styling is explicit.

The page adds restrained retro typography, semantic inks and authored SVGs; dense halftone/textures are **not** drawn over the editable floor plan or precise edit controls.

## 2. Files and responsibilities

| File | Purpose |
|---|---|
| `src/pages/HomePage.tsx` | Keeps orchestration, semantic selection, scene switching, edit sheets and original canvas callbacks; delegates V2 presentation |
| `src/components/home/HomeStatusHeader.tsx` | V2 Home title, separate cleanliness status, edit toggle |
| `src/components/home/HomeInspector.tsx` | Read-only normal-mode inspector, work/stock/channel components, selected-object SVG |
| `src/components/home/RoomModeController.tsx` | Existing room task queue, Complete, Skip, Later and Undo-event callback wiring |
| `src/components/home/RoomModeSheet.tsx` | Presentational room Care Card and actions using generator-v1 artwork |
| `src/components/home/homeArtwork.ts` | Decorative, English/Italian-aware entity-type/object-to-authored-SVG selection; generic fallback |
| `src/components/home/homeSelection.ts` | Semantic-item deep-link selection and optional real placement |
| `src/components/home/homeTaskTime.ts` | Existing household-timezone task date/time presentation |
| `src/components/home/roomPresentation.ts` | Pure, non-mutating room-session Later ordering |
| `src/styles/home-v2.css` | Scoped V2 Home visuals and responsive/accessibility behavior |
| `src/main.tsx` | Imports the scoped Home stylesheet after Overview stylesheet |
| `tests/v2_phase10_home.test.ts` | Phase 10 direct and source-contract regression tests |

**No new persisted fields, database migration, new task state, or new procedural-art recipe generation was introduced.**

## 3. Preservation/invariant audit

Compared SHA-256 against the Phase 9 ZIP. All ten core files are **byte-for-byte unchanged**:

- `src/components/HomeLayoutCanvas.tsx`
- `src/lib/home.ts`
- `src/lib/room.ts`
- `src/lib/cleanliness.ts`
- `src/lib/mutations.ts`
- `src/lib/overview.ts`
- `src/lib/scheduler.ts`
- `src/types/domain.ts`
- `src/contexts/DataContext.tsx`
- `src/lib/date.ts`

The Home canvas **calls `onSelectElement` followed by `onSelectEntity`**; the Home page preserves its original `onSelectEntity={setSelectedEntityId}` wiring. This was explicitly checked/fixed so geometry handles and edit-inspector controls do not lose the selected layout element.

The room-session Later button changes only a local UI ordering array; it neither reassigns tasks nor reschedules them. Both Done and Skip call the original DataContext methods; the Undo snackbar uses their returned event IDs.

## 4. Tests available in this environment

| Check | Outcome |
|---|---|
| Canonical version check (`1.2.1-r4`) | Passed |
| Source SVG validation (108 files) | Passed |
| Existing V1 domain regressions | Passed |
| V2 Phases 2–9 pure/source regressions | Passed |
| Phase 10 source/pure regressions | Passed |
| Phase 10 real Skip → Undo on same occurrence | Passed |
| Home canvas/source preservation SHA comparison | Passed, 10/10 unchanged |
| Edited TSX parse | Passed, 5/5 |
| Full project React/TypeScript typecheck | **Not verified** — npm dependencies unavailable |
| Vite production build | **Not verified** — npm dependencies unavailable |
| Real-browser screenshots / visual rendering | **Not verified** — local Chromium screenshot capture failed |
| Physical phone pan/zoom, performance, accessibility | **Not verified** — requires device/browser |

The full pure/source suite includes 10,000 procedural recipe samples. These tests are important but are **not** substitutes for verifying actual event handling or performance in a browser.

## 5. Browser acceptance checklist to finish the gate

Use a seeded/imported pre-V2 household and one recent real household. Validate on a narrow phone (~320–390 CSS px) and desktop, in EN and IT, with large font and reduced-motion setting.

1. **Scenes:** switch between a floor and an outdoor scene; confirm selection clears, zoom resets and fit updates. Open an existing `/home?item=<entityId>` from a critical-item card and confirm the right scene and entity inspector open (with and without a placement).
2. **Normal map:** fit, wheel/touch drag pan, zoom ±/readout, select a room, select an item, deselect via empty area, navigate connections. Verify badge outlines match Overdue / Today labels.
3. **Edit mode:** toggle Edit; select room and object with mouse, keyboard and touch. Confirm the selected element remains highlighted; drag/resize/rotate; edit polygon/vertices; snap; label position, orientation, wrap, font, colors; add/remove elements and connections; scene settings, add/archive scene; semantic entity edit/archive; exit edit and verify saved layout.
4. **Inspector:** compare both cleanliness scores with existing Home/Overview data; review an item with no tracked score, overdue/today/upcoming room task groups, independent linked child, configured additional activity, long EN/IT custom names, Stock reserve/low/out alerts, and a room with no due tasks (disabled Start Room).
5. **Room mode:** enter from a due/overdue room. Check chronological queue, Done confirmation and mutation, Skip confirmation and mutation, Later ordering without rescheduling/reassignment, next card, handled count, empty session, close/reopen, and Undo restoring the **same** occurrence. Verify Stock and linked-child information on the actual current occurrence.
6. **Failure states:** a failing task mutation must not show success/advance as completed; confirm safe behavior under offline/conflicted sync and while changing household.
7. **Visual:** inspect the original floor-plan shapes for unwanted overlays and texture, status/Stock contrast in every theme, narrow/mobile overflow, long labels, without artwork (set `body[data-v2-no-art="true"]`), and prefers-reduced-motion.
8. **Performance:** profile map interaction and one procedural SVG in room mode on an actual low/mid-range mobile device; compare against Phase 9 baseline before certifying performance.

For full verification in an environment with npm registry access:

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Do **not** mark the Phase 10 runtime exit criteria fully met until the browser checklist and full build pass. Do not start Phase 11 as part of this snapshot.
