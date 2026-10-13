# Phase 18B — backup and mixed-client compatibility matrix

| Source / operation | Target | Result in 18B | Safety rule |
|---|---|---|---|
| Pre-V2 backup schema 2–8 | Local V2 | Supported | Normalize to v10; no override rows |
| V1/V2 schema v9 backup | Local V2 | Supported | Upgrade to v10; no override rows |
| V2 schema v10 with valid artwork | Local V2 | Supported | Validate/restore IDs, re-scope workspace, preserve revision |
| V2 schema v10 with unknown subject or malformed asset | Local V2 | Rejected | Do not guess subjects; no import side effects |
| V2 schema v10 with unsupported generator | Local V2 | Rejected | No reinterpretation of future recipes |
| V1/V2 legacy backup with no visual rows | Cloud V2, no existing visual/16B/C ledger | Existing reset flow | Preflight must pass; no artwork to lose |
| Any backup with visual rows | Cloud V2 | **Blocked before reset** | Atomic multi-table restore needed (future phase) |
| Any backup into household already containing visual rows | Cloud V2 | **Blocked before reset** | No silent visual loss |
| Legacy V1 reset/delete of an Action/routine/entity | Cloud with 18B SQL installed | V1 path unchanged | AFTER DELETE trigger removes only matching override rows |
| Concurrent V1 task action + V2 artwork edit | Cloud V2 | V1 RPC unchanged | Independent resource; older V1 client cannot modify artwork |
| V1 owner full-household reset during V2 use | Cloud V2 | **Operationally unsafe without coordination** | Legacy reset bypasses V2 outbox; coordinate maintenance and refresh |
| Unsupported cloud generator version | V2 rendering | Auto only | Original JSON remains untouched in DB |

Migration remains additive/unapplied. **No production or staging Supabase deployment was performed here.**
