# House Care v1.2.0 — final traceability

Basis: `v1.2.0_FLOW_AND_FINISH_SPEC.md`.

## Phase 1 — canonical truth

Implemented the theoretical `scheduled_slot_at` / mutable `effective_due_at` split, completion snapshots, Cleanliness Engine v2, Refresh-to semantics, room/home equal-per-item aggregation, deterministic migration and occurrence-independence/regression tests.

## Phase 2 — daily operational flow

Implemented Overview replacing Today, a normalized/deduplicated occurrence query, critical Regular Cleanliness, Overdue/Due now/Later today/Finished groups, exact-action Undo, seven-day Upcoming, Routine lifecycle controls and Advanced Refresh-to editing.

## Phase 3 — spatial operational flow

Implemented Home aggregate cleanliness above the layout, fit/center framing, selected/dotted-due/dashed-overdue room state, contextual room details, room Upcoming and Start-room sequential cleaning backed by the same occurrence mutation service and Undo state as Overview.

## Phase 4 — explain and finish

Implemented Analysis summary/trends/outcomes/history, five theme presets plus custom semantic palette editing and contrast checks, Manrope, Phosphor, illustration registry, semantic surfaces/radii, differentiated motion, reduced-motion behavior and accessibility improvements including keyboard-accessible spatial elements and modal focus management.

## v1.2.0 definition-of-done mapping

### Cleanliness Engine v2

- Formula acceptance tests pass.
- Regular/Deep trajectories remain separately calculated.
- Occurrence reschedule/duplication does not change cleanliness.
- Refresh-to no-op behavior is regression-tested.
- Aggregate cleanliness is item-based rather than occurrence-frequency weighted.

### Overview

- Overview is primary; `/today` redirects.
- Critical count/threshold are configurable.
- Occurrence groups are mutually exclusive and deduplicated.
- Activity name is the primary card title.
- Finished is collapsed by default.
- Undo reverses the exact mutation.
- Upcoming is included at the bottom.

### Home

- Regular/Deep bars are above the layout.
- Initial view fits and centers.
- Selection coexists with dotted due-today/dashed overdue status.
- No future-only/healthy room decoration is added.
- Room details expose upcoming work.
- Start room uses the canonical occurrence mutation path.

### Analysis

- Today completion summary lives in Analysis.
- Cleanliness trends use v1.2 recurrence/completion reconstruction.
- Outcome counts are non-gamified.
- Human-readable history is at the bottom with expandable audit context.

### Brand / appearance

- Fresh Sage is default.
- Five built-in swatches are selectable.
- Custom semantic palette is editable with contrast guardrails.
- Main Flow & Finish surfaces consume semantic colour tokens.
- Manrope hierarchy is active.
- Surface/radius cleanup is active.
- Phosphor is the primary navigation/action icon language.
- Illustration registry is extensible without database schema slots.
- Motion tokens and `prefers-reduced-motion` behavior are active.

## Out-of-scope boundary preserved

v1.2.0 does not add shopping lists, pantry/inventory, expenses, generic AI cleaning plans, IoT, chat/social features, gamification or a full calendar product.
