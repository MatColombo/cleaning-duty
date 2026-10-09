# House Care V2 — Phase 6 shell and navigation

**Scope:** Implementation of the V2 shell/navigation only, from the Phase 5 repository archive. No domain-engine, page-content, procedural visual, storage, schema, notification, or sync refactoring.

**Status:** Phase 6 source changes and pure tests complete; **full integrated UI build/browser verification remains blocked** by the Phase 0 npm-dependency networking issue. This is not a release-ready verification claim.

## Changes

- `src/components/AppShell.tsx` now composes `AppHeader`, `RuntimeBanners`, `HouseMenuButton`, `HouseMenuSheet` and the unchanged `Outlet`. The former bottom nav is no longer rendered.
- `src/components/AppHeader.tsx` holds the compact branded header and the unchanged `WorkspaceSwitcher`, plus saving/pending-sync status.
- `src/components/RuntimeBanners.tsx` owns the unchanged update-ready event, service-worker activation and reload behavior, offline state, sync-conflict reporting/dismissal, and global error/diagnostic actions.
- `src/components/HouseMenuButton.tsx` is the sole persistent floating menu trigger, exposed as a labeled dialog opener with `aria-expanded`.
- `src/components/HouseMenuSheet.tsx` uses the existing `Sheet` modal (dialog semantics, Escape, backdrop dismissal, focus trap/return), and eight localized destinations with `aria-current="page"` for the selected destination.
- `src/navigation/houseNavigation.ts` is a pure, typed, canonical destination registry and route-alias helper; no task logic is introduced.
- `src/components/LegacyRouteRedirect.tsx` preserves query strings and hash fragments for aliases.
- `src/components/dialogFocus.ts` extracts a pure focus-wrapping decision, now used by the existing `Sheet` component. Other sheet behaviors remain unchanged.
- `src/styles/shell.css` styles only the V2 header, floating menu trigger and navigation sheet. The old `.bottom-nav`/`.nav-item` selectors are removed from `src/styles.css`; other V1 page styles remain intact.
- `src/lib/translations.ts` adds EN/IT labels for Timeline, Analysis, House Menu, opening menu and selected section.

## Route mapping

| Route | Phase 6 destination | Notes |
|---|---|---|
| `/` | `OverviewPage` | Legacy V1 Overview content remains until later phases |
| `/timeline` | `OverviewPage` (temporary bridge) | **Not yet extracted.** Finished/Upcoming/date browsing remain accessible through the same V1 Overview content. Phase 7 introduces dedicated Timeline |
| `/home` | `HomePage` | Existing page unchanged |
| `/routines` | `RoutinesPage` | Existing page unchanged |
| `/actions` | `ActionsPage` | Existing page unchanged |
| `/supplies` | `SuppliesPage` | Existing page unchanged |
| `/analysis` | `InsightsPage` | Canonical Analysis route |
| `/settings` | `SettingsPage` | Existing page unchanged |
| `/today` | replace redirect to `/` | Query/fragment preserved |
| `/insights` | replace redirect to `/analysis` | Query/fragment preserved |
| `/task/:taskId` | existing `OverviewPage` task-detail handler | Exact occurrence deep link remains stable, including notification URLs; phase 7/8 handle future state-dependent placement |
| `/settings?errors=1` | existing diagnostics route | No behavior changes |

Unknown routes still redirect to `/`. Existing Home query links (`/home?item=...`) are left unchanged; selection consumption remains a documented future Home-phase task. No work is performed in Phase 6 on future/handled-task redirection or Timeline-specific occurrence projection.

## Preserved runtime services

- Theme application (`applyTheme`) remains in shell.
- Push subscription synchronization (`syncPushSubscription`) remains triggered for eligible cloud/household/member combinations.
- App badge count computation and set/clear actions remain unchanged.
- Workspace switching is the existing component and retains both local and cloud behaviors.
- Update-ready, offline, sync-conflict, error/diagnostics banners retain their current triggers/actions.
- All previously rendered application pages and setup/auth flows remain as implemented.

## Accessibility/responsiveness

- Floating menu control respects bottom/right safe areas; target is 62px; fixed to the right edge of the application content on wide screens.
- Modal uses existing `Sheet` semantics: `role="dialog"`, `aria-modal="true"`, initial focus on the close control, Escape, backdrop close, Tab/Shift+Tab wrapping, and return to the trigger on dismiss.
- Browser history/navigation changes also close the menu.
- 8 destinations are available in one column on small screens or two columns when the modal has room; existing Sheet scrolls inside the viewport on short screens.
- Existing `prefers-reduced-motion` handling is retained and a dedicated trigger override disables animation.
- The active route is marked with visible state and `aria-current`. Task deep links select the Overview menu item.

## Verification performed

- `npm test`: **PASS**, including Phase 0 baseline, all V1 domain suites, Phase 2–5 visual tests, `v2_phase6_shell_navigation.test.ts`, version consistency and validation of 80 SVGs.
- Phase 6 test: **PASS**, covers eight destinations/order, EN/IT labels, canonical/legacy aliases, query/hash retention, route identity, task deep links, Tab/Shift+Tab modal-wrap logic, focus-return wiring, banner/notification/badge wiring presence, safe-area/reduced-motion stylesheet invariants, and removal of bottom-nav markup/selectors.
- Isolated strict `tsc` compile for new pure navigation/focus modules: **PASS**.
- TypeScript parse/transpile for edited TS/TSX modules: **PASS**.
- `tinycss2` parsing for old and new CSS: **PASS**, no syntax errors.

## Verification blocked (do not mistake for pass)

- npm registry is unreachable from this sandbox (`EAI_AGAIN registry.npmjs.org`). React, React Router, Phosphor, Vite and their declaration packages cannot be installed.
- `npm run typecheck` fails at missing frontend modules/JSX runtime; `npm run build` cannot be verified.
- Actual mobile/desktop interactive browser navigation, modal focus restoration, route animation and installed-PWA behavior have not been exercised against the running React app.
- Physical-device safe-area and reduced-motion behavior has not been measured.

### Required live-browser acceptance when dependencies are available

1. Launch local-only app, switch all eight House Menu destinations, confirm pages and history state remain reachable; Timeline intentionally mirrors Overview until Phase 7.
2. Open menu, press Escape and verify focus returns to floating trigger. Repeat with close button and backdrop. Cycle Tab/Shift+Tab across all links.
3. Open on 320px phone, short-height phone and tablet; verify header text is reachable, trigger stays within safe areas, all menu links remain scrollable.
4. Verify reduced-motion mode has no moving menu UI.
5. Verify `/today`, `/insights?days=30#history`, `/task/<real occurrence id>`, `/settings?errors=1`, normal bookmarked routes and push deep links.
6. Verify working workspace switcher (local and cloud), offline/banner states, conflict dismissal, update activation, error details and app badge semantics.
7. Run `npm install`, `npm run typecheck`, `npm run build` and repeat `npm test`.

## Phase boundary

**Not started:** Phase 7 dedicated Timeline and chronology extraction, Phase 8 Care Cards/Overview, and any later page redesign or procedural art integration.
