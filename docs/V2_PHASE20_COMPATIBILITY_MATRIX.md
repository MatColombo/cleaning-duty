# Phase 20 V1/V2 compatibility and backup obligations

| Client/data context | Expected behavior | Phase 20 evidence needed | Current status |
|---|---|---|---|
| V1 on untouched legacy schema | V1 production works as before | Preserve the production client and snapshot | Not retested live |
| V1 on schema with additive V2 migrations, household unactivated | V1 login, routines, tasks, stock, push, backup continue | Actual V1 bundle on staging DB | BLOCKED |
| V2 on schema without staged migrations | Cloud features fail visibly, no silent bulk fallback | Browser cloud save failure | BLOCKED |
| V2 on migrated schema, not activated | Normal V1 routines coexist while V2 config CAS and artwork resources work | Two-client E2E and RPC grants | BLOCKED |
| V2 activated Extra Care/After Completion household | V2-only writes; guards reject legacy linked/atomic tasks | Owner activation, real RPCs, two devices | BLOCKED |
| V1 client on activated household | Must fail closed on protected lifecycle, but legacy config/reset can remain unsafe | Explicit test+operational exclusion plan | BLOCKED |
| Backup schema 2-8, 9, 10, 11 | Local import and validation per v11 code | Repeat pure + browser and real import | Pure PASS / browser BLOCKED |
| Cloud full restore with V2 ledgers/custom art | Preflight rejects before deletion; atomic restore not implemented | Mandatory scope decision, staging DB recovery | BLOCKED |
| Old installed worker on same origin | Update banner, activation and cache cleanup, no stale edits | Actual iOS/Android PWA update | BLOCKED |
| User in another workspace | No leak of new visual/scene rows or task state | RLS scripts against staging | BLOCKED |

The source intentionally gates the mixed-client and restore cases; these are compatibility boundaries, not an unconditional V1/V2 parity certification.
