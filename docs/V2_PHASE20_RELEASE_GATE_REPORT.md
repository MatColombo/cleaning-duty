# House Care V2 - Phase 20 release validation report

**Audit date:** 2026-10-13. **Current decision: NO-GO / BLOCKED.**

**Audit baseline:** Phase 19B cumulative source `2.0.0-rc.9` extracted from the supplied ZIP. No Phase 20 runtime feature code was added, no schema was executed, no Cloudflare deployment was triggered, and no branch was merged.

## Verified provenance and release identity

- Supplied Git archive: `v2-testing` HEAD `8f57d48` (Phase 15 `2.0.0-rc.1`). `main` HEAD `010d2b7`, with Git commit subject `v1.3.4`, but declared `package.json`/service worker version is `1.2.1-r4`. Neither is proof of the currently live deployment.
- V1 `main` Wrangler Worker name: `house-care-pwa`. V2 branch Wrangler Worker name: `cleaning-duty`. A new V2 Worker deployment will not automatically serve the existing V1 hostname. Explicit route/domain cutover and same-origin SW acceptance are mandatory.
- Phase 19B candidate ZIP has no Git metadata and no npm lockfile. Its `package.json`, README, SW cache key, manifest and icon query strings consistently declare `2.0.0-rc.9`.
- Backup format is schema 11, supporting imports of schemas 2-11 in the current pure backup implementation. Five V2 additive migrations are present, all unapplied in this session.

## Checks executed here

| Command | Result | Evidence |
|---|---|---|
| `npm run qa:static` | PASS (30 checks) | `docs/qa/phase20-evidence/qa-static.log` |
| `npm run qa:syntax` | PASS (157 source files parse) | `docs/qa/phase20-evidence/qa-syntax.log` |
| `NODE_PATH=$(npm root -g) npm test` | PASS | `docs/qa/phase20-evidence/npm-test.log` |
| Four separate `tests/*.test.cjs` source/SQL audits | PASS (static contract; **not** PostgreSQL) | `docs/qa/phase20-evidence/sql-contract-source-tests.log` |
| `npm run typecheck` | BLOCKED by missing React, Vite and their type packages | `docs/qa/phase20-evidence/typecheck.log` |
| `npm run build` | BLOCKED before Vite bundle | `docs/qa/phase20-evidence/build.log` |
| `npm run qa:release` | BLOCKED during typecheck after earlier checks | `docs/qa/phase20-evidence/qa-release.log` |
| npm registry package read | BLOCKED (`EAI_AGAIN` DNS) | `docs/qa/phase20-evidence/npm-registry.log` |

Source-level PASS does not prove browser runtime correctness, DB atomicity or service behavior. The registry failure means compile diagnostics about missing JSX/React/Vite cannot safely be interpreted as real app errors or passes.

## Gate summary

The reproducible `phase20-release-gates.csv` contains **26 gates: 10 PASS, 16 BLOCKED**, including security, build, browser/PWA, EN/IT, device performance, migration/RLS, Worker Preview, restoration and release rollout. Zero genuine running-app screenshots were obtained. The separate screenshot index enumerates all 22 required states as BLOCKED with no fabricated files.

The Phase 19A/19B art proofs and Phase 16D/17B/19B Node benchmark JSON remain historical benchmarks, not Phase 20 live measurements. No device frame rate, warm-start wall-clock, Supabase request/egress trace, Postgres storage usage or PWA memory was measured.

## Existing behavioral guard requiring release policy

- **Mixed-client household boundary:** Phase 16B/16C activated households cannot safely accept older V1 linked-task/After Completion writes. The new trigger guards fail closed for protected task events, but legacy V1 configuration and whole-household reset paths remain operationally unsafe without coordination. V1 users should continue on unactivated households; activated cohorts must be V2-only.
- **Cloud restore limitation:** The source preflight intentionally rejects cloud full restore when integrated Extra Care ledgers or saved visual/scene resources cannot be safely restored atomically. That is data-loss prevention, **not** a passing full cloud restore implementation.
- **No current Supabase staging:** the migration scripts, RLS smoke fixtures and cross-client transactions were not executed against PostgreSQL. Neither production nor staging SQL was changed.
- **PWA domain mismatch:** V1 and V2 Worker names differ; a Worker deployment is not itself a production route change. Old-worker-to-new-worker update must be tested on a stable same-origin staging host.

## Remaining blockers to close before release

1. On a connected machine, generate/commit `package-lock.json`, use Node 22+, run `npm ci`, then pass `npm run qa:release` and `npm run build` without suppression.
2. Create or select approved isolated Supabase staging, reconcile historical V1 migration tracking, apply/review all five additive V2 migrations in sequence, run RLS/auth/CAS/legacy tests and record actual Postgres errors/results.
3. Run real V1 client against staging V2-additive schema (unactivated household) and explicit V2 activated household exclusion tests; decide restoration support or formal restriction.
4. Create a staging Cloudflare Worker Preview bound to a staging-only Supabase URL; test E2E, screenshots, EN/IT, multiple palettes, reduced motion, accessibility, iOS/Android installed PWA, and old-worker upgrade/deep links.
5. Collect actual startup/HAR/bytes/FPS/heap and database quota data; agree limits and verify Supabase Free budget.
6. Rehearse DB recovery and frontend + hostname-route rollback; approve the production migration and household cutover separately from code promotion.
7. Only once all mandatory release gates pass, set the approved final product version, rerun the build/release gates and authorize deployment or merge as separate controlled actions.

**No production deployment is authorized by this report. The full operator guide is `docs/V2_PHASE20_DEPLOYMENT_GUIDE.md`.**
