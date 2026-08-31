# v1.2.0 Phase 3 traceability

Basis: `v1.2.0_FLOW_AND_FINISH_SPEC.md` plus the agreed phased implementation breakdown.

## Implemented in this phase

- §7.1 — Home Regular/Deep Cleanliness bars above the layout, using canonical aggregate cleanliness.
- §7.2 — initial layout fit/center with safe framing, gentle animation and reduced-motion immediate framing.
- §7.3 — room visual states restricted to selected / due today / overdue; dotted due, dashed overdue, combined state supported.
- §8 — contextual room details retaining the spatial layout, with cleanliness, overdue, due-today and next-7-days upcoming work.
- §9 — **Start room** sequential mode using overdue + today work only, ordered from oldest overdue through today's schedule.
- §9.4/9.5 — Done/Skip use the same occurrence mutations as Overview; exact-action Undo remains; exiting room mode does not roll back committed actions.
- §32/§37 protection — room data is projected from the same canonical deduplicated occurrence records, with no second room-task store.
- §34 — room detail behaves as a bottom sheet on narrow viewports and a side/context panel on wider layouts.

## Deliberate implementation detail

`Later` is a non-persistent queue-navigation action: it moves the current item to the end of the active room session without changing `scheduled_slot_at`, `effective_due_at`, recurrence, or cleanliness. A real schedule change continues to use the canonical Reschedule occurrence operation outside this session action.

## Deferred by the agreed implementation plan

- Analysis redesign, full themes/custom palette, typography/icon/illustration pass, comprehensive motion/accessibility/performance QA → Phase 4.
