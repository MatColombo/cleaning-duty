# v1.2.0 Phase 4 traceability

Basis: `v1.2.0_FLOW_AND_FINISH_SPEC.md` and the agreed Phase 4 breakdown.

## Implemented

- §12.2 — Today completion summary moved to Analysis, including completed/skipped/rescheduled counts, rooms maintained and the resolved-day message.
- §12.3 — Regular/Deep cleanliness trend reconstructed with the canonical v1.2 engine for 7/30/90-day periods.
- §12.4 — completed/skipped/rescheduled operational counts without a discipline score.
- §12.5 — history timeline at the bottom with expandable activity, room, routine, actor, reschedule and Refresh-to/cleanliness audit context.
- §13–14 — Fresh Sage brand direction retained as the default and semantic state colours separated from destructive Danger.
- §15 — five built-in appearance presets.
- §16 — editable semantic custom palette, preset/default reset and contrast guardrails.
- §17 — Manrope typography hierarchy and stronger activity-name treatment.
- §18 — tighter radius/surface/border system and reduced static shadows.
- §19–22 — motion tokens, completion/skip/reschedule differentiation, sheet/page transitions and reduced-motion behavior.
- §23 — accessible contextual sheets retain the underlying page.
- §24 — Phosphor primary navigation/action icon language with consistent active/inactive weights.
- §25 — extensible illustration registry with no fixed asset-slot limit and initial floor-plan-style SVG assets.
- §28 — visible focus, practical mobile targets, keyboard-accessible spatial elements, dialog focus management and reduced-motion support.
- §35 — Analysis computes day-level trend points rather than recalculating on animation frames; cleanliness remains service-derived.
- §37 — earlier Today/Overview protections remain covered by the combined Phase 1–4 test gate.
- §38 — Analysis and Brand/appearance definition-of-done items are represented in the implementation.

## Deliberate compatibility choices

- The route remains `/insights` internally for bookmark compatibility, while the user-facing navigation label remains **Analysis**.
- Appearance is an account/browser preference, not household backup data and not arbitrary per-component colour state.
- Historical pause/resume/end participation is reconstructed from existing task lifecycle evidence where present. The current endpoint always uses the routine's canonical live status.
- No new Phase 4 database table is introduced.

## Release gate performed in this workspace

- Phase 1 canonical/Cleanliness tests: pass.
- Phase 2 Overview/Undo tests: pass.
- Phase 3 Home/room tests: pass.
- Phase 4 Analysis/theme tests: pass.
- TS/TSX syntax transpilation across `src`: pass.
- EN/IT translation parity/type check: pass.
- CSS structural brace/comment check: pass.
- Local `npm install`/Vite production build: not completed because dependency installation timed out in the execution environment; this is recorded rather than treated as a source failure.
