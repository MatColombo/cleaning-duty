# House Care V2 - Phase 16C implementation and regression report

**Date:** 2026-10-12  
**Starting point:** user-supplied `HOUSE_CARE_V2_PHASE16B_UPDATED.zip` (including the Phase 16A coordinator and Phase 16B integrated Extra Care).  
**Scope:** Phase 16C only. No styling redesign, no Phase 16D or later features.  
**Delivery:** complete updated repository ZIP with source, tests, migrations, example rollback/RLS checks, and this report.  
**Release status:** **SOURCE/DOMAIN PASS; LIVE-CLOUD AND BUILD BLOCKED**. No SQL was run, no staging or production was changed, and no release deployment was made.

## 1. Repository audit and protected invariants

The actual source uses `src/lib/scheduler.ts` for calendar materialization, `src/lib/mutations.ts` for optimistic task transitions, `src/contexts/DataContext.tsx` to stage and enqueue actions, `src/lib/syncCoordinator.ts` for durable ordered delivery, and `src/lib/cloudRepository.ts` for canonical Supabase RPCs. Core task history and assignment remain independent of graphical task cards. Phase 16B provides the integrated parent-plus-Extra Care RPC and legacy child transition ledger.

Protected through this phase:
- V1 task tables and existing RPC **signatures/meanings are unchanged**. Additive 16C migration only; V1/non-opt-in households retain their current backend behavior.
- A task event retains its original client action timestamp across offline retries. Canonical task version and event ID remain the concurrency and idempotency keys.
- Fixed Calendar uses the original recurrence anchor, date exceptions, ordinal, routine revision, task identity, assignment, reminders and target snapshot fields.
- Original completed/skipped/cancelled rows, immutable completion snapshots, V1 linked-child history, old backups, Extra Care semantics, and EN/IT navigation are not deleted by calendar replenishment.
- No periodic refresh, Realtime, cron, long-running server worker, image upload or Storage bucket is introduced.

## 2. Implemented recurrence changes

### A. After Completion

- `materializeAfterTerminalEvent` creates one successor **inside the optimistic completion/skip action**, rather than pre-issuing later tasks. The successor is linked via `successorOfEventId`, has deterministic identity, and is accompanied by stable `TASK_CREATED`/`ASSIGNED` audit IDs.
- For successful completion the new schedule derives from `mutation.eventAt`, **not** original due and **not** server ACK time. The canonical five-day example is Sep 1 due, Sep 3 complete, **Sep 8 next due**. For a Skip, the successor uses the immutable skipped slot as the cadence base and does not count as cleaning.
- Hours use elapsed duration; daily/weekly schedules advance the completion's *local calendar time* in `routineTimezone` (falling back to workspace timezone). Monthly intervals clamp invalid month-end days and use `timeOfDay`. The timezone utility handles nonexistent/repeated local times deterministically.
- On Undo/Restore, the client cancels only a verifiably pristine successor from the source event; an edited or historically active successor blocks the operation with a conflict instead of disappearing. Completed history remains. For pre-16C local backups, narrowly checked legacy successors may be cancelled only if slot, creation date and unchanged version match the source; otherwise conflict.
- Integrated Extra Care remains owned by the primary execution. Phase 16B due/completed/postponed events and cleanliness effects are preserved; Skip carries the obligation. The new cloud path places primary/Extra Care terminal state plus the 16C successor in one versioned RPC transaction.
- Cloud households explicitly require opt-in `recurrenceMode='atomic'`. Missing migration/capability is a failure visible to the coordinator; no legacy cloud fallback and no speculative queued cloud successor. The durable outbox retains the original event timestamp and successor snapshot across reload, offline and retry.

### B. Fixed Calendar

- Removed the *effective behavior* of the 45-day future horizon. `materializeTasks` retains its compatibility parameter but `replenishFixedCalendar` uses `FIXED_BUFFER_TARGET=5`, `FIXED_BUFFER_LOW_WATER=2` and a `MAX_BUFFER_SCAN=192` bound.
- When at most two **future scheduled** entries remain, seek anchored recurrence candidates and replenish to five. Overdue uncompleted records are preserved but not counted as future. Ignore completed, skipped, cancelled and historical prior-revision slots for future count.
- Candidate seek avoids scanning every calendar day from a distant anchor: fixed hourly, daily, weekly, monthly, Nth-weekday and interval-weekday rules have bounded seek paths. Explicit included datetimes merge chronologically, excluded rule dates stay excluded, identical due instants deduplicate.
- Task IDs and `triggerOrdinal` are stable; repeat startup or two client-side materializations compute the same occurrence IDs. When a cloud config batch contains only generated task/target/audit rows, it uses `v2_commit_generated_occurrences` rather than replacing the entire household.
- Routine preview now reports a five-item *count-based* future sample, including 18-month rules. Previously the bounded date range could show none. Non-recurring once rules still remain bounded.
- Regeneration is triggered by existing app activation, completion and configuration workflows, **not** a background scheduled job. If the PWA is never opened, the buffer is not replenished; notification jobs may not exist beyond already issued tasks.

