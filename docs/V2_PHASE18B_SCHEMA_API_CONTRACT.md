# Phase 18B — Visual override persistence contract

**Status: staged, not deployed.** The prototype is `v2.0.0-rc.7`. Existing V1 RPC/table signatures and task, recurrence, stock, backup-v9 import semantics remain unchanged.

## Resource and scope

`public.visual_overrides` has a composite primary key `(workspace_id UUID, subject_type TEXT, subject_id UUID)` with subject type `routine | action | entity`, validated subject membership and archived guard. The row stores only `generator_version` (currently 2), `schema_version` (1), a canonical `overrides_json` object (<= **2,048 UTF-8 bytes**), integer `revision` starting at 1, a `last_mutation_id`, `updated_by`, and `updated_at`.

The JSON property whitelist matches the Phase 18A deterministic Studio: `subjectId`, `expression`, `eyes`, `mouth`, `brows`, `pose`, `handGesture`, `scale` (0.75–1.25 in 0.05 steps), `proportion`, `prop`, `scene`, `paletteVariant`, and `animation`. No arbitrary strings, URLs, custom markup/CSS, images, SVGs, or media. Allowed enums are enforced in both TypeScript and the staged database `v2_visual_json_valid` function. Validation failure is explicit, never silent normalization on save.

## Cloud API

- Read: during normal `loadCloudData` / household refresh, **one** `SELECT` on `visual_overrides` restricted by workspace id. In pre-migration environments, table-not-found only maps to capability unavailable; other errors propagate. No polling, Realtime, Storage or extra scheduled services.
- Write: `v2_commit_visual_override(p_workspace_id UUID, p_subject_type TEXT, p_subject_id UUID, p_expected_revision INT, p_generator_version INT, p_overrides JSONB, p_mutation_id UUID) RETURNS JSONB`.
- Success: `{applied:true, conflict:false, revision:N}`; idempotent duplicate returns `duplicate:true`. Stale revision returns `{applied:false, conflict:true, actualVersion:N, message:"..."}` and applies **nothing**. Invalid values or scope raise a typed Postgres exception.
- All cloud writes use the durable Phase 16A Sync Coordinator visual entry. A queued entry persists before UI acknowledgement; delivery is FIFO with task/config entries. Explicit Studio confirmation queues **one** write, never pointer/slider changes. A conflicting in-flight draft is preserved and exposed via existing conflict UI; using `keep_local` explicitly re-reads and rebases the expected revision. `use_cloud` explicitly drops conflicting and dependent entries.
- The Studio records its opening revision. If another refresh changes it before confirmation, the UI shows an error instead of silently updating against a newer revision.
- Reset to Auto writes `{}` as a revisioned operation; it never deletes history/receipts by accident. An `{}` row blocks inherited Action/Entity settings and renders the canonical generated artwork.

## Rendering and version fallback

Only approved recipe keys are stored. Precedence is **routine > entity > Action > Auto** for a task. An empty override, invalid row, unrecognized asset, or incompatible generator/schema version renders the stable automatic recipe; unsupported rows stay in cloud for later migration, rather than being rewritten by older clients. The preview is the existing deterministic renderer, no runtime raster/export pipeline.

## RLS and credentials

The staged table has only a membership-gated authenticated SELECT policy. Direct authenticated table writes are **revoked**, including UPDATE and DELETE. Writes are permitted only through the checked, `SECURITY DEFINER` CAS RPC after `auth.uid()` active workspace membership, subject owner/scope and JSON whitelist checks. Mutation receipts are in a private RLS-enabled table, never directly accessible to clients. SQL uses fixed table names, never interpolates user-defined table identifiers.

## Backup and restore

V2 backup schema **v10** includes the visual override list with no `updated_by` identity; v9 and earlier import into v10 with an empty list. In local mode, import preserves the artwork and re-scopes all validated rows to the destination workspace. Unsupported/suspicious override records are rejected rather than executed or guessed.

**Cloud restore gate:** Existing V1 reset + 18-table save are not one database transaction. Cloud import is therefore refused **before deletion** if the source backup or destination household has visual override rows, pending a separately reviewed atomic full-household restore RPC. Existing Phase 16B/C ledger restore restrictions also remain. This is intentional non-support of cloud v10 visual restores in 18B, not silent loss. The V1 reset/delete path remains unchanged; three additive AFTER DELETE triggers remove matching V2 artwork on V1 subject deletion, avoiding orphans when a legacy client resets household content. A legacy V1 client cannot view/edit artwork; it can remove source subjects, so mixed-client **restore** requires coordination, while ordinary V1 tasks remain compatible.

## Operational release gate

Review forward SQL and rollback in an isolated staging Supabase copy. Verify the staging RLS script with two active members and one outsider, and exercise V1 task/membership flows. Explicit approval is needed before SQL execution. Do not publish Realtime, create storage buckets, deploy Edge Functions, enable paid features, or run automated polling. Check table size using `pg_total_relation_size()` in staging after representative saves. Watch Supabase Free quotas separately from local JSON-envelope measurements.

Archived subjects retain their override rows and are included in backups until the underlying subject is physically deleted; rendering/editing of archived subjects is disabled. This prevents archiving an Action from breaking backup export.
