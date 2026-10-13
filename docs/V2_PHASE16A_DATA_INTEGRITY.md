# House Care V2 — Phase 16A: Data Integrity and Sync Coordinator

**Date:** 2026-10-12  
**Input:** uploaded Phase 15 `v2-testing` release candidate, version `2.0.0-rc.1`  
**Scope:** Phase 16A only; no visual redesign; no production database operation or deployment  
**Decision:** **IMPLEMENTED IN SOURCE / STAGING VALIDATION REQUIRED**. Not approved for shared-cloud deployment or final V2 release.

## 1. Source audit and invariants

The Phase 15 QA baseline (`docs/V2_PHASE15_RELEASE_REGRESSION.md`) passed pure V1/V2 tests but explicitly left dependency-backed build, cloud, and installed-PWA validation blocked. The supplied ZIP still contained unused files that Phase 15 reported as removed; these were removed only after verifying they were not imported by the live UI, so the original Phase 15 static audit passes.

Before Phase 16A, `src/contexts/DataContext.tsx` used (a) asynchronous full-workspace `saveCloudData` following configuration edits and (b) a separate runtime mutation queue. `saveCloudData` performed per-table bulk upserts across a household; an earlier cloud save/read could replace an optimistic newer local snapshot. `loadCloudData` could also persist derived cleanliness information as a side effect of a read.

Protected invariants: existing V1 Supabase table meanings and V1 RPC signatures; task event identities and task/stock RPC version guards; assignment and recurrence engines; stock event reporting; Undo/Restore; Home geometry engine; notifications and PWA routing; EN/IT; pure local mode; pre-V2 backups. There is no Realtime, collaboration poller, animation sync, paid service, or new media storage.

## 2. Implemented changes

| File | Change |
|---|---|
| `src/lib/configChanges.ts` | Serialize legacy database table shapes into per-entity/per-field compare-and-set (CAS) operations; combine adjacent unsent nonsemantic edits; replay overlays into newer cloud reads; verify acknowledgements. |
| `src/lib/syncCoordinator.ts` | One sequential, persistent, scoped outbox for configuration and canonical runtime RPCs; cancellation, network backoff, explicit failure/conflict resolution, read verification, and exclusive destructive operations. |
| `src/contexts/DataContext.tsx` | Queue durable operations before optimistic UI acknowledgement. Recover outbox and projected data on login/reload/offline launch. Guard refreshes and workspace switches; coordinate restore/import and household management. |
| `src/lib/cloudRepository.ts` | V2-only targeted RPC transport with no unsafe bulk-save fallback. Canonical task/stock RPCs retained, with abort signals. Reads no longer write cleanliness rows implicitly. Whole-household writer retained *only* for explicit coordinated backup replacement. |
| `src/lib/mutations.ts` | Stable IDs for optimistic derived Undo/reopen/target completion events, preventing replay-generated duplicate local audit objects. |
| `src/lib/offline.ts`, `src/components/RuntimeBanners.tsx`, `src/lib/translations.ts` | Backward import of legacy pending task queue, EN/IT recoverable conflict actions, explicit confirmation before discarding queued edits. |
| `supabase/migrations/20261012000000_v2_phase16a_cas_patch.sql` | **Unapplied** additive receipt table and atomic V2 CAS RPC with household permission check. |
| `supabase/migrations/20261012000001_v2_phase16a_rollback.sql.example` | Manual opt-in rollback after V2 clients are disabled and outboxes are resolved. |
| `supabase/tests/v2_phase16a_rls_staging.psql` | **Unexecuted** repeatable transaction/ROLLBACK test for member vs outsider, stale CAS and RPC idempotency. |
| `tests/v2_phase16a_sync.test.ts` | Deterministic in-memory transport regression scenarios and instrumented JSON-payload traffic benchmark. |

### Persistence and identity

Outbox localStorage key: `house-care-sync-outbox-v2:<auth_user_uuid>:<workspace_uuid>` (the scope string is provided by the existing `workspaceScope`). Cache keys remain user+household-partitioned. A queue write is synchronous; storage errors abort the edit rather than permitting a non-durable optimistic UI acknowledgement. The queue survives reload, offline periods, and household switching. Logout cancels the active coordinator; the inactive scoped outbox remains recoverable only after the matching account/household becomes active again. Invalid stored outbox JSON fails closed rather than silently dropping operations.

Each entry contains a stable mutation UUID, timestamp, scope, state, attempts, and either a field-level config patch (including previous values and local overlay) or an original canonical task/supply mutation (version, event ID, event timestamp). Config patches are coalesced **only while still queued and adjacent**; an in-flight patch and its successor remain separate ordered entries. Task lifecycle and stock events are **never coalesced or dropped**. The queued `eventAt` is used during retries, not a retry/acknowledgement timestamp.

The existing Home editor draws geometry drafts only in component state and calls `onGeometryCommit` on pointer release/cancel. Configuration queue debounce is 260 ms, and consecutive unsent field edits coalesce into one targeted RPC; no mutation transport is invoked on pointer movement.