### Relevant source paths

| Area | Files |
| --- | --- |
| Calendar arithmetic, materialization, preview | `src/lib/scheduler.ts`, `src/lib/date.ts` |
| Undo, Restore, event provenance | `src/lib/mutations.ts`, `src/types/domain.ts` |
| Offline action payload and targeted diff | `src/lib/offline.ts`, `src/lib/configChanges.ts` |
| Household lifecycle/queue and cloud RPC dispatch | `src/contexts/DataContext.tsx`, `src/lib/cloudRepository.ts` |
| Pure recurrence scenarios | `tests/v2_phase16c_recurrence.test.ts` |
| Simulated offline/retry/two-client scenarios | `tests/v2_phase16c_sync.test.ts` |
| Static SQL contract (not server validation) | `tests/v2_phase16c_sql_contract.test.cjs`, `tests/v2_phase16c_restore_guard.test.cjs` |
| Unapplied forward/rollback/staging SQL | `supabase/migrations/20261012160000_v2_phase16c_recurrence.sql`, `supabase/migrations/20261012160001_v2_phase16c_rollback.sql.example`, `supabase/tests/v2_phase16c_rls_staging.psql`, `supabase/tests/v2_phase16c_activate_household.psql.example` |

See `docs/V2_PHASE16C_RECURRENCE_DECISIONS.md` for the full semantic transition table and `docs/qa/V2_PHASE16C_BROWSER_ACCEPTANCE.md` for manually gated tests.

## 3. Additive SQL and V1 coexistence notes (UNAPPLIED)

### New schema and RPCs

- `public.v2_recurrence_households`: workspace capability opt-in with membership SELECT RLS and owner-only activation `v2_activate_recurrence_household`.
- `task_occurrences.successor_of_event_id` (nullable UUID): identifies the terminal source event. Partial unique index prevents two successors tied to one event; future cursor index supports bounded reads.
- `v2_commit_generated_occurrences(workspace_id,mutation_id,changes)`: membership-checked, capped, targeted task/target/audit insertion, advisory routine lock, deterministic identity checks and no terminal-row overwrite. Pure generated batches only.
- `v2_apply_after_completion(payload)`: version- and event-ID-checked task lifecycle; compares expected successor due time and routine revision, enforces no other pending successor, executes the existing 16B integrated task logic when enabled, and inserts successor plus audit in the **same transaction**. Stale two-client writes return conflict.
- `v2_guard_recurrence_legacy_task`: on opt-in households, rejects V1 update/delete on After Completion task rows unless a narrowly defined routine-revision retirement/resume condition holds. Outside opt-in households, V1 semantics are preserved.
- The forward SQL is not in the deployed database; it is a reviewed artifact only. The static SQL contract test checks for critical source patterns but is **not** a PostgreSQL schema parse or RLS test.

### Safe operator flow, once separately approved

1. Back up the test household and provision an **isolated staging clone**, never share production credentials for tests.
2. Verify 16A and 16B additive SQL/ledger are installed, and the V1 client still works for a separate non-enrolled household. Apply 16C SQL to staging only after an explicit migration approval.
3. Drain every relevant 16A durable outbox, prohibit old V1 clients from editing the household, and require all household members to upgrade to the 16C-capable V2 client.
4. Activate only the selected staging household as owner using `v2_activate_recurrence_household`. The example activation script is transaction-rolled-back by default.
5. Execute the staging RLS smoke script, then full two-client task/Undo/Extra Care/notification tests and retry failure injection, preserving logs.
6. Do not promote until dependency-backed TypeScript build, browser/PWA, actual Supabase cloud E2E, and rollback checks pass. Rollback example refuses to silently delete an enrolled capability or event provenance.

**V1 collision limitation:** the V1 client is unchanged, and legacy V1 callers can still issue task INSERTs or mutate related routine/configuration rows in an enrolled household; guarding task UPDATE/DELETE alone is not a proof of universal mixed-client safety. Activated 16C households are therefore **V2-only editing zones**. This is an explicit operational incompatibility, not a claim that V1/V2 edits safely interoperate. V1 continues unmodified on non-enrolled households. Likewise, cloud backup reset for a 16B/16C ledger remains blocked until a transactional versioned restore exists; local old-backup import remains supported.

