# House Care PWA — v1.2.0

Configurable household-care PWA for a shared home. v1.2.0 implements the supplied `v1.2.0_FLOW_AND_FINISH_SPEC.md`: deterministic cadence-based Cleanliness, an operational Overview, a spatial Home workflow, explanatory Analysis, and the complete Flow & Finish visual system.

Release notes: `docs/RELEASE_NOTES_v1.2.0.md`  
Update from the Phase 3 build: `docs/UPDATE_v1.2.0.md`  
Release traceability: `docs/V1_2_0_TRACEABILITY.md`
State-consistency corrective update: `docs/UPDATE_v1.2.0_STATE_CONSISTENCY.md`  
r4 assignment + Home panning update: `docs/UPDATE_v1.2.0_R4_ASSIGNMENT_PAN.md`

## v1.2.0 release shape

- **Cleanliness Engine v2** — Regular and Deep cleanliness are derived from recurrence cadence and effective refresh completions, not occurrence counts.
- **Overview** — critical cleanliness, overdue/today work, collapsed Finished, exact-action Undo and 7-day Upcoming.
- **Home** — aggregate cleanliness above the layout, fit/center framing, dotted due-today and dashed overdue room states, room details and Start room.
- **Analysis** — today outcome summary, 7/30/90-day Regular/Deep cleanliness trends, activity outcomes and an expandable human-readable history timeline.
- **Appearance** — Fresh Sage plus Warm Clay, Coastal Blue, Lavender Smoke and Charcoal Citrus presets; editable custom semantic palette with contrast guardrails.
- **Flow & Finish** — Manrope typography, Phosphor icon language, semantic surfaces/radii, extensible SVG illustration registry, action-specific motion and reduced-motion behavior.
- **Accessibility** — visible focus states, keyboard-focusable spatial layout controls, accessible modal sheets, practical mobile targets and non-colour-only room status.

## No administrator rights / no Node.js

Use the browser-only deployment route in `docs/DEPLOYMENT_NO_ADMIN.md`. Cloudflare builds the Vite app remotely, while Supabase setup is performed through its dashboard.

## Local use — no account required

Requires Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Keep `VITE_APP_MODE=local`. Local data stays in that browser.

## Online deployment

Use the complete step-by-step guide:

**`docs/DEPLOYMENT.md`**

The production stack is Supabase + Cloudflare Workers Static Assets + Web Push.

## Database migrations

The package contains the v1.2 timestamped migrations under `supabase/migrations/` so a fresh project can use:

```bash
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

If the v1.2 Phase 1 and Phase 2 database updates are already installed, the final Phase 3/4 code requires **no additional SQL migration**.

## Build

```bash
npm install
npm run build
```

Cloudflare deployment:

```bash
npx wrangler login
npm run deploy
```

## Backup

**Settings → Backup → Export JSON**. v1.2.0 keeps backup schema v8 and imports schemas v2-v8. Push subscriptions, appearance/account preferences and derived notification jobs are runtime/account state and are excluded from household backup.

## Verification

The repository contains release-blocking pure TypeScript regression suites for Phases 1–4. They cover the canonical cleanliness formula and occurrence independence, Overview/Undo semantics, Home room status and Start-room convergence, Analysis reconstruction and appearance contrast presets.

In the packaging environment used for this release, dependency installation did not complete, so a local Vite production build could not be executed there. The source tree passed the full pure TypeScript regression suite, TypeScript/TSX syntax transpilation, translation parity/type checking and CSS structural checks. Cloudflare should run the normal `npm install` + build against the declared dependencies during deployment.

## Product boundary

v1.2.0 remains a home-maintenance product. Generic shopping and inventory modules beyond the existing consumable Stock workflow, plus expenses, generic chat, IoT/sensor integrations, social features and gamification remain outside this release.

## v1.2.0 corrective pass

This package includes the post-release v1.2.0 corrections requested after initial rollout: restored Actions and Stock navigation, below-layout Home details, room-grouped Home selectors, routine-card overflow fixes, notification job repair and revised reminder copy, stock visibility in Overview, Analysis completion-history fallback, and Finished-item restoration to today's work.

Cloud deployments upgrading from the earlier v1.2.0 package must run `supabase/migrations/20260831160000_v1_2_0_corrective_notifications.sql` once and redeploy the `send-push` Edge Function if that notification correction has not already been deployed. This state-consistency revision additionally requires `supabase/migrations/20260831173000_v1_2_0_state_consistency.sql` once. It adds the first-class Restore to do today transaction, clears stale completion timestamps on skipped/non-completed rows, and removes invalid live cleanliness anchors so the canonical engine can reconstruct them.

## v1.2.0 r3 restore + Overview UX correction

Cloud upgrades from the preceding state-consistency build must run `supabase/migrations/20260831193000_v1_2_0_restore_and_overview_ux.sql` once. It removes the remaining false Restore-to-today conflict for skipped/stale lifecycle rows by deriving the reversible action on the server. The app also separates Reschedule and Reassign into focused sheets, simplifies the `...` task-details sheet, clarifies multi-target completion, and merges Critical Cleanliness by item while explicitly labelling Routine, Deep, or both threshold breaches. The service-worker cache is `v1.2.0-r3`.

## v1.2.0 r4 — explicit assignment + Home panning

Assignment is now explicit at both Routine and occurrence level: **Unassigned** means no member is selected and no push reminder is scheduled; **Everyone / household** is one shared occurrence whose reminder is broadcast to every active household account through all enabled push subscriptions; a named member continues to receive that reminder only on their enabled devices. Cloud upgrades must run `supabase/migrations/20260831203000_v1_2_0_everyone_notifications.sql` before deploying this app build, then redeploy the packaged `send-push` Edge Function so broadcast recipients are validated correctly.

The Home layout can now be panned by dragging. Outside Edit mode the drag may start over empty space, a room, or an object; short taps still select/open the item. In Edit mode, dragging an element remains reserved for moving/resizing it and dragging the background pans the camera. The zoom percentage button still resets/fits the layout. The service-worker cache is `v1.2.0-r4`.


## v1.2.0-r4.1 build fix

- Fixes backup/import assignment remapping for the explicit `everyone` assignment mode.
- `everyone` has no `memberId`, so it is preserved without member remapping.
- Service-worker cache bumped to `v1.2.0-r4.1`.
- No database migration or Edge Function redeploy is required beyond r4.

## v1.2.0-r4.2 notification repair

r4.2 rebuilds current reminder jobs after the Everyone-assignment upgrade, self-heals stale device push subscriptions, and adds explicit Edge Function delivery diagnostics. Apply `supabase/migrations/20260831213000_v1_2_0_notification_repair.sql`, redeploy `supabase/functions/send-push/index.ts`, then deploy the web app. See `docs/UPDATE_v1.2.0_R4_2_NOTIFICATIONS.md`.
