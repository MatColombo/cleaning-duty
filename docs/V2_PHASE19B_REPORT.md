# Phase 19B — Persist Illustrated Home Scene Decorations

Baseline: **Phase 19A candidate `v2.0.0-rc.8`**. Cumulative 19B candidate: **`v2.0.0-rc.9`**. Includes Phase 19A and Phase 19B. **SQL is supplied but has not been executed or deployed.** Stop after 19B.

## Implemented

- Existing deterministic Home illustration defaults remain computed entirely in the client and never written.
- A new `Decorate scene` sheet in Home offers nine built-in SVG prop types (`plant`, `rug`, `lamp`, `shelf`, `starburst`, `tiles`, `sofa`, `counter`, `picture`), four curated ink roles, `behind`/`above` layers, optional layout-element anchors, position/scale/rotation, Undo and Reset Auto. Pointer/slider moves update a **local draft only**. Explicit confirmation is the only save operation.
- In cloud mode, `commitSceneDecorations` validates selected household/scene, submitted expected revision, anchors and data; enqueues one durable user/household-scoped Scene mutation through Phase 16A before optimistic presentation. No writes during drag or standard Home display. Normal cloud reads include one optional 19B table query; no polling, Realtime, Storage bucket or paid function.
- For two members sharing a household, saves use a versioned compare-and-set RPC. Stale revision is a recoverable conflict. Receipt rows prevent a duplicate mutation from applying again after a lost acknowledgement; pending edits survive offline restart; a cloud refresh cannot discard pending local edits.
- Reset Auto persists an empty `[]` list at a newer revision **only if** the scene was previously customized; a never-customized scene has no row. Older pending saves cannot resurrect a reset with an obsolete revision.
- Saved art follows compatible scene/element IDs; an archived/missing element is not drawn, its artwork remains in the bounded JSON for recovery. Deleting a scene marks its decoration row orphaned via additive trigger, not destructive cascade. Deleting the entire household clears the new rows by workspace FK cascade.
- The additive resource does not modify V1 layout/element meanings, RPC signatures, task lifecycle or existing domain engine. The V1 client ignores these optional rows. No changes to V1 auth/session logic.

## Schema and compatibility

The **unapplied** forward script `supabase/migrations/20261012213000_v2_phase19b_scene_decorations.sql` creates `public.scene_decorations` keyed by `(workspace_id, scene_id)`, generator/schema version, constrained `items_json` (max 16 items, 6,144 UTF-8 JSON bytes), incrementing revision, last mutation UUID, actor and timestamps. It adds membership-scoped SELECT policy and revokes direct DML for normal clients. `public.v2_commit_scene_decorations(...)` validates all enum/numeric/anchor bounds, serializes within household lock and provides CAS, conflict response and durable idempotency receipts (90-day retention on a subsequent save). Only curated JSON is stored, never SVG/raster/media/script/URL data.

**Coexistence boundary:** Unmodified V1 login/tasks/layout editing continue to use the same V1 schema/RPCs. V1 may move/rename/archive/delete a scene or element; art linked to missing elements is hidden and recoverable; hard scene delete tombstones existing art. Because V1 does not know the decorations resource, it cannot preserve them in V1 backups, and V1 reset may orphan saved decorations. For households with valued custom art, use a V2 schema-11 backup and review the restore/cleanup policy before legacy reset.

**Cloud restore:** The legacy nontransactional V1 reset cannot atomically restore new scene rows (nor prior V2 Extra Care/recurrence/visual ledgers). V2 blocks cloud restore before deletion if source/destination contains active scene rows, or when previously gated V2 ledgers require it. Local schema-11 import/export supports instructions. Do not bypass the preflight; a transactional V2 restore requires separate approval/work.

## Backup matrix

See `docs/V2_PHASE19B_BACKUP_COMPATIBILITY.md`. Schema **11** exports validated explicit scene instructions; v9 and v10 imports default to Auto. Legacy pre-V2 backups still import. The new table is not directly writable by older clients.

## Tests run and evidence

| Gate | Observed outcome |
|---|---|
| `npm test` full V1/V2 source regressions | **PASS** |
| Phase 19A illustration, fallback/geometry/no-art source checks | **PASS** |
| Phase 19B validator / 16-item bounds / forbidden media or script | **PASS** |
| Two-member next-refresh, stale revision conflict and explicit rebase | **PASS — simulated** |
| Offline restart, lost ack, duplicate request, rapid ordered A→B, stale read | **PASS — simulated** |
| Reset-to-Auto / deleted anchors / archived scenes | **PASS — pure** |
| Local backup v9/v10/v11 and invalid-data rejection | **PASS — pure** |
| SQL/RLS static contract audit | **PASS — static only** |
| `npm run qa:static` (30 checks), `npm run qa:syntax` | **PASS** |
| Dependency-backed TypeScript build | **BLOCKED: React/Vite dependencies absent** |
| Actual Postgres migration, RLS and two-user E2E | **NOT RUN** |
| Browser/PWA interaction/frames and device screenshots | **NOT RUN** |

Isolated Node benchmark measures generated SVG markup and locally serialized CAS RPC envelopes, not network frames, actual Free-tier storage or device paint. See evidence JSON and staging checklist. Actual quota monitoring must use PostgreSQL table/index sizing queries after explicit staging approval.

## Staging deployment / rollback prerequisites

1. Obtain explicit approval and staging Supabase project URL/credentials. Review any previously unapplied Phase 16A/16B/16C/18B dependencies and installed membership functions; do not assume the 19B table exists.
2. Backup staging data and inspect `public.is_workspace_member` ownership/RLS behavior. Apply the **forward 19B script only on approved staging**.
3. Run `supabase/staging/v2_phase19b_scene_rls.sql` inside a rollback transaction with fixture A/B members and outsider; record server status, error codes and size usage. Test two browser sessions, A save then B next refresh, conflicting edit, offline retry, lost acknowledgement.
4. Test old V1 client login, task completion, layout edit, archive and reset on expendable fixtures; confirm active scene art visibility and recoverability.
5. Validate schema-11 local export/import, schema-9/10 import Auto fallback, and the intentional cloud-reset preflight block.
6. Only after separate approval consider applying SQL to the shared project and deploying the compatible V2 client. This delivery does **not** authorize that step.
7. To roll back, first stop V2 writes and ensure outboxes are drained, export scene rows, then inspect `supabase/migrations/20261012213001_v2_phase19b_rollback.sql.example`. It deletes custom art/receipts; never run without recovery planning.

**Not a production-certified release.** No SQL, migration, deployment, cloud mutation or E2E was performed here.
