# v1.2.0 Phase 3 — spatial Home workflow

Built from the user-supplied `v1.2.0_FLOW_AND_FINISH_SPEC.md` on top of the Phase 1 canonical cleanliness foundation and Phase 2 Overview/occurrence workflow.

## Included

- Home-level Regular and Deep Cleanliness bars above the spatial layout.
- `Not tracked` handling when a cleanliness channel has no eligible active tracking.
- Animated initial auto-fit/center with safe padding; immediate final framing under reduced motion.
- Room status derived from canonical actionable occurrences only:
  - due today → dotted outline;
  - overdue → dashed outline;
  - both → combined dashed + dotted treatment;
  - selected room remains visually dominant.
- No healthy, recently-completed or future-only room status decoration.
- Room detail panel/sheet with:
  - Regular Cleanliness;
  - Deep Cleanliness;
  - overdue work;
  - due-today work;
  - next-7-days Upcoming;
  - **Start room**.
- Start-room sequential queue containing only overdue and today work, including one-off occurrences rescheduled into today through their canonical `effective_due_at`.
- Queue ordering: oldest overdue first, then today's work chronologically.
- Done/Skip call the existing occurrence mutation layer and retain exact-action Undo.
- Later reorders the current room session only; it does not change cadence, occurrence dates or cleanliness.
- Phase 3 pure regression tests for aggregation, room status, queue eligibility/order, duplicate suppression, pause exclusion, rescheduled-into-today behavior, and Skip/Undo state convergence.

## Database / deployment impact

No Phase 3 SQL migration is required. The implementation is a query/projection and Home interaction layer over the Phase 1/2 canonical state.

No changes are required to push configuration, VAPID keys, cron, Supabase Edge Function secrets or Cloudflare build variables.

## Deferred to Phase 4

Analysis redesign, full theme/custom-palette editor, Manrope/Phosphor pass, illustration registry, complete motion polish and final accessibility/performance regression remain Phase 4 work.
