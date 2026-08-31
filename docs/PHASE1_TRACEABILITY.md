# v1.2.0 Phase 1 traceability

Implementation basis: the user-supplied `v1.2.0_FLOW_AND_FINISH_SPEC.md`, especially Cleanliness Engine v2, data-model/service boundaries, transaction rules, and regression protections.

| Requirement | Implementation |
|---|---|
| Theoretical cadence independent from occurrences | `src/lib/scheduler.ts`: theoretical slots ignore occurrence exceptions; Tasks retain immutable `scheduledSlotAt` |
| Reschedule only execution time | `effectiveDueAt` + DB `effective_due_at`; local/cloud mutations leave scheduled slot unchanged |
| Regular/Deep canonical cleanliness | `src/lib/cleanliness.ts` health trajectories per routine/item/channel |
| Linear decay + 10% pre-due floor | `cleanlinessForTrajectory()` |
| Linear 10→0 overdue interval | `cleanlinessForTrajectory()` |
| Refresh-to 10–100 and no-op rule | `normalizeRefreshLevel()`, `buildCompletionHealthEffects()` |
| Completion audit | `CompletionSnapshot` + `completion_snapshots` |
| Multiple same-channel requirements | `itemChannelCleanliness()` uses minimum trajectory score |
| Equal-per-item aggregates | `aggregateCleanliness()` |
| Paused/ended exclusion | canonical routine `status`; active-trackable filter |
| Canonical recurrence timezone | `routineTimezone` / `routine_timezone` |
| Deterministic migration | `normalizeWorkspaceData()` + `reconcileCleanlinessState()` |
| Transactional Complete/Skip/Reschedule | Supabase RPC migration + local/offline equivalent |
| Cross-device stale health protection | monotonic `health_trajectories` update trigger |
| Previous task resurrection/duplication regressions | deterministic scheduled-slot IDs + terminal/stale-write protections retained |

`tests/v1_2_phase1.test.ts` covers the required formula/refresh/independence/timezone/month-length and migration regression scenarios.