## 4. Reproducible tests and results

Commands run from repository root with installed global TypeScript available for isolated pure tests:

| Gate | Observed result | Limits |
| --- | --- | --- |
| `NODE_PATH=$(npm root -g) npm test` | **PASS**: all available Phase 0/V1/V2 regression suites, including 16A, 16B, pure 16C and simulated Sync Coordinator 16C | No browser, backend or native PWA is exercised |
| `node tests/v2_phase16c_sql_contract.test.cjs` | **PASS**: source-text guard for atomic completion, Undo reconciliation and uniqueness | Not SQL syntax, RLS or PostgreSQL execution |
| `node tests/v2_phase16c_restore_guard.test.cjs` | **PASS**: source-text guard that destination cloud ledgers are queried *before* destructive reset | Not a live cloud restore test |
| `NODE_PATH=$(npm root -g) npm run qa:static` | **PASS**: 30 source/release checks; 109 SVGs validated | A source/asset audit, not runtime E2E |
| `NODE_PATH=$(npm root -g) npm run qa:syntax` | **PASS**: 141 TS/TSX files parsed | **Not** dependency-backed typecheck |
| `NODE_PATH=$(npm root -g) npm run typecheck` | **BLOCKED**: missing `react`, router, Vite and other npm modules/type dependencies | Reported errors after imports cannot be interpreted as a verified typed build |
| `NODE_PATH=$(npm root -g) npm run build` | **BLOCKED**: TypeScript project cannot resolve those dependencies; Vite bundling never reached | No verified production bundle |
| Apply migration / staging RLS / live Supabase two-device flow | **NOT RUN** | Requires permission and isolated database; SQL intentionally unapplied |
| Browser/PWA, notifications delivered, push/deep links, cold offline behavior | **NOT RUN** | Checklist supplied, no screenshots or device proof |

Tests explicitly exercise: completion Sep1->Sep3->Sep8; final target completion issuing one provenance-linked successor; early/late anchoring; monthly Jan31 and Feb29; Europe/Rome DST gap/fold; Undo refusing edited successor; 18-month rolling five-slot output; <=2 refill; fixed exceptions and calendar ordinals; 16B Extra Care #4 Skip -> #5 due; stable task IDs and backup parsing; offline restart, ACK-loss replay, and two-client stale version conflict (in-memory server only).

Captured logs are inside `docs/qa/phase16c-evidence/`. On a dependency-complete machine run:

```bash
npm install
npm test
node tests/v2_phase16c_sql_contract.test.cjs
node tests/v2_phase16c_restore_guard.test.cjs
npm run qa:static
npm run qa:syntax
npm run typecheck
npm run build
```

The ZIP intentionally does not fabricate a lockfile or dependency installation. Verify an actual reproducible lockfile and `npm ci` in the deployment pipeline.

## 5. Remaining defects/validation risks and exit status

- **P0 BLOCKED for cloud sign-off:** no live Postgres migration/RPC/RLS execution, no transactional completion+successor fault injection, no real two-client device tests; the SQL API contract may need staging corrections before it can be activated. Do not claim cloud E2E.
- **P0 BLOCKED for build:** npm dependencies unavailable. Pure domain transpilation is not a complete typecheck; no worker preview or build artifact confirmed.
- **Undo audit identity:** older V1/16B Undo RPCs may emit server-generated IDs for `CANCELLED` records while the local optimistic projection uses deterministic IDs. Task states and idempotency are guarded, but exact audit-record identity/reconciliation must be checked in staging. No full cloud result is claimed.
- **V1 editing boundary:** legacy V1 inserts/configuration writes can still collide in the same activated workspace. Enforce V2-only access after opt-in; don't invite simultaneous V1/V2 editing.
- **App-side notifications:** the rolling count buffer cannot create jobs if nobody reopens the application. Browser deep-link and notification delivery/cancellation need real-device verification.
- **No data deletion:** old completed events and backups are retained. For active 16B/16C cloud ledgers, destructive cloud import/reset is explicitly blocked even when the uploaded backup predates the ledger: the destination capabilities are read before resetting. The query/reset interleaving still needs isolated staging validation.

**Phase decision:** implementation delivered; automated pure-domain/regression checks **PASS**; release certification **BLOCKED**, and no deployment is authorized or performed. Stop after Phase 16C.
