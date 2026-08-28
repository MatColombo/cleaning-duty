# House Care v1.0 — release notes

**Release date:** 2026-08-28

## v1 complete

House Care v1.0 closes Phases 0–6 of the initial product plan: configurable home/action/routine/task modeling, recurring scheduling and exceptions, simple and advanced assignment, qualitative supplies, visual home cockpit/editor, PWA/Web Push/offline handling, explainability/partial targets, JSON backup/restore, and v1 Insights/audit hardening.

Phase 6 adds:

- searchable task + supply audit explorer;
- completion/on-time/workload summaries and lightweight trends;
- cautious qualitative supply outlook based only on observed stock history;
- Relaxed / Balanced / Strict care-display sensitivity;
- optional localized starter household content with **no routines or notifications**;
- focus/reduced-motion/error-boundary accessibility and resilience improvements;
- backup schema v6 and app version 1.0.0;
- timestamped Supabase migrations and production deployment documentation.

## Intentionally deferred after v1

- CAD/3D home modeling;
- photos/video and large attachments;
- sensor/home-automation integrations;
- purchasing/retailer integrations;
- AI-generated schedules or opaque automatic decisions;
- automated off-site backups;
- complex enterprise roles and large analytics dashboards.

## Verification

The release core TypeScript modules, service-worker syntax, starter-pack behavior, v1 analytics behavior, and backup v6 round-trip pass the included release checks performed during packaging.

A complete dependency-backed Vite production build could not be executed in the packaging environment because npm package installation timed out. Before online deployment, run `npm install` and `npm run build` locally and do not deploy unless the build completes successfully.
