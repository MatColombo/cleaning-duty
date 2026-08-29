# House Care v1.1.0 — release notes

## Care model

- Added Routine and Deep cleaning levels to Routines, snapshotted onto generated Tasks.
- Existing Routines and Tasks upgrade as Routine cleaning.
- Routine care tracks short-term upkeep. Deep care is shown only when an active Deep Routine targets the selected place/item/subtree.
- Deep completion refreshes both Deep and Routine physical-care estimates without rewriting historical Routine task state.
- Effective condition is derived from Routine care and Deep deterioration; the formula remains an implementation detail rather than a user configuration.
- Home cockpit and floor-plan Care overlay show separate Routine and Deep health bars.

## Layout presentation

- Scenes automatically center and fit their placed content on open; the 100% control refits content.
- Added per-placement fill color with automatically darker contour.
- Added per-placement text color and optional text background.
- Added label positions top / center / bottom.
- Added label orientations horizontal / diagonal / vertical.
- Added per-scene background color. Existing label size, width and wrapping controls remain available.

## Upgrade

Run `supabase/migrations/20260829190000_v1_1_dual_care_layout_style.sql` once on an existing v1.0.3 database, then deploy the new frontend. Backup schema is v7; application version is 1.1.0. Push configuration is unchanged.
