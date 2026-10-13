# Phase 16C - browser / PWA and Supabase acceptance checklist

All unchecked items below remain **NOT RUN** in this environment. Keep staging data isolated and never run migration SQL on shared production without explicit approval.

## Local browser and installed PWA

- [ ] Fresh local-only household: create a five-day After Completion routine due Sep 1, complete Sep 3, assert sole successor Sep 8; inspect UI after refresh/reload.
- [ ] Complete early and late; confirm source event timestamp, due slot, version, history and Routine/Timeline/Analysis projections.
- [ ] Day/week/month/hour rules in Europe/Rome and UTC; spring-forward and autumn-fold behavior; Jan 31, Feb 28/29, local clock semantics.
- [ ] Complete -> Undo and Timeline Restore: successor canceled only when pristine, predecessor restored, cleanliness trajectory restored, retained immutable history.
- [ ] Edit or postpone successor, then Undo predecessor: visible recoverable conflict, no silent loss or deletion.
- [ ] Complete a primary due with 16B Extra Care, inspect deep-clean effects, implicit completion, Skip carry-forward and Undo. No standalone Extra Care task or notification.
- [ ] Create a fixed-calendar 18-month recurrence; see five future occurrences; complete three, open again, verify refill and no duplicate IDs.
- [ ] Verify fixed weekday, monthly Nth, exception exclusions/inclusions, original anchor, routine revision, pause/resume/archive.
- [ ] Notifications: verify scheduling and cancellation of jobs for new, completed, skipped, canceled and restored occurrences; inspect deep links `/task/:taskId` and Timeline day browsing.
- [ ] EN/IT views, reduced motion, keyboard/touch, installed PWA offline startup, service worker update, auth logout and switch households.
- [ ] Explicitly check no closed-app replenishment: if nobody opens the PWA, notifications cannot extend beyond pre-materialized slots.

## Opt-in Supabase staging (only after approved isolated migration)

- [ ] Apply 16A then 16B then 16C additive SQL on disposable staging DB; inspect schema and RPC signatures. Confirm V1 table meanings and existing RPCs unchanged.
- [ ] Owner can activate; member can read capability; outsider cannot activate, read or invoke 16C RPC; check all RLS policies.
- [ ] Complete Sep1 task Sep3 and verify one successor Sep8 from server; completion, successor, target and audit insert in the same DB transaction; verify timeline projection.
- [ ] Failure injection mid-RPC leaves no terminal state or partial successor/notification/cleanliness rows.
- [ ] Two devices same source/version: first succeeds, second gets conflict; retry with same event ID does not double-create task, snapshot, Extra Care or notification.
- [ ] Offline mutation with original Sep3 timestamp submitted days later: next due stays Sep8; reload and duplicate ACK tests.
- [ ] Complete + Undo; Complete + Stock update; late and reordered responses after 16A coordinator hydration.
- [ ] Enrolled-household V1 task RPC is rejected; verify V1 continues normally against a separate non-enrolled household. Prohibit V1 use of enrolled households, including direct inserts/legacy full writes.
- [ ] Batch creation and replay of five future slots on two devices gives zero duplicate task rows or audit events; no bulk household update.
- [ ] Restore/import: local import old backups; cloud reset blocked for activated 16B/16C ledger; no destructive partial deletion.
- [ ] Notification job counts and delivery timestamps after materialization; no extra cron, polling or Supabase Realtime.
- [ ] Migration rollback exercise on staging: guarded rollback refuses enrolled data and preserves provenance/history without operator-directed migration.

## Automated commands that can be reproduced without a browser

```sh
npm install
npm test
node tests/v2_phase16c_sql_contract.test.cjs
node tests/v2_phase16c_restore_guard.test.cjs
npm run qa:static
npm run qa:syntax
npm run typecheck
npm run build
```

`npm test` runs all phase-domain TS suites through `tools/run-tests.cjs`, including 16A/16B/16C. `node tests/v2_phase16c_sql_contract.test.cjs` checks *SQL text only*; `node tests/v2_phase16c_restore_guard.test.cjs` checks *source ordering only*, not PostgreSQL validity. Dependency-complete build and actual browser staging execution are mandatory before any release certification.
