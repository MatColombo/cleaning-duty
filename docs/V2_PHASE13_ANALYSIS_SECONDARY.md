# House Care V2 — Phase 13: Analysis & Secondary UI Surfaces

**Scope:** Presentation-only migration from the Phase 12 Actions/Supplies snapshot. This phase does **not** implement the Phase 14 boot-screen or PWA asset work, a new analytics calculation, procedural data, or any schema change.

## 1. Implementation

### Analysis

- `InsightsPage.tsx` is reduced to orchestration and still calls exactly the same projection functions with the same arguments:
  - `todayActivitySummary(data, now)`
  - `activityOutcomeSummary(data, days, now)`
  - `cleanlinessTrend(data, days, now)`
  - `historyEntriesV12(data, Math.max(days, 30), now)`
- The canonical household-timezone history grouping remains unchanged.
- `AnalysisDashboard.tsx` presents a restrained retro hero with an authored house mascot; 7/30/90-day buttons; four separate today outcome tiles; Regular/Deep trend charts; proportional period-outcome bar plus explicit legend and values; and an expandable activity-history timeline.
- Charts use the existing 0–100 projection, plotting coordinates and null/not-tracked treatment. Halftone and character art are **outside** plotted data and grids.
- History preserves per-event actor, previous/new due times, cleanliness refresh details and `/task/:taskId` deep links. History rows intentionally use light status icons, not full procedural thumbnails, to avoid rendering expensive SVGs for potentially long event histories.
- `analysisPresentation.ts` computes only zero-safe proportions for a decorative stacked bar. It does not change outcome counts.
- Long labels wrap, no-art styling hides only decorative images, and the chart SVG has a numeric accessible label.

### Shared Sheet/modal

- `Sheet.tsx` receives V2-specific CSS classes for sheet, backdrop and header. The original scroll lock, initial focus, Tab wrap, Escape, backdrop dismissal, focus return, portal, ARIA dialog semantics and destructive-confirmation callers remain as before.
- `secondary-v2.css` changes paper/surface treatment, headline typography, outline, spacing, safe-area sizing, min-size for touch targets and visible focus styling. No procedural artwork or new workflow is introduced into sheets.

### Settings, authentication and setup

- `V2BrandLockup` uses the already-authored V2 compact vector mark and text typography; it does not create or store a new brand asset.
- Auth and setup forms retain their previous inputs, authentication methods and household create/restore/delete logic.
- Settings retains workspace, people, metadata, notifications, appearance/custom palettes, PWA install, backup import/export, error log, and local reset/Sign out operations. Only header/section framing and decorative artwork are updated.
- `BootScreen.tsx`, PWA manifest, notification behavior and service worker are intentionally unchanged until Phase 14.

## 2. Files

**Added:**

- `src/components/analysis/AnalysisDashboard.tsx`
- `src/components/analysis/analysisPresentation.ts`
- `src/components/brand/V2BrandLockup.tsx`
- `src/styles/analysis-v2.css`
- `src/styles/secondary-v2.css`
- `tests/v2_phase13_analysis_secondary.test.ts`
- `tools/phase13-render-smoke.cjs`
- `design/v2/page-reference/v2-phase13-analysis-static.html` (static design proof; **not** a running-app screenshot)
- this handoff report

**Modified:** `InsightsPage.tsx`, `Sheet.tsx`, `SettingsPage.tsx`, `AuthPage.tsx`, `SetupPage.tsx`, `main.tsx` (new CSS imports).

**Unchanged from Phase 12:** 18 protected files including `lib/analytics.ts`, `lib/cleanliness.ts`, `lib/scheduler.ts`, `lib/overview.ts`, `lib/mutations.ts`, `lib/backup.ts`, `lib/theme.ts`, domain types, `DataContext.tsx`, Timeline, Overview, Home, Routines, Actions and Supplies.

## 3. Validation status

| Check | Result |
|---|---|
| Phase 13 focused runtime/source tests | **Pass** (direct TS-transpilation harness) |
| Strict pure TypeScript typecheck of new outcome-share logic/test | **Pass** |
| Phase 13 dependency-free JSX render smoke | **Pass**, verifies 3 periods, 4 today metrics, 3 period outcomes, 2 accessible charts and a stable task deep link |
| Six prior V2 regression suites (Phase 6/7/8/10/11/12) | **Pass** independently |
| Version consistency | **Pass** (`1.2.1-r4`) |
| Existing V2 SVG validator | **Pass** (108 assets) |
| New CSS syntax via PostCSS and TS/TSX syntax transpilation | **Pass** |
| 18 protected file preservation audit | **Pass** |
| Full `npm test` | **Not certified**: monolithic TypeScript compilation exceeded this environment's execution timeout; no failing assertion was surfaced. The selected suites above passed independently. |
| Full React/Vite typecheck & build | **Blocked**: dependencies not installed; registry DNS returns `EAI_AGAIN`. `tsc -b` reports absent React/Phosphor/React Router type declarations and derivative JSX errors. |
| Real browser rendering / mobile profiling | **Not verified**: headless Chromium could not produce a screenshot in this sandbox. |

The test harness at `tools/phase13-render-smoke.cjs` mocks the JSX host and should **not** be confused with React DOM or a browser interaction test.

## 4. Browser/device acceptance checklist before release

1. Verify the 7/30/90 day controls change values and trends exactly as the old Analysis period selector.
2. Compare today/period totals, Regular/Deep trend points and expanded event details against the same pre-V2 household backup.
3. Verify Analytics history shows large event volumes smoothly, long EN/IT/custom strings wrap, and history links open the exact task.
4. Verify the shared Sheet keyboard sequence: initial focus, forward/reverse Tab trap, Escape, backdrop close, focus return, scroll lock and confirmation prompts.
5. Verify Settings custom themes and contrast warnings, notifications, import/export, member management, error-log deep link and local/cloud mode actions.
6. Verify sign-in/sign-up, archived-home restore/delete, setup form, small phone, reduced motion, no-art mode, high zoom and at least one real installed-PWA session.

**Gate statement:** Phase 13 code and available source-level tests are complete. End-to-end runtime acceptance is still pending the dependency/browser environment. Phase 14 is not started.