### Sync state machine

```text
USER EDIT --[durable localStorage append]--> QUEUED
QUEUED --[online + FIFO turn]-----------> SENDING
SENDING --[applied + idempotent receipt]-> ACKNOWLEDGED
SENDING --[network/timeout/429/5xx]----> RETRYING
RETRYING --[timer/online event]---------> SENDING
SENDING --[stale field/version]---------> CONFLICT
SENDING --[auth/validation/limit]-------> FAILED
RETRYING --[retry budget exhausted]----> FAILED
ACKNOWLEDGED --[new read verifies]------> REMOVED
ACKNOWLEDGED --[new read contradicts]--> CONFLICT
CONFLICT --[explicit keep-local rebase]-> QUEUED (config only)
FAILED --[explicit retry]--------------> QUEUED
CONFLICT/FAILED --[confirm use cloud]---> REMOVE THIS AND DEPENDENT SUFFIX
```

Only one transport operation runs at a time per active household coordinator. Backoff is bounded and failure-driven; there is no continuous collaboration polling. Switching household/logout stops timers and aborts network requests. A persisted `sending` state becomes `queued` after a crash/restart; the same mutation/event ID is retried to avoid duplicate operations. Newly queued work during the final verification read is picked up after the in-flight drain finishes.

Server refresh starts with a read token and never publishes into an obsolete coordinator. Every outstanding queued, sending, retrying, acknowledged-not-verified, conflict, or failed operation is projected **after** the remote snapshot, at changed-field granularity for configuration. An older response therefore cannot overwrite a pending field, including a draft committed while that read was in flight. Different household/user scope is never replayed into another household. An acknowledged operation is deleted only when a subsequent read includes its change/event ID; contradictory reads retain the overlay and surface a conflict.

### Conflict rules

- **Same field changed on another device:** CAS compares each changed field's original value with the locked server row; any mismatch aborts the atomic request and surfaces `conflict`, preserving the optimistic local result and subsequent dependent entries.
- **Different fields on one row:** Each changed field has its own precondition, so disjoint changes can both succeed.
- **Keep local:** Explicitly reload and rebase the saved config preconditions, then retry in order. Canonical task lifecycle events are **not force-written** after a task-version conflict.
- **Use cloud:** Explicit confirmation drops the conflicting/failed operation *and its dependent queued suffix*, then reloads from the server. No silent last-writer-wins resolution.
- **Network timeout after server commit:** Replay uses the same config mutation UUID (receipt) or canonical event UUID, so retries are idempotent.
- **Restore/import/archive/delete:** New edits are blocked for the complete destructive-operation window. Pending writes or unverified acknowledgements block restore until resolved. Successful import resets only the selected household's outbox.

### Backend additive migration and coexistence

The new V2 RPC `public.v2_apply_entity_changes(uuid,uuid,jsonb)` adds an idempotency receipt table `public.v2_sync_applied_ops`. The function verifies an active workspace member, checks owner-only tables, validates table and column whitelist, locks the workspace and affected rows, compares the original fields, protects append-only events and cross-household foreign keys, and applies all changes transactionally. It does **not** modify a V1 RPC signature or domain table. The receipt table has RLS enabled and no direct client access. Task lifecycle changes still use the preexisting `apply_task_mutation`, `apply_task_target_completion`, `undo_task_mutation`, `reopen_task_to_today`, and `apply_supply_status_mutation` contracts.

**Coexistence limitation:** legacy V1 configuration clients continue to use unconditional/bulk upserts without participating in the V2 CAS coordinator or lock. Such V1 writes can still overwrite newer V2 configuration fields (or rewrite mutable task rows), and V1 restore/reset can bypass V2 outbox exclusivity. Neither client-only logic nor an additive V2 RPC can guarantee safe mixed-version concurrent edits against an unchanged V1 writer. Until V1 is upgraded/retired, **do not concurrently edit the same test household's configuration or restore it from V1 and V2**. Legacy V1 task RPCs remain callable and preserve their own version checks, but collisions with old bulk writers remain a staged-risk boundary. Export a backup before testing.

Migration is **not applied**. Approved rollout sequence: clone the schema into staging; review every table privilege and CAS key; apply only the additive migration to staging; run the `supabase/tests/v2_phase16a_rls_staging.psql` script as an isolated transaction plus real V1-client smoke checks; test two authenticated accounts concurrently; approve an explicit production deployment separately. The client intentionally **does not fallback to full-household writes** if the V2 RPC is missing: config entries remain locally durable with a failed/missing-capability explanation. To roll back, first stop V2 writes and resolve/export outboxes, then use the rollback `.example`; never drop the receipt ledger while clients may retry.

Limitations still requiring staging: the SQL is unexecuted and cannot be considered RLS-validated; its cross-household reference checks, enum constraints, row-order/FK dependencies, SQL error codes and deployed RPC permissions require verification against the actual production schema clone. Per-tab localStorage outboxes are not a multi-tab transaction lock; test/avoid concurrent editors in multiple tabs of the same browser profile. Offline opening requires a previously authorized cached household; newly joined uncached households cannot be fabricated offline. Cloud load remains the existing 18-table full read for now (Phase 16D addresses read/startup traffic). Derivation/normalization reads no longer silently persist cleanliness state; reconcile using deliberate queued mutations and verify older-record repair in staging.

