# House Care V2 — Phase 8 Flagship Overview

**Implementation date:** 2026-10-08  
**Starting point:** Phase 7 Timeline snapshot (`cleaning-duty-phase7-timeline.zip`)  
**Scope:** V2 Overview presentation and its existing task-action orchestration only. No database, scheduler, cleanliness, task state, cloud, notification, or Timeline changes.

## Result

The default Overview uses **exactly two primary sections**:

1. **House State** — Regular and Deep channel percentages, with independent meters and authored vector mascots, plus the existing configurable merged critical-entity projection. Critical items appear in a horizontally scrollable rail and retain links to their Home entities.
2. **Active Deck** — one operational Care Card at a time, drawing from `buildOverviewGroups` in canonical priority order: overdue, due now, later today. A user can cycle using explicit Previous/Next buttons or keyboard arrows while the deck region has focus. No swipe is required. The count reflects concrete occurrences.

A completed card leaves the actionable deck through the existing `completeTask` operation. A brief edition stamp appears only **after** a successful completion event. The existing Undo snackbar remains usable. If completion fails, no success stamp is shown and an alert is displayed.

## New files

- `src/lib/overviewDeck.ts` — pure projection of existing buckets; presentation context (real stock alerts, task assignment, optional item cleanliness, real linked children); household-calendar overdue-day helper; cyclic navigation index.
- `src/components/overview/HouseState.tsx`
- `src/components/overview/CleanlinessPanel.tsx`
- `src/components/overview/CriticalEntityCard.tsx`
- `src/components/overview/ActiveDeck.tsx`
- `src/components/overview/CareCard.tsx`
- `src/components/overview/CareCardMeta.tsx`
- `src/components/overview/LinkedActivityAppendix.tsx`
- `src/components/overview/CardArtwork.tsx`
- `src/components/overview/OverviewEmptyState.tsx`
- `src/styles/overview-v2.css`
- `tests/v2_phase8_overview.test.ts`

## Modified files

- `src/pages/OperationalTasksPage.tsx`: shared orchestration still owns scope, clock, the canonical group query, task selection, reschedule/reassign/task-detail sheets, Undo and existing mutations. Only the `view='overview'` presentation branch was replaced; the Timeline branch remains unchanged. `OverviewPage.tsx` remains the thin page entry point so the existing shared workflow is not duplicated.
- `src/components/AppShell.tsx`: adds a route-specific shell class that removes *only* the obsolete bottom padding for the Overview cockpit. Other pages retain original shell spacing and menu behavior.
- `src/main.tsx`: imports Overview-specific CSS after existing styles.
- `src/lib/translations.ts`: EN/IT labels for House State, Active Deck, navigation, card completion, Extra Care, overdue-day text, success/failure.

## Domain and information contracts

- `buildOverviewGroups` remains the only source for due status, ordering, critical threshold/selection and member scope. No duplicate status classifier.
- `buildActiveDeck` concatenates the existing already sorted `overdue`, `dueNow` and `laterToday` buckets. **Every child occurrence remains its own entry.** No virtual rewards or additional rows.
- The parent card's Extra Care appendix appears only when `additionalActivityAppendix` finds an actual linked occurrence. The user may focus the child card or open its existing task sheet.
- `CardArtwork` obtains `CardVisualRecipe` from the Phase 5 module-wide bounded cache and renders its SVG from authored Phase 4 primitives. CardArtwork supplies a five-ink semantic palette (surface, ink, primary, due/mustard, overdue/coral) to the existing generator-v1 renderer. Only the foreground Care Card instantiates detailed procedural SVG. Rear cards are plain CSS layers; no raster data or recipe is written to persistence.
- Task titles, Action, targets, due context, assignment, relevant cleanliness, low/out-of-stock warning and task actions remain operational HTML, separate from decorative SVG.
- The existing task detail sheet retains Skip, Reassign, multi-target completion, Stock reports, child actions, explanation, history and Restore. Reschedule stays the existing sheet. Undo remains the existing mutation.
- Critical item cleanliness and home Regular/Deep cleanliness reuse the existing canonical cleanliness engine without new estimates.

## Accessibility and responsive rules

- Real text, live meters with `role="meter"`, semantic headings, buttons and descriptive labels; decorative vector art uses `aria-hidden`.
- The active deck has Prev/Next buttons and optional ArrowLeft/ArrowRight key support when its region is focused. No mandatory gesture.
- Normally the 2-section cockpit is viewport-first; a short screen or narrow/large-type display falls back to vertical overflow rather than truncation.
- The floating House Menu remains accessible, with reserved lower-page clearance. The shell's former bottom padding is suppressed only on `/` to avoid accidental whole-page scrolling on ordinary phones.
- Completion stamp and transitions honor `prefers-reduced-motion`; no background animation, per-card turbulence or continuous repaint loop.
- All new operational labels are localized for English and Italian.

## Validation

- `npm test` **passes**: existing V1/V2 regression suite, vector hygiene and Phase 8 coverage.
- New pure test checks canonical ordering/scope, chronological/DST day counting, linked-child independence and genuine appendix, displayed Stock alert, real complete/Undo/Skip/postpone mutations with stable occurrence IDs, unknown-activity fallback SVG, two SVG instances without ID collision, EN/IT labels, shared task-sheet wiring and reduced-motion/short-screen CSS.
- Strict isolated TypeScript compilation passes for the pure `overviewDeck` domain-presentation helper and the Phase 8 pure tests.
- Edited JSX files pass standalone TypeScript syntax transpilation.

**Open verification blockers inherited from Phase 0:** frontend `node_modules` and a resolvable npm registry are unavailable in this sandbox (`EAI_AGAIN`). A full React/Vite typecheck, production build, authenticated live-browser screenshots and physical-device performance profiling are **not** verified. Do not claim full release readiness based on pure-unit tests alone.

## Manual/browser acceptance to complete when dependencies are available

1. On a phone-sized viewport (e.g. 390×844), check House State + Active Deck with no ordinary whole-page vertical scroll; critical rail remains independently scrollable. Also check 320×568 and 200% type for accessible vertical overflow.
2. Switch My/Household and verify the task count and identities; overall cleanliness should not change with scope.
3. Complete a front overdue card and check: no new occurrence, no completion stamp before commit, next card advances, Undo restores same ID.
4. Open More and exercise Skip, Reassign, per-target completion, low-stock change and task history.
5. Reschedule the front card and confirm it moves to Timeline when appropriate, with no second old-time occurrence.
6. Confirm an every-N child appears as both a real independently actionable occurrence and a parent Extra Care appendix; no appendix on non-triggered configuration.
7. Verify `/task/:taskId` for active/handled/future occurrences; query-based task sheets still open exactly the requested occurrence.
8. Test zero tasks, no critical items, untracked Regular/Deep, a nonsense-named custom activity, EN/IT, dark/custom themes, reduced-motion and offline/update banners.
9. Profile real device frame rate and memory in the SVG-heavy front card. No offscreen full-card art should render.

**Phase boundary:** Phase 9 art-system stabilization and Phase 10+ secondary page redesign remain untouched.
