# Phase 19B — Home Decoration Backup and Client Compatibility Matrix

| Operation | Result and limitation |
|---|---|
| V1 client normal login / task editing / old layout edits | Existing tables/RPCs unchanged; V1 ignores 19B rows. Spatial V1 edits can make attached art temporarily invisible. |
| V1 backup export | Cannot include new decorations. Use V2 schema-11 export first if artwork matters. |
| V1 restore/reset on household with custom art | Existing scene-delete trigger tombstones rows, preserving recoverable information; V1 will **not restore** them. A V2 backup and post-reset reconciliation must be performed manually under approval. |
| V2 schema 9 backup import | Allowed locally; no scene art, default Auto; existing older task/household data restored. |
| V2 schema 10 backup import | Allowed locally; visual overrides from 18B may be present; scene decorations default Auto. |
| V2 schema 11 backup export/import | Validated scene instructions included, workspace scope rewritten on import; preserved local. |
| V2 cloud restore with source or destination active scene art | **Blocked before deletion** until an atomic cross-table V2 restore is implemented and approved. |
| V2 cloud restore with older Extra Care/recurrence/visual ledgers | Prior capability guards still apply. |
| Archive scene | Saved decoration row preserved, renderer hides scene. Resume can show art again if scene/element IDs remain. |
| Archive/move/delete anchored element | Renderer hides missing anchor; row remains for rebinding. Next edit requires a valid anchor; no automatic deletion. |
| Hard delete scene | Trigger marks decoration row orphaned; hidden from normal client query, available for authorized reconciliation. |
| Delete whole household | Workspace FK cascade deletes active and orphaned rows/receipt table; requires deliberate household deletion policy. |
| Clear local browser storage | Unsynced offline outbox and caches may be lost; app behavior follows Phase 16A persistence limits. Do not claim client cache is a cloud backup. |
| Visual generator version mismatch | Unsupported stored instructions are ignored (Auto) and should be preserved for future migration rather than silently rewritten. |

Do not interpret the table as proof of live staging or V1 historical client end-to-end testing. The compatibility boundary is based on additive schema design and pure tests; real RLS/reset behavior requires staging validation.
