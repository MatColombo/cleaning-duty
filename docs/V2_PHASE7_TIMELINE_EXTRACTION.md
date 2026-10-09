# House Care V2 — Phase 7 Timeline Extraction

**Status:** Source implementation complete; available automated regression suite green. Dependency-backed Vite/React build and live-browser acceptance remain open (carried over from Phase 0).

**Baseline:** `cleaning-duty-phase6-house-menu.zip` (Phase 6 snapshot). No schema, mutation-service, scheduler, recurrence, cleanliness, notification, backup or Supabase changes.

## 1. Intent and non-goals

Timeline now owns the chronological sections that formerly appeared below the daily operational work in Overview. The first Timeline remains functionally conservative: it reuses V1 task cards, disclosure, date rail and sheets, rather than implementing the later V2 Care Card art or visual layout.

Overview now renders **only** its existing home cleanliness/critical rail and its existing overdue, due-now and later-today operational task sections. Phase 8 will redesign these sections into House State + Active Deck.

No domain changes, generated occurrences, additional persistence, new card system or procedural art integration were introduced.

## 2. Source architecture

- `src/pages/OverviewPage.tsx` → small entry wrapper, `view="overview"`.
- `src/pages/TimelinePage.tsx` → new entry wrapper, `view="timeline"`.
- `src/pages/OperationalTasksPage.tsx` → shared projection, lifecycle-reconciled selection, old task cards and all existing action/detail sheets. No duplicate task mutation implementations.
- `src/lib/timelineNavigation.ts` → pure seven-day local calendar and task deep-link destination helpers. It uses `dedupeOccurrences`, the existing canonical lifecycle reconciliation; a superseded duplicate physical row is not reactivated by a stale deep link.
- `src/pages/TaskRouteResolver.tsx` → stable `/task/:taskId` push/bookmark entry, redirecting to the appropriate canonical page or showing a localized unavailable state.
- `src/App.tsx` → `/timeline` now renders `TimelinePage`, and `/task/:taskId` renders `TaskRouteResolver`. `/today`, `/insights`, and the remaining routes retain their Phase 6 behavior.
- `src/lib/translations.ts` → localized Timeline description and unavailable-task copy (EN/IT). Updated Overview description to match its narrower daily ownership.

No new visual primitives, changes to the V2 generator, new database tables, or new form workflows were added.

## 3. Ownership after the extraction

| Surface | Sections | Data authority |
|---|---|---|
| Overview `/` | Regular/Deep home cleanliness, critical items, overdue, due now, later today | `homeCleanlinessSummary`, `buildOverviewGroups` |
| Timeline `/timeline` | Finished (completed/skipped/postponed today), next seven days, day selection, task detail and restore | **Same** `buildOverviewGroups` and `canonicalTaskState` |
| Deep link `/task/:taskId` | Exact occurrence resolution, no cloned tasks | Same `dedupeOccurrences` / lifecycle reconciliation |

The shared `buildOverviewGroups` projection is deliberately unchanged. It continues to deduplicate occurrences by canonical slot, use task lifecycle events as authority, use the household timezone, and keep today's postponed-away occurrences mutually exclusive with Upcoming.

Timeline uses the existing `groupLinkedTaskOccurrences` and `additionalActivityAppendix` presentation logic. Linked children remain independent occurrences and can be opened by their own ID.

## 4. Chronology behavior

- **Finished** opens expanded on Timeline. A scheduled task that was postponed away today displays a Rescheduled status and is not also in the normal upcoming list.
- **Upcoming** is the next seven household-local dates, beginning tomorrow. Date selection is reflected in the `day=` query so a notification/deep link can select the correct day. The date group uses native buttons and `aria-pressed`, so horizontal gestures are not required.
- **Details and mutations** share the unchanged Done, Skip, Reschedule, Reassign, Stock, partial-target, linked-child, Restore to today, Undo and event-history handlers. The Timeline never invents a replacement occurrence.
- **Scope** uses the same My tasks / Household tasks semantics as Overview and defaults to My tasks when there is a current member.

