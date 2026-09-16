# House Care v1.2.1-r1 — Overview/Home visibility fix

This is a client-side corrective update for v1.2.1. It does not add a new database schema migration or change the `send-push` Edge Function.

## What changed

- Triggered additional activities are grouped visibly under their parent occurrence in Overview and Home when both are in the same view.
- Additional activities remain standalone when the parent is not in the same projection, so linked work cannot disappear after an independent reschedule/state change.
- Products required only by an additional activity are shown in an explicit **Additional products** subsection.
- Additional-activity materialization now recovers if the parent was completed/skipped before the linked child was created locally; the child remains independently actionable.
- Overview home Regular/Deep cleanliness moved out of the horizontal rail into two fixed side-by-side donut indicators with the cleanliness emoji in the center.
- The horizontal cleanliness rail now contains only critical item cards.
- Upcoming day cards use a horizontal flex rail instead of conflicting grid/min-width rules, preventing overlap on narrow screens.

## Deployment

If v1.2.1 is already installed and `20260911133000_v1_2_1_linked_activities.sql` has already been run:

1. Replace the web-app files in the Git repository with this package.
2. Commit and push.
3. Let Cloudflare rebuild/deploy.
4. No Supabase SQL is required for r1.
5. No `send-push` redeployment is required for r1.

If the original v1.2.1 migration was never applied, run `supabase/migrations/20260911133000_v1_2_1_linked_activities.sql` once before testing additional activities in Cloud mode.

## Suggested checks

1. Create a daily parent routine and an additional activity every 1 trigger for a quick test.
2. Give the additional activity a product override different from the parent.
3. Confirm Overview shows an **Additional activities** subsection and **Additional products** beneath the linked activity.
4. Select the relevant room in Home and confirm the same linked work/products are visible below the layout.
5. Open Overview on a narrow/mobile viewport and horizontally scroll Upcoming; day cards must not overlap.
6. Confirm Regular and Deep home cleanliness appear as two fixed donut indicators above the critical-cleanliness rail.
