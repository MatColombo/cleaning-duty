# Phase 20 remaining release blockers (2026-10-13)

1. Actual dependency-backed `npm ci`, `npm run qa:release`, `typecheck`, Vite build and lockfile generation.
2. Approved staging Supabase migration application, database/RLS/atomicity and real two-member tests.
3. V1 actual client coexisting with additive V2 schema; safe policy for 16B/16C activated households.
4. Atomic/safe cloud backup restore capability or an approved, accurately communicated restriction. Current source blocks such restores.
5. Live Worker Preview (V2 name `cleaning-duty`), verified staging-only backend, actual product routes and auth redirect URLs.
6. Phase 15 RC1 -> V2 and real V1 `1.2.1-r4` -> V2 same-origin SW update and device push/deep link regression.
7. Genuine app screenshots for 22 states, EN/IT, accessibility/zoom/reduced-motion and browser/PWA gestures.
8. Actual cold/warm timing, gesture FPS/heap, network byte/request counts and Supabase Free table/egress budget.
9. Production backup and data recovery rehearsal; correct V1 Worker `house-care-pwa` versus V2 Worker `cleaning-duty` route cutover/rollback plan.
10. Explicit operator permission for production migrations, Worker deployment, household activation and any later `main` merge.

Gate remains NO-GO until mandatory validation obtains reproducible PASS evidence.
