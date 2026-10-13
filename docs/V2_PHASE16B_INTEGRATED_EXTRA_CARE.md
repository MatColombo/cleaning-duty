# Phase 16B — Integrated Extra Care (implementation and compatibility)

**Status:** implemented and verified by pure-domain/source tests. **Not production-ready:** additive SQL, live Supabase/RLS, dependency-backed build and real browser/PWA validation are **BLOCKED / not run**. This phase is not deployed and makes no change to V1 RPC signatures. Source: Phase 16A updated ZIP.

## Changes / protected invariants

- `src/lib/extraCare.ts` derives the due obligation from the stable primary `triggerOrdinal`, not a separate child task. Cadence is anchored to the original parent recurrence. A due Extra Care is part of the primary completion transaction; its distinct `COMPLETED` event, audit effect and cleanliness contribution remain identifiable. The primary event includes its linked Extra IDs and trajectory snapshots.
- `src/lib/scheduler.ts` stops creating new materialized child occurrences **only for integrated workspaces**. Existing child occurrences, old task events, snapshots, backups and routine configuration stay readable. Legacy households preserve the old behavior.
- Extra Care `POSTPONED` events record the parent whose execution was explicitly postponed. The obligation becomes eligible on the next primary occurrence, *not* the next ordinal multiple. An outstanding N-trigger and a new N-trigger are merged into one execution per extra routine/primary occurrence.
- A missed or skipped primary never completes due Extra Care. It remains pending on the next eligible primary; a primary reschedule retains its ordinal. Reassignment changes no due rule. Paused/archived or ended configurations produce no current extra, but completion/history and past postponements are retained. If resumed, an old unfulfilled trigger can become due again. Cancelling/archiving the primary does not invent a completion.
- Task Complete / Undo / Restore-to-today preserve linked cleanliness and event attribution in `src/lib/mutations.ts`. Existing Phase 16A durable FIFO outbox is used for integrated lifecycle/stock events. It never coalesces lifecycle operations.
- Card, Overview, Timeline, Home inspector/room mode, notifications/deep-link routing, task sheets and Analysis integrate Extras as an appendix. The main Complete action stays prominent; postpone, skip, reassign and reschedule are accessible from the task `...` menu. Old completed children remain visible in history. EN/IT text keys are paired.
- Backup v9 stays v9 and carries optional `extraCareMode`, `extraCareEvents`, `extraCareLegacyCarries`. Earlier versions 2–8 remain accepted and normalized. Imported IDs are not discarded; member identity is remapped.

## Semantic transition table

| Starting condition | V2 action | Parent occurrence | Extra Care | Events / cleanliness | Next due |
|---|---|---|---|---|---|
| Before cadence trigger | None | Scheduled | Not due | None | Next anchored N-trigger |
| Due at #4 | Complete primary | Completed | Implicitly completed | Parent + separate Extra `COMPLETED`; separate audit/cleanliness effects | #8 regular trigger |
| Due at #4 | Postpone extra in `...` | Still scheduled | #4 suppressed | Extra `POSTPONED`, no cleanliness refresh | #5 primary, not #8 |
| Postponed to #5 | Postpone again | Still scheduled | #5 suppressed | New Extra `POSTPONED` | #6 primary |
| Postponed to #6 | Complete primary | Completed | Implicitly completed once | One Extra completion | #8 unchanged |
| Carry meets #8 regular cadence | Complete primary | Completed | One merged obligation | Exactly one Extra event per routine; no duplicate snapshots/effects | Following regular cadence |
| Due at #4 | Skip primary | Skipped | Not completed, stays owed | Parent `SKIPPED`; **no** Extra completion/effect | Next executable primary |
| Missed #4 | No action until #5 | #4 overdue | Still owed | None | Can be handled at #4 or next eligible primary; server serializes routine operations |
| Completed parent + Extra | Undo source completion | Scheduled | Completion reversed, owed again | Parent `REOPENED`, Extra `REOPENED`; restore recorded prestate if no unrelated later health update | Current due rules |
| Postponed Extra | Undo postponement | Scheduled | Due again on original primary | Extra `REOPENED` references postponed event | Original ordinal restored |
| Due Extra | Reassign/reschedule parent | Assigned/rescheduled | Same obligation | Assignment/schedule event, no Extra execution | Retained on same primary ordinal |
| Paused/archived Extra | No operation | Unchanged | Not executable | Audit/history remains | Resume re-evaluates outstanding obligations |
| Historical V1 completed child | Read history | Unchanged | Counted as completed in due floor | Historical child, task events and snapshots remain | Next regular trigger |
| Historical V1 scheduled child | Owner activates V2 | Legacy row `CANCELLED`; original parent untouched | Outstanding carry transferred to ledger | Cancellation conversion event, no artificial completion | First valid primary ordinal not before legacy effective due |

**Execution invariants:** one primary Complete event with deterministic extra-completion IDs; version check on primary and per-routine transactional serialization; immutable completion audit and explicit reversal events. With delayed/out-of-order HTTP, Phase16A preserves mutation order and idempotency. An Undo of cleanliness is refused if another more recent trajectory refresh displaced the source. Client optimistic projection is repaired with server-returned state on normal refresh, not Realtime/polling.

## Backend rollout and safety boundary

