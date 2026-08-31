# v1.2.0 Phase 4 — Analysis + Flow & Finish

Phase 4 completes the agreed v1.2.0 development plan on top of the canonical Cleanliness/occurrence foundation, Overview workflow and spatial Home workflow from Phases 1–3.

## Analysis

- Replaced the old operational/statistics-oriented Insights content with the v1.2 **Analysis** role.
- Added a Today summary for completed, skipped and rescheduled actions plus unique rooms maintained.
- Shows “Everything planned for today is handled.” only when all actionable work planned for today is terminal.
- Added 7 / 30 / 90 day Regular and Deep Cleanliness trends.
- Historical cleanliness is reconstructed with the same v1.2 trajectory formula from recurrence definitions and effective completion snapshots; it is not derived from occurrence counts.
- Historical routine participation uses recorded pause/resume/end evidence when available and current routine status at the live endpoint.
- Added simple completed / skipped / rescheduled outcome counts without discipline scores, streaks or gamification.
- Moved the human-readable History timeline to the bottom, with expandable room/routine/actor, reschedule before/after, Refresh-to snapshot and cleanliness before/after context.

## Theme and appearance

- Added the five specified semantic presets: Fresh Sage, Warm Clay, Coastal Blue, Lavender Smoke and Charcoal Citrus.
- Added Settings → Appearance custom palette editing for Canvas, Surface, Surface Soft, Ink, Ink Muted, Primary, Primary Soft, Due, Overdue and Danger.
- Added reset-to-preset and reset-to-application-default controls.
- Added WCAG-AA-oriented contrast checks for critical text/action pairs; invalid custom palettes are identified and cannot be saved.
- Cloud mode stores appearance in authenticated user metadata; local mode uses local browser preference storage. No household schema/migration is required.

## Brand, typography and components

- Manrope Variable is the primary UI typeface with a robust system fallback.
- Added semantic radius, border, shadow and motion tokens and a broad surface cleanup pass.
- Phosphor Icons now provide the primary navigation/action icon language on the main workflow surfaces.
- Activity names remain stronger than routine metadata in Overview.
- Added an extensible illustration manifest plus initial floor-plan-style SVG assets for empty/onboarding/completion/paused/offline states.

## Motion and accessibility

- Added button press, page, sheet, snackbar and cleanliness update motion tokens.
- Completion, Skip and Reschedule have differentiated state motion; Skip no longer receives the completion Mint treatment.
- `prefers-reduced-motion` disables translations/animations without removing state feedback.
- Sheet dialogs now manage initial/restored focus, Escape close and Tab trapping.
- Spatial Home elements and scene links are keyboard-focusable and respond to Enter/Space.
- Added visible focus treatment and maintained dotted/dashed room status as a non-colour-only signal.
- Primary mobile controls maintain practical ~44px touch targets.

## Release closure

- Package version is now `1.2.0`.
- Service-worker cache version is bumped to `v1.2.0`.
- No Phase 4 SQL migration or runtime-secret/configuration change is required.
