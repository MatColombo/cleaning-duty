# Phase 18B handoff — future visual-override persistence contract (NOT IMPLEMENTED)

## Boundary
Phase 18A is a transient, local preview. Closing the sheet discards the selection. Its draft overrides are not in `WorkspaceData`, local snapshots, the Sync Coordinator, the backup format, Supabase rows, or any RPC. This document is a proposal for a future phase, not authorization to migrate or deploy.

## Proposed resource
An **additive** `visual_overrides` table, or equivalent V2-only resource, keyed by `(household_id, subject_type, subject_id)`, where `subject_type ∈ {routine, action, entity}`. Columns proposed: `generator_version`, `override_schema_version`, bounded `overrides_json`, `revision`, `updated_at`, `updated_by`; a stable unique constraint on scope+subject; optional tombstone/reset semantics. Do not change existing V1 tables or RPC signatures.

## Validation
- The Phase 18A schema (`V2_PHASE18A_DRAFT_SCHEMA.json`) is the starting whitelist, not a carte-blanche persistence schema. At 18B re-audit compatibility against the then-current generator and bound the serialized UTF-8 JSON size (proposed limit **2 KiB**; reject oversized payloads).
- Use server-side validation, not only this client sanitizer: checked subject type, membership/ownership, correct household scope, valid referenced subject, primitive registry/version, and enumerated fields; reject `svg`, XML/HTML, script, CSS, URLs, media, arbitrary paths, and uncontrolled numbers.
- Future generator/asset changes must fail safely to deterministic Auto without losing the stored JSON needed for user recovery. A generator-version mismatch must not silently apply an incompatible recipe.

## Concurrency & Sync Coordinator
- Add a V2-only compare-and-set write/read operation, `expected_revision`, and conflict return (rather than last-write-wins). It can be versioned RPC or an explicitly protected table action. Reuse Phase 16A durable outbox and exact per-user/household scoping for commits.
- **Commit only on explicit user confirmation** at Phase 18B; never write on each picker/slider/pointer movement. The 18A buttons `Reset to Auto` and `Close preview` do **not** commit anything.
- Read only on normal household load/refresh, never Realtime, polling, external image generation or Supabase Storage. V1 cannot see the new table and must not be disrupted.
- On logout, household switch, restore/import, and revoked membership, cancel/partition queue data exactly as the Phase 16A coordinator requires. Conflicts must keep both a safe local draft and server revision available for explicit resolution.

## RLS & mixed clients
Define membership-based `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies with subject-ownership checks and proper household isolation. Produce positive/negative RLS tests for two members and cross-household denial. Legacy V1 clients should remain functional because no existing RPC or table meaning changes; V1 restore/reset may leave orphaned V2 overrides, so design an explicit cleanup/quarantine strategy and test it before activation.

## Backups
Extend V2 backup format only after verifying old schema-v9 import compatibility, cross-user scope, overwrite/restore handling, stale subject IDs and rollback. Phase 18A imports and exports remain entirely unchanged.

## Release gate
For 18B, deliver forward/rollback SQL as **unapplied files**, migrations/RLS test scripts, two-client concurrency tests, V1 coexistence checks, traffic measurements and production rollout instructions. No SQL execution or deployment without explicit approval.