## 5. Stable notification/deep-link behavior

`/task/:taskId` remains the external notification URL:

- scheduled overdue/today → `/?task=<exactId>`;
- scheduled future → `/timeline?task=<exactId>`;
- scheduled future in the next seven days → also `&day=YYYY-MM-DD`;
- completed or skipped (including historical) → `/timeline?task=<exactId>`;
- scheduled postponed away today → Timeline;
- linked child → classified by **its own** canonical state and effective due time;
- missing, cancelled or superseded duplicate-slot ID → localized unavailable state with links back to Overview and Timeline.

The selected occurrence detail opens even when a future task is **outside** the seven-day preview or a handled task is **older than today**. The query is removed with `replace` when the detail sheet is closed, preserving a selected `day` parameter where present.

The existing `/today` and `/insights` aliases still redirect as before. `/home?item=` consumption is explicitly not part of this phase; it remains deferred to the Home redesign per the Phase 1 contract.

## 6. Checks performed

- `npm test`: **PASS**, including the Phase 0 baseline, the full V1 domain/lifecycle suites, V2 Phases 2–6, the new Phase 7 tests, version consistency and SVG validation.
- Phase 7 pure test: **PASS**, including completed, skipped, postponed, reopened, stale-completed, older-completed, overdue/due-now/later-today, future outside range, linked child grouping, seven-day selection, household timezone across midnight and DST, missing/cancelled/superseded deep links, and a real `reopen_today` mutation preserving ID and scheduled slot.
- Edited TSX/TypeScript modules: TypeScript parse/transpile diagnostics **PASS**.
- Full `npm run typecheck` / `npm run build`: **NOT VERIFIED**. The current sandbox has no installed React/Vite/Phosphor/Supabase dependencies. Typechecking reports missing React/React Router/JSX modules and cascading missing JSX typings; these are preexisting Phase 0 infrastructure blockers, not a green build.
- Live phone browser, focus/keyboard, PWA push and cloud execution: **NOT VERIFIED**, and remain required before release.

## 7. Live-browser smoke checklist when dependencies are available

1. Open `/` and confirm Finished/Upcoming/day rail are **absent**, but cleanliness, critical entities, overdue/due-now/later-today tasks and mutation sheets remain usable.
2. Navigate House Menu → Timeline. Confirm Finished opens expanded and Upcoming shows exactly seven future household-local dates; select empty and populated days by mouse, touch, keyboard and browser history.
3. Complete, skip and reschedule a task today. Verify it appears once in Timeline Finished, changes remain consistent with Overview, and Undo works.
4. Use More → Restore to today on a completed, skipped or postponed-away occurrence; confirm the same occurrence returns to Overview and does not duplicate.
5. Open future tasks and reschedule/reassign through the existing sheets. Check Stock and partial-target controls.
6. Open `/task/<activeId>`, `/task/<futureId>`, `/task/<handledId>`, and a linked child's ID directly. Verify canonical redirect, exact sheet selection and selected future day.
7. Open a future ID beyond seven days; verify its sheet is still accessible despite not being on the normal rail.
8. Open a nonexistent/cancelled ID; verify localized unavailable state rather than an unrelated task.
9. Confirm `/today`, `/insights`, `/settings?errors=1` and household switching remain functional; test EN and IT, short screens and large text.
10. Run `npm install`, `npm run typecheck`, `npm run build` and the real browser/E2E suite with dependencies available.

## 8. Exit and next phase

The Phase 7 source migration is complete and the available pure regression suite is green. **The full acceptance gate is still conditional on the outstanding Phase 0 frontend build/browser checks.** Phase 8 visual redesign, new Care Card interaction, deck animation and procedural vector integration are intentionally not started in this snapshot.