`supabase/migrations/20261012130000_v2_phase16b_integrated_extra_care.sql` is **additive, unapplied**. It introduces:

1. `v2_extra_care_households` owner-controlled capability row; **no automatic activation**, including when SQL is installed.
2. `v2_extra_care_events` with `POSTPONED`, `COMPLETED`, `REOPENED`, source/parent event links; `v2_extra_care_legacy_carries` for open V1 children.
3. `v2_extra_care_effect_audit` and `v2_extra_care_before` for separate attribution and exact before-state Undo, including missing trajectories.
4. `v2_apply_integrated_care(...)` versioned, idempotent, atomic canonical lifecycle RPC and `v2_due_extra_care_ids` helper, with the original V1 functions unchanged.
5. `v2_activate_extra_care_household(workspace_id)` owner-only explicit migration of outstanding child tasks, including notification job cancellation, leaving historical completed rows untouched.
6. Authenticated household-member **read-only RLS** for capability/events/carries, no direct ledger mutations, RPC membership and owner checks. A `task_occurrences` guard blocks legacy V1 primary/linked-child task writes after V2 activation (a fail-closed boundary).

**Coexistence limitation:** the existing V1 client must not actively edit an activated V2 household. The migration protects task row writes, but cannot guarantee full mixed-client safety for legacy routine configuration writes and backup/reset paths. Use a separate V2-only test household. V1 is unchanged for unactivated households. Do not enable in a shared production household without a coordinated V1 client exit and staging acceptance.

**Backup limitation:** local import of old/updated v9 backups is supported. Cloud household replacement is deliberately blocked before any destructive reset if the household is activated *or the imported data carries Extra Care ledger events/carries*. The old `reset_workspace_content` is not ledger-aware. Implement and validate a versioned transactional restore before allowing such imports. The source reports this as a **BLOCKER**, not as completed cloud restore coverage.

### Reproducible migration/staging sequence (only after approval)

- Clone Supabase schema/data into an isolated staging project; never use the shared production URL. Review migration against staged table columns, existing trigger/RLS policies and V1 RPC catalog. Verify V1 operations first in an **unactivated** staging household.
- Apply `supabase/migrations/20261012130000_v2_phase16b_integrated_extra_care.sql` on staging only. Check `pg_policies`, `prosecdef`/grants for new functions, and row isolation.
- Seed distinct owner/member/outsider users and a primary with a due Extra (#4). Execute `supabase/tests/v2_phase16b_rls_staging.psql` using the required `psql -v` values. It uses an outer `BEGIN`/`ROLLBACK`. Verify owner activation, duplicate postponement, stale revision, V1 rejection and cross-household denial. Do not treat this single script as full cloud E2E.
- In a second staging scenario perform Complete, identical event replay, Complete→Undo and Complete→Stock while simulating delayed requests from two browser users. Inspect the primary task/event, `v2_extra_care_events`, snapshot/effect audit, prestate and active trajectory rows; compare normalized JSON to the client projection.
- Confirm all V1 existing RPCs still work in **unactivated** staging households; confirm they fail closed on activated linked tasks. Test V1 configuration, backup and legacy notification interactions explicitly; review mixed-client limitations.
- On *empty/no-activated* staging DB, the **manual-only** rollback example `20261012130001_v2_phase16b_rollback.sql.example` removes the additive resources. It refuses to roll back activated households to avoid destroying ledger history.

No SQL has been executed in this phase. No deploy, Supabase Realtime, polling loop, Storage or schema-contract rewrite was added.

## Regression and unresolved validation

- **PASS (automated, pure TypeScript):** #4 due/complete, #4→#5→#6 postpone, next #8 trigger and merge logic; parent/extra event+snapshot identity; Skip, Undo/prestate, duplicate completion, archived/paused/reassignment behavior; legacy completed/pending/carry history; backup versions, EN/IT parity, Analysis attribution, Overview parent-only cards; offline restart, lost ACK, FIFO Complete→Undo→Stock with no double execution.
- **PASS (source checks):** `npm test`; `npm run qa:static`; `npm run qa:syntax`. These tests compile pure-domain modules using globally available TypeScript and do not simulate Postgres production behavior.
- **BLOCKED:** `npm run typecheck`, `npm run build`, browser/PWA E2E, installation on mobile, real notification/deep-link pushes, PostgreSQL migration/RLS, actual multi-device conflict and V1/V2 cloud coexistence. NPM dependency installation failed in this environment because npm registry DNS/network access was unavailable (`EAI_AGAIN`). Typecheck consequently fails with missing React/Supabase declarations, not a meaningful application compile result.
- **BLOCKED safety functionality:** atomic cloud backup restore of activated households, deliberately rejected before data removal. Complete staging tests required before activation or release.

**Run:** `NODE_PATH=$(npm root -g) npm test`, `NODE_PATH=$(npm root -g) npm run qa:static`, `NODE_PATH=$(npm root -g) npm run qa:syntax`; once dependencies are available, `npm ci && npm run typecheck && npm run build`; staging-only SQL tests require a real cloned Postgres/Supabase and explicit approval.

See `docs/qa/V2_PHASE16B_BROWSER_ACCEPTANCE.md` and `docs/qa/phase16b-*` logs for details. **Stop after 16B.**
