# House Care V2 - Phase 16C recurrence decision table

**Status:** implemented in the supplied working tree; source-level and simulated tests pass. Cloud migration is UNAPPLIED and cloud behavior remains unverified on a real Supabase database.

## A. After Completion lifecycle

| Situation | Due date / next task | Historical and conflict behavior |
| --- | --- | --- |
| Routine has never issued a task | Materialize one initial task from the configured recurrence anchor | No speculative chain of future tasks. Cloud requires 16C enrollment for targeted generated-task insert. |
| A task due September 1 completes September 3, cadence every five days | Next due September 8, at the completion clock time for day/week cadence | Original successful local completion `eventAt` is retained in the outbox and sent to the atomic V2 RPC. Not anchored to Sep 1 or cloud acknowledgement. |
| Completed early, cadence every N hours | Next due = successful completion instant + N * 3600 seconds | Timezone offset transitions do not change elapsed-hour arithmetic. |
| Completed, cadence every N days or weeks | Next due uses N calendar days / seven-day weeks from the local completion time in the routine's timezone | Preserves local wall-clock time across DST. |
| Completed, cadence every N months | Next due uses N local calendar months after completion, clamping invalid month-end days, at routine `timeOfDay` | E.g. Jan 31 -> Feb 28 in 2026 or Feb 29 in leap year. |
| Last advanced target completed | When the last target makes the parent terminal, generate one successor from the final target completion instant | Deterministic separate `TARGET_COMPLETED` and terminal `COMPLETED` event identities, no duplicate successor. |
| Scheduled task skipped | One successor advances from the skipped task's scheduled slot | Skip does not count as successful cleaning, nor does it complete due Extra Care. |
| Routine is paused, ended or archived | No newly scheduled successor while inactive | Earlier terminal tasks and their audit remain. Resume keeps valid retained occurrence identity; it does not create speculative completion-relative work. |
| Postpone or reassign current task | Same task ID and scheduled slot; effective due/assignment changes | Does not create a new successor. V2 enrolled cloud households use 16C task RPC. |
| Primary with due Extra Care completed | V2 16B primary plus due Extra Care complete logically together | 16C successor is written in the same cloud transaction as the 16B lifecycle RPC; no standalone Extra Care occurrence. |
| Primary with due Extra Care skipped | Extra Care remains pending for the next primary recurrence | Existing 16B carry-forward semantics. |
| Complete followed by Undo | Undo restores original task and cancels ONLY an unedited, provenance-linked scheduled successor, retaining an audit event | A modified/terminal/unknown successor causes a recoverable conflict; no deleting successor history. Legacy local rows have narrowly verified fallback. |
| Timeline Restore to today | Original task reopened, due moved to now; safe future successor canceled | Refuses to erase an edited or unknown successor. |
| Same completion retried after lost acknowledgement | Idempotency event ID and deterministic successor identity remain unchanged | Server version and unique successor-event constraint prevent duplicate effects. Tested on simulated coordinator only. |
| Two devices complete same scheduled task | First valid version wins; second receives revision conflict | No independent successor is inserted by stale client. Tested on simulated coordinator only. |
| Cloud household lacking 16C capability | After Completion cloud task editing is blocked before accepting the write | Fails closed; local-only mode remains functional. Does not silently fall back to V1 RPC. |

## B. Fixed Calendar rolling buffer

| Situation | Materialization result |
| --- | --- |
| Active routine with >2 scheduled future rows | Do not refill; no writes. |
| Active routine with 0-2 scheduled future rows | Seek calendar recurrence from anchor and bring future scheduled count up to five (bounded scan). |
| 18-month recurrence | Materialize five future occurrences even when they span years; a 45-day horizon would usually produce none. |
| Earlier overdue uncompleted occurrences | Keep as backlog but **do not count toward the future five**. |
| Completed, skipped, canceled or archived occurrence | Preserve immutable row and audit; no rewriting or regenerating identical schedule slots. |
| Calendar exceptions | Omit excluded regular dates; merge explicit inclusion timestamps in chronological order; dedupe identical due instants. |
| Routine uses weekdays or Nth weekday | Preserve anchor-relative ordinal numbering, original cycle alignment and exception behavior. |
| Routine revision changed | Do not recycle previous revision IDs; retired rows remain history. |
| Paused, ended, archived or linked Extra Care configuration | No standalone materialization while inactive, and no standalone 16B child occurrence. |
| Repeat app opening / second device materializes same slot | Deterministic task ID; targeted cloud insert is idempotent by primary key and natural schedule identity. Live cross-device check remains outstanding. |
| App never opened again | No replenishment. This may limit future scheduled notifications beyond existing materialized occurrences. No cron, polling or Realtime added. |

## C. Constraints and manual gates

- Migration sequence: Phase 16A targeted CAS, Phase 16B integrated Extra Care if used, then optional Phase 16C recurrence. **Do not apply without approval.**
- Opt-in is workspace-specific and owner-authorized. Once enrolled, require all editors to use the Phase 16C-capable V2 client. V1 clients must not edit an enrolled household: V1 task update/delete is guarded but legacy new inserts and whole-household writes can still collide.
- Tests exercise pure domain and simulated coordinator behavior; live Postgres atomicity/RLS, browser deep links, push scheduling, installed PWA and real two-device collaboration are **NOT RUN**.