## 3. Reproducible tests and results

| Check | Result | Evidence |
|---|---|---|
| V1/V2 domain + Phase 16A pure tests (`npm test`) | **PASS** | `docs/qa/phase16a-npm-test.log` |
| Source/PWA asset static audit (`npm run qa:static`) | **PASS** | `docs/qa/phase16a-static.log` |
| TypeScript/TSX parser (`npm run qa:syntax`) | **PASS**; 140 source files | `docs/qa/phase16a-syntax.log` |
| Full dependency-backed typecheck (`npm run typecheck`) | **BLOCKED** — packages absent; registry DNS `EAI_AGAIN` | `docs/qa/phase16a-typecheck.log` |
| Full production Vite build (`npm run build`) | **BLOCKED** at missing dependency types | `docs/qa/phase16a-build.log` |
| Supabase staging CAS/RLS and V1 coexistence | **NOT RUN** — no approved backend access/migration | `supabase/tests/v2_phase16a_rls_staging.psql` |
| Real browser/PWA, push, offline service worker, Android/iOS | **NOT RUN** | `docs/qa/V2_BROWSER_ACCEPTANCE.md` |

`npm test` uses `tools/run-tests.cjs` to compile all `tests/*.test.ts` via the installed TypeScript and run each isolated test. The Phase 16A suite covers offline queued coalescing, rapid A→B in-flight, late B while verification is in-flight, stale cloud refresh, disjoint concurrent edits, stale same-field conflict and keep-local recovery, Complete→Undo, Complete→Stock, replay after post-commit timeout, offline restart, save rejection, exclusive restore guard, stopped/scope isolation and quota failure. These use an instrumented in-memory **simulation**, not real Supabase E2E.

The supplied Phase 15 ZIP included three obsolete TS files and a `public/illustrations` directory despite the Phase 15 cleanup report saying they were already removed. Retaining them initially broke a Phase 15 *static presence assertion*. Removing those unimported leftovers restored the Phase 15 suite; this was **not** a functional change to the V2 shell or artwork engine.

### Measured cloud-traffic proxy

`tests/v2_phase16a_sync.test.ts` records the exact **uncompressed JSON payload bytes** passed to a simulated targeted transport, compared with the existing 16 nonempty full-table upsert payloads plus one routine-target cleanup request for the provided pre-V2 fixture. This is an instrumented payload comparison, **not** measured live Supabase request/response bytes, server egress, TLS overhead or compressed wire bytes.

| Ordinary edit | Existing full-household writer | New targeted RPC | Request reduction | JSON payload reduction |
|---|---:|---:|---:|---:|
| Layout X change | 17 requests / 22,214 B | 1 request / 117 B | 94.12% | 99.47% |
| Entity name change | 17 requests / 22,214 B | 1 request / 131 B | 94.12% | 99.41% |
| Entity label change | 17 requests / 22,214 B | 1 request / 138 B | 94.12% | 99.38% |

Raw, reproducible trial data: `docs/qa/phase16a-traffic-benchmark.json`. No live cloud traffic reduction is claimed until staging DevTools/Supabase usage measurements are recorded with a representative household and equal before/after actions.

## 4. Staging and browser exit checklist (open)

1. Install dependencies from registry on a connected machine; commit a generated lockfile, run `npm ci`, `npm run qa:release`, resolve any genuine type/build diagnostics.
2. Review and run unapplied SQL in a **separate staging clone only**, execute RLS tests with owner/member/outsider accounts, verify two simultaneous editors, last-writer conflict recovery, same-field stale revision, field disjointness, FK order, and mutation duplicate after timeout.
3. Compare actual POST count, request-body bytes **and total transmitted bytes including reads/responses** for 10 representative edits, 10 geometry releases, task Complete→Stock, and a 10-minute session. Report baseline vs new on the same test household and both user accounts.
4. Perform real browser hard refresh during queued, sending and retrying states; offline browser restart; old-worker PWA update; logout/new account; workspace A→B while A in flight; copy-to-two-tabs scenario (document current limitation).
5. Validate Complete→Undo, Complete→Stock, recurring materialization, reassignment, Everyone/Unassigned, notifications/push/deep links, stock reporting, Timeline Restore, joined Extra Care legacy child events, and old backups in both EN/IT.
6. Validate destructive import with pending and unverified writes; deliberate permission rejection and manual retry; full member-role RLS and V1 client still able to log in and perform existing RPC operations. **No V1 configuration edits during V2 test household usage.**
7. Confirm storage quota/error banner, no stale refresh overwrites, no duplicate effects, and no leaked cached household data before authentication; compare real cloud reload to local projection.

**Final status: Phase 16A source/test artifact prepared, cloud deployment intentionally withheld. Stop here; do not start 16B.**
