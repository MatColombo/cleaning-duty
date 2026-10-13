# House Care V2 — Phase 18B implementation and regression report

**Baseline:** exact Phase 18A ZIP (`2.0.0-rc.6`). **Candidate:** `2.0.0-rc.7`. **Status:** source candidate; SQL staged/unapplied; no production or staging Supabase deployment. **Scope:** additive visual recipe persistence only; stopped after 18B.

## 1. Implemented

- Added the `VisualOverrideRow` and `VisualOverrideMutation` models, per-household subject checks, client-side whitelist validation and 2 KiB JSON ceiling in `src/lib/visualOverrides.ts`.
- `WorkspaceData.visualOverrides` contains only recipe instructions. Local mode persists them in its existing workspace snapshot. Cloud mode loads them once per normal household refresh; missing table activates a fail-closed capability guard. No Realtime, Storage, image export or polling was added.
- The Character Studio opens on the subject's persisted override and keeps edits as an in-memory draft. Only **Confirm artwork** invokes a durable save through `useData().commitVisualOverride`. Closing discards unconfirmed edits. A revision captured at editor-open prevents silent overwrite after an intervening refresh. Reset to Auto is an explicit `{}` revisioned save.
- Phase 16A Sync Coordinator has a third FIFO operation `visual`. All writes are persisted in the account-and-workspace-scoped outbox before optimistic UI acknowledgement, then sent through an additive CAS RPC. Ack verification compares revision and mutation ID; retries and duplicate replay are idempotent. The conflict UI retains the draft, with an explicit keep-local rebase or cloud discard. No slider changes create writes.
- Active Care Cards use saved recipe instructions with precedence **routine > entity > Action > Auto**; routine, Action and Home entity thumbnails also read their own compatible subject overrides. Unsupported generator/schema versions render Auto without erasing the stored row. Legacy history, notifications, cleanliness, assignment, task completion and stock are not touched.
- Bumped V2 backup schema **9 → 10**. V9 and older are read and normalized with no overrides. Valid V10 local imports restore instruction rows to the destination household; archived subjects remain exportable. Malformed, unknown-subject or incompatible-version backups fail safely.

## 2. Additive staging SQL and V1 coexistence

- `supabase/migrations/20261012190000_v2_phase18b_visual_overrides.sql`: RLS member-only reads, no direct client DML, server validated enum JSON (<= 2048 bytes), per-subject revision CAS, idempotency receipts and same-household lock, subject existence/archived checks, plus legacy subject-delete cleanup triggers.
- `supabase/migrations/20261012190001_v2_phase18b_rollback.sql.example`: destructive rollback requiring manual backup, never executed.
- `supabase/staging/v2_phase18b_rls_concurrency.sql`: staged member A/B/outsider/RLS and CAS script, `ROLLBACK` only; **not executed**.
- No existing V1 table meaning, task RPC, reset RPC signature or notification behavior changed. Ordinary V1 clients ignore this additive table. A legacy V1 full restore may delete subject records; the additive triggers remove dependent visual rows, preventing orphans. However, V1 reset does not coordinate with V2 outbox operations, so simultaneous legacy full-household restores remain an operational restriction.
- The existing multi-step V1 full-household restore is not atomic across all V2 ledgers. Therefore **cloud import is blocked before any reset if either source or destination contains visual overrides**. Existing Phase 16B/16C ledger restore restrictions remain. Local V10 artwork import is supported; atomic cloud V10 artwork restore is an explicit deferred capability.

## 3. Validation matrix

| Gate | Observed | Scope |
|---|---|---|
| `npm test` | **PASS** | All available historical V1/V2 domain tests, Phase 18A + 18B focused tests |
| Phase 18B two-member/cloud simulation | **PASS** | A save / B normal refresh, stale conflict, explicit rebase, revisioned Auto reset |
| Offline restart / lost ack / duplicate replay | **PASS** | Local durable 16A queue and simulated CAS transport |
| Unsupported recipe / input safety / backups | **PASS** | JSON strictness, Auto fallback, archived exports, v9 and v10 import |
| `node tests/v2_phase18b_sql_contract.test.cjs` | **PASS** | SQL **static contract**, not execution |
| `npm run qa:static` | **PASS** | Static source/asset audit |
| `npm run qa:syntax` | **PASS** | TypeScript/TSX syntax parser only |
| Dependency-backed `npm run typecheck` / `build` | **BLOCKED** | React/Vite/type dependencies unavailable here |
| Live SQL migration/RLS/two-client staging | **NOT RUN** | No database access or approval exercised |
| Browser/standalone PWA/screenshots | **NOT RUN** | Needs dependency-complete test setup and devices |
| Supabase storage/HTTP billable bytes | **NOT MEASURED** | Source JSON benchmark only |

Logs: `docs/qa/phase18b-evidence/` in the ZIP. Test scripts are reproducible, but their passing results are **not cloud E2E**.

## 4. Instrumented JSON-envelope measurements

`node tools/phase18b-traffic-benchmark.cjs` measured UTF-8 `JSON.stringify` sizes under Node 22.16.0. These figures **exclude** HTTP headers/TLS, PostgREST metadata, SQL WAL, indexes, row/page overhead and real network traffic. Results are in `docs/qa/phase18b-evidence/traffic-json-benchmark.json`.

| Explicit action | Override JSON bytes | Measured RPC JSON envelope bytes | Writes |
|---|---:|---:|---:|
| Pose only | 20 | 276 | 1 |
| Expression + eyes + palette | 62 | 318 | 1 |
| All 13 curated controls | 257 | 513 | 1 |
| Reset to Auto (`{}`) | 2 | 258 | 1 |
| Sliding/previewing before Confirm | Not serialized | 0 | 0 |

Sample one-row JSON envelope: 607 bytes. One thousand analogous rows serialized into **608,001 bytes**, a protocol-envelope sample, **not PostgreSQL disk usage**. One additive `SELECT` occurs per normal household cloud load/refresh; no continuous polling. Free-tier quotas and request usage must be inspected in staging before deployment.

## 5. Open release blockers and exact next actions

1. In a disposable staging Supabase copy, obtain explicit migration approval. Apply Phase 18B SQL *only there*, run member/outsider RLS and duplicate/parallel CAS tests, and verify existing V1 RPCs still work.
2. On a dependency-complete Node machine run `npm install`, `npm run qa:release`, browser/PWA editing and offline/reload tests. Capture physical device screenshots, navigation/focus and actual request totals/bytes.
3. Independently review cloud backup restore architecture before enabling cloud artwork import. Do not weaken the preflight block.
4. Check staged storage/Free quotas (`pg_total_relation_size`) and tune retention policy for idempotency receipts if necessary. Do not delete outstanding receipts while offline retries may exist.
5. Deploy only following separate explicit approval, after staged sign-off and a production backup.

**No SQL was executed, no Supabase table was changed, no Cloudflare build deployed, no V1 RPC was modified. Stopped after 18B.**
