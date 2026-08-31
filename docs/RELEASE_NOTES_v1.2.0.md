# House Care v1.2.0 — Flow & Finish

v1.2.0 is a refinement release centered on trustworthy cleanliness, faster daily work, a useful spatial Home interface and a distinctive but restrained home-maintenance visual identity.

## What changed

### Cleanliness is now cadence-based

Regular and Deep Cleanliness are canonical trajectories derived from routine recurrence, effective refresh completions and time. Generated task-row count, duplication, one-off rescheduling and occurrence ordering do not determine cleanliness. Refresh-to lets a routine restore cleanliness only up to a configurable minimum target and does not reset the trajectory when the current score is already higher.

### Overview is the daily cockpit

Today is replaced by Overview, with critical Regular Cleanliness, Overdue, Due now, Later today, collapsed Finished and seven-day Upcoming. A single occurrence is rendered once. Done, Skip, Reschedule and Reassign retain exact-action Undo, and `/today` redirects for compatibility.

### Home is operational

Home-level Regular/Deep Cleanliness is above the layout. The layout fits and centers automatically, rooms use dotted due-today and dashed overdue status, and selection remains distinct. Room details expose current and upcoming work. Start room clears overdue/today work sequentially through the same mutation service used by Overview.

### Analysis explains what happened

Analysis now contains today's completion summary, Regular/Deep cleanliness trends for 7/30/90 days, simple activity outcome counts and an expandable history timeline with human-readable workflow and cleanliness audit detail.

### A complete Flow & Finish visual system

Fresh Sage is the default of five semantic themes, with a custom palette editor and contrast guardrails. The UI uses Manrope, Phosphor icons on primary navigation/actions, an extensible floor-plan-inspired SVG illustration registry, restrained surfaces/radii and semantic motion. Reduced-motion, visible focus, accessible sheets and keyboard-accessible Home elements are included.

## Compatibility and deployment

- Final package version: `1.2.0`.
- PWA service-worker cache version: `v1.2.0`.
- No additional Phase 3/4 SQL migration is required after the Phase 1/2 v1.2 database updates.
- Existing push/VAPID/cron/Edge Function/Cloudflare environment configuration remains unchanged.
- Household backup schema remains v8.

## Verification

The combined Phase 1–4 pure TypeScript suite passes, covering the canonical engine, Overview/Undo, room status/Start-room semantics, Analysis reconstruction and theme preset contrast. The source tree also passes TS/TSX syntax transpilation, EN/IT translation parity/type checking and CSS structural checks.

A local Vite production build was not available in the packaging environment because npm dependency installation timed out; deployment should therefore include the normal Cloudflare dependency-install/build check.
