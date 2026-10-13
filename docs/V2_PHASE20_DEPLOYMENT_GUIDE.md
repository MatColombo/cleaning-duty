# House Care V2: step-by-step deployment from Phase 15 to the Phase 20 release gate

**Prepared:** 2026-10-13. **Based on:** the supplied Phase 15 Git archive and the exact Phase 19B `2.0.0-rc.9` cumulative source ZIP. **Current decision:** NO-GO / BLOCKED. This is an operator procedure, not evidence that Phase 20 has already passed. **Do not execute migrations, deploy, activate a household, or merge to `main` without a separate explicit approval.**

## Ground rules: read before starting

- "Phase 15" is the earlier V2 candidate `2.0.0-rc.1`, **not** a production application version 15. The supplied Git snapshot shows `main` at commit `010d2b7` with subject `v1.3.4`, **but the actual V1 `package.json` and service worker declare `1.2.1-r4`**. The snapshot shows `v2-testing` at the Phase 15 `2.0.0-rc.1` candidate. Git commit subjects do not prove deployed app versions; verify the actual live worker and UI.
- The Phase 19B ZIP is the latest cumulative source snapshot (`2.0.0-rc.9`), including Phases 16A through 19B. It contains **no `.git`**. Do not treat its ZIP timestamp as a Git commit or assume it is present remotely on `v2-testing`.
- Phase 20 is primarily testing, compatibility hardening, and release sign-off. No automatic promotion of a candidate to final `2.0.0` is permitted.
- One cumulative, validated release is preferable to publishing intermediate RCs 16A/16B/16C/17/18/19 on production sequentially. Apply their **additive DB migrations in chronological order**, then make a separate household capability activation/cutover decision.
- V1 continues on unactivated households. Once a household is activated for 16B integrated Extra Care/16C atomic recurrence, it is **V2-only for writes**. No safe assumption about editing that same linked household simultaneously from V1, including offline V1 devices or full-household configuration writes.
- Historical V1 RPCs, legacy V1 history and backups must remain intact. Never run `supabase db reset --linked`, initial setup SQL or `supabase/setup/v1_full_database.sql` against the existing live database.
- Never store private Supabase keys, Postgres URLs/passwords, VAPID private key or cron secret under any `VITE_*` variable or in source control. Published Vite environment variables are client-visible by design.

## 0. Establish the stop/go baseline

**Operator:** release coordinator. **No remote changes.**

Confirm that:

1. You know the actual production URL, Git commit, declared app version and Cloudflare Worker deployment/version currently serving V1. **The supplied V1 `main/wrangler.jsonc` uses Worker `house-care-pwa`, whereas V2 `v2-testing/wrangler.jsonc` uses `cleaning-duty`; do not confuse them.**
2. `main` and the V1 Worker remain available for rollback; freeze unrelated production changes during cutover.
3. A separate sanitized staging Supabase project or isolated/local clone is available; a Cloudflare Preview alone does **not** isolate a preview's frontend `VITE_SUPABASE_URL`.
4. You have identified every device still capable of writing to the target household (including offline installed V1 PWAs).
5. You have arranged secure production DB backup and V1/V2 user-facing JSON exports.
6. No one has implied that the Phase 19B pure test PASS is a completed Phase 20 E2E PASS.

**STOP** if a clean staging database, protected V1 baseline, or full compatible client-device migration plan is unavailable.

## 1. Protect V1 and record recoverable backups

**No schema or application deployment yet.** In the Git working repository (not the ZIP):

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git tag --list 'pre-v2-*'
```

Record the commit hash, the **declared** app/service-worker version, production hostname and currently deployed Cloudflare Worker name/version ID in a private change ticket. The V1 snapshot says `1.2.1-r4` in package/SW despite the `v1.3.4` commit subject; do not infer a production version from the commit message. Preserve an immutable tag such as `pre-v2-phase20-YYYYMMDD` only after checking that it does not already exist. **Do not retag an existing release.** Keep the rollback production artifact, credentials and URL available.

Export a V1 JSON backup through the production app from an authorized account. Obtain a secure database backup/snapshot using your existing approved Supabase method (and optionally a database dump via an authenticated CLI), including relevant authentication/notification dependencies. Verify the backup can be restored into a disposable database; a backup file's existence is not sufficient. Document retention and who can restore it. Never upload user database dumps to an untrusted service or commit them to Git.

Before schema changes, capture `pg_get_function_identity_arguments`, definitions and grants of the existing V1 RPCs, RLS policy list, key table counts and existing cloud backup behavior in a trusted staging/admin context. Keep these as a before/after comparison.

## 2. Bring Phase 19B into `v2-testing` safely

**Source change on testing branch only. No deploy.** Download/unzip the supplied `HOUSE_CARE_V2_PHASE19B_UPDATED.zip` and identify the interior `cleaning-duty/` folder. In the *real Git checkout*:

```bash
git switch v2-testing
git pull --ff-only origin v2-testing
git status --short
```

Require a clean working tree. From the root of that Git checkout, merge in the unzipped folder's source while preserving `.git`, local ignored credentials, and any CI config absent from the ZIP. One option (adjust paths explicitly, REVIEW before copying) is:

```bash
rsync -av --dry-run --exclude=.git --exclude=node_modules --exclude=dist --exclude='.env.local' --exclude='.env.production' /path/to/unzipped/cleaning-duty/ ./
rsync -av --exclude=.git --exclude=node_modules --exclude=dist --exclude='.env.local' --exclude='.env.production' /path/to/unzipped/cleaning-duty/ ./
git status --short
git diff --stat
git diff --check
```

**Do not use `--delete` automatically.** Some historically tracked files/CI definitions may not be present in the later ZIP and should be removed only after manual parity review. Inspect the Git diff for accidental secrets, domain/RPC changes, service-worker changes, migration alterations and V1 asset removal. Commit the cumulative candidate on `v2-testing` with a clear 19B/Phase20-preflight message; never push it to `main` as a shortcut. Re-fetch remote Git before acting if the branch has advanced beyond the supplied snapshot.

## 3. Reproduce the dependency-backed local release gate

**Operator:** developer, with network access to npm. Current ZIP has no `package-lock.json`; the supplied isolated environment cannot reach npm (`EAI_AGAIN`).

```bash
node --version           # use Node 22+
npm --version
npm install              # once, to resolve dependency versions and create package-lock.json
# inspect package-lock.json, commit it on v2-testing
npm ci                   # clean reproducible install
npm run qa:release       # static, syntax, npm test, typecheck, Vite build
```

Record complete logs and exit codes for `npm run qa:static`, `npm run qa:syntax`, `npm test`, `npm run typecheck`, `npm run build` and `npm run qa:release`. `qa:release` is a **mandatory PASS** (no suppressed errors) before any preview. Re-run after every release-blocking fix; fixes remain on `v2-testing`.

If Phase 20 requires code fixes, advance to a new candidate version such as `2.0.0-rc.10`, **not** final `2.0.0`. Run `npm run check:version`; ensure one version in package, `README.md`, `public/sw.js`, manifest query strings, `index.html`, diagnostics/About and release notes. The existing application derives `APP_VERSION` and the backup application version from `package.json`; its schema-11 backup format is a separate version, not the application version.

**STOP** if TypeScript compile, Vite build, source suite, lockfile reproducibility, or version check fails.

## 4. Prepare an isolated Supabase staging environment

**This is where database work begins, only with explicit staging approval.**

Create a **separate** staging project or sanitized/local isolated clone with the V1 schema, compatible auth users, household owner/member/outsider fixtures, routines, tasks, stock, layouts, notifications and historical Extra Care children. Sanitize private data. Do not point the Preview PWA at production merely because its Worker URL is a Preview.

Verify which baseline V1 migrations have already been installed. The V1 project may have been initialized using a historical full setup SQL rather than Supabase CLI migration history. Do **not** blindly run the entire local migration directory against an existing database. The correct migration history may require a reviewed reconciliation before pushing anything.

From the staging-linked source checkout (verify the project ref/address **twice**):

```bash
npx supabase@latest login
npx supabase@latest link --project-ref STAGING_PROJECT_REF
npx supabase@latest migration list
npx supabase@latest db push --dry-run
```

The plan should show **only intentionally pending migrations**. Record expected objects, target project ref and a backup reference. Unexpected legacy migrations, edits to V1 RPC signatures, schema drift or destructive statements are **STOP** conditions; reconcile in staging under DBA review. Keep `--include-seed` off, and NEVER use linked `db reset` on production.

## 5. Apply the additive V2 migrations, in exactly this order

**Staging first, after explicit approval. No household activation yet.** Five staged migrations are in `supabase/migrations/`:

| Order | Phase | Forward SQL | Effect |
|---|---|---|---|
| 1 | 16A | `20261012000000_v2_phase16a_cas_patch.sql` | `v2_sync_applied_ops`, transactional per-field CAS RPC `v2_apply_entity_changes` |
| 2 | 16B | `20261012130000_v2_phase16b_integrated_extra_care.sql` | Extra Care event/ledger/carry/audit tables, owner-controlled activation and `v2_apply_integrated_care` |
| 3 | 16C | `20261012160000_v2_phase16c_recurrence.sql` | Recurrence capability, `successor_of_event_id`, atomic After Completion and bounded generated-occurrence RPCs |
| 4 | 18B | `20261012190000_v2_phase18b_visual_overrides.sql` | Validated 2 KiB character JSON with RLS and revisioned CAS |
| 5 | 19B | `20261012213000_v2_phase19b_scene_decorations.sql` | Validated scene JSON (16 decorations, max 6,144 bytes), RLS, revisioned CAS |

There is no Phase 17 or 19A database migration. The V2 RPCs are additive; these scripts are not substitutes for the prior V1.2.1 schema.

Once the migration list, baseline and staging connection have been reviewed, use the normal migration mechanism on staging:

```bash
npx supabase@latest db push
npx supabase@latest migration list
```

Do not do this on the shared Supabase project until the **later production SQL approval**. Capture table existence, RLS policies and grants; check V1 function signatures remain stable. Applying the 16B/16C SQL does **not** automatically activate households.

## 6. Run RLS, concurrency and V1 coexistence on staging

Seed three auth users: owner, authorized household member and unrelated outsider, plus two households and appropriate task/scene/subject fixtures. These scripts contain test mutations inside `BEGIN ... ROLLBACK` and must run with `ON_ERROR_STOP=1` and the required named UUID parameters. Read the script headers before running:

```bash
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 [fixture -v arguments] -f supabase/tests/v2_phase16a_rls_staging.psql
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 [fixture -v arguments] -f supabase/tests/v2_phase16b_rls_staging.psql
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 [fixture -v arguments] -f supabase/tests/v2_phase16c_rls_staging.psql
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 [fixture -v arguments] -f supabase/staging/v2_phase18b_rls_concurrency.sql
psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 [fixture -v arguments] -f supabase/staging/v2_phase19b_scene_rls.sql
```

`[fixture -v arguments]` is an instruction placeholder, not literal shell syntax. Pass the UUIDs documented at the top of **each** file; do not invent or reuse fixture IDs that do not correspond to that script. Staging authentication/role fixtures must faithfully exercise Supabase authenticated role behavior.

Required outcome: member can read and edit only within authorized household; outsider cannot read or execute RPC; direct table mutation is blocked; malicious JSON and excessive arrays are rejected; duplicate IDs replay idempotently; stale revisions return recoverable conflicts without half-application.

**V1 coexistence matrix:**

- In an **unactivated** V1 household, run the actual V1 production client (built from the preserved `main` commit and connected to staging) against the updated schema. V1 login, workspace, regular/Deep tasks, historical linked children, stock, Undo, reassignment, Everyone vs Unassigned, Home layout and backup export must still work.
- In a disposable **V2-only** household, review and deliberately call the owner-only `v2_activate_extra_care_household` and `v2_activate_recurrence_household` as authenticated owner, after all outboxes are drained. Run integrated Extra Care and atomic recurrence scenarios. The legacy V1 primary/linked-child or After Completion task path must **fail closed**, not silently mutate the task.
- Confirm V1 full-household configuration writes/reset remain an explicit incompatibility for *activated* households. Do not market unconditional simultaneous V1/V2 editing. If the required coexistence policy demands that, Phase 20 is **FAIL/BLOCKED until additional safeguards are designed and validated**.

## 7. Run mandatory domain regression on the real candidate

Run the full `npm test` suite and dedicated source regressions first, then E2E with two authenticated browsers and an actual staging Postgres backend. Preserve request/response/event evidence for:

1. Phase 16A: rapid A -> B edits while A is in flight, stale refresh overlay, logout/switch, offline restart, duplicate retry, Complete -> Undo and Complete -> Stock.
2. Phase 16B: due Extra at primary #4 implicitly completes with primary; postpone #4 -> #5 -> #6, **not** #8; collision at #8 merges, Skip carries obligation, Undo restores Extra Care effect and event history; completed old linked child history stays readable.
3. Phase 16C: scheduled Sep 1, completed Sep 3, 5-day After Completion -> Sep 8; monthly edges/DST; safe Undo successor; five future occurrences for 18-month Fixed Calendar; no duplicates after reload or two-device materialization.
4. Assignment, advanced targets, Everyone vs Unassigned, recurrence exceptions, pause/archive, notification scheduling/deep links, Undo/Restore, history attribution and cleanliness Regular/Deep.
5. Visual override and scene decoration confirm/retry/conflict/reset/backup behaviors. No writes per pointer movement; one targeted transaction on explicit confirmation.

Do not mark simulated client tests as live cloud E2E. Keep request traces and DB after-state snapshots from staging.

## 8. Run real browser, accessibility and mobile/PWA acceptance

After `npm run qa:release` passes, launch an actual locally served app or isolated Worker Preview. Install Playwright and its Chromium browser (on a connected development machine) and execute the existing runners as *starting points*, not as a complete Phase 20 suite:

```bash
npm install --no-save playwright
npx playwright install chromium
npm run dev -- --host 127.0.0.1
# separate terminal, with a running reachable app:
V2_BASE_URL=http://127.0.0.1:5173 node tools/phase17a-browser-acceptance.mjs
V2_BASE_URL=http://127.0.0.1:5173 node tools/phase17b-browser-acceptance.mjs
```

Capture **real running-app screenshots**, not source-generated proof SVGs, in browser and installed-PWA contexts: healthy, overdue, Deep and empty Overview; Complete/Undo and deck menu; critical items and Extra Care; Timeline/Restore; Home Illustrated/Edit and room mode; Routines; Actions; Supplies; Analysis; Settings; Character Studio; scene decoration editor; EN/IT and themes; banners/sheets/overlays. Each screenshot record must include app version/commit, viewport dimensions, DPR, browser/OS, locale, theme, account-safe test fixture, UTC timestamp and URL/route. A screenshot with synthetic or real personal data must stay in a restricted evidence folder.

Repeat touch, keyboard, screen-reader focus, modal trap/return, safe areas, text zoom at 200%, narrow/short viewports, reduced motion, horizontal clipping, back button, offline state, service-worker update, notifications and deep links on actual iOS Safari standalone and Android Chrome installed PWAs if available. Ensure a deck swipe never changes task state and no body controls are covered.

**STOP** if mandatory browser/PWA, EN/IT or accessible interaction verification has no real evidence.

## 9. Record performance and Supabase Free use against measurements

Collect before/after measurements on the same fixtures and devices, with mobile network throttling documented:

- Cold/warm startup and separate stages: auth, membership, household read, 18-table fetch, local snapshot, materialization, first useful Overview paint, boot exit. Phase 16D's `<1s` warm cached target is a goal, **not an already achieved measurement**.
- Supabase calls and transferred bytes per session, per ordinary edit, per Save, per offline replay and per household activation; HAR waterfall with explicit authenticated-scope redaction. Count cloud writes during drag (must be zero).
- Gesture frame p50/p95, event-to-paint latency, front/rear SVG/DOM/path count, total JS heap and memory on a representative physical phone; include 3/30/100 tasks.
- DB disk size, per-table/index size, rows, idempotency receipt growth, egress, Auth/Edge Functions and Worker requests via provider Usage dashboards. Use **measured** quotas, not Node proxy bytes as bills.

Read-only SQL suitable for a **reviewed staging/production admin session**:

```sql
select pg_size_pretty(pg_database_size(current_database())) as database_size;
select relname, pg_size_pretty(pg_total_relation_size(relid)) as table_and_indexes
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('task_occurrences','task_events','v2_sync_applied_ops',
                  'v2_extra_care_events','v2_recurrence_households',
                  'visual_overrides','v2_visual_applied_ops',
                  'scene_decorations','v2_scene_applied_ops')
order by pg_total_relation_size(relid) desc;
```

Supabase Free has a 500 MB database-size limit with read-only behavior when exceeded (provider documentation as of 2026-10-13). Treat 70% utilization as an **operator-selected alert**, not a provider guarantee. Check current pricing/usage for egress and other limits directly in the project dashboard; do not assume unmeasured request volume is free.

## 10. Prove backup, restore and recovery before any production promotion

Use test data on staging and test locally with the actual application:

| Input / operation | Required expected behavior |
|---|---|
| Pre-V2 backup schema 2-8 | Accepted, normalized, preserves historical records |
| V2 schema 9 | Local import, automatic artwork/decorations |
| V2 schema 10 | Local import, validated Character Studio override instructions, no scene decorations |
| V2 schema 11 | Local import/export of validated overrides and scene data |
| V1 legacy restore on an unactivated disposable household | Matches preserved V1 expectations; verify against additive tables/triggers |
| V1 reset on an activated household | NOT safe for transparent V2 ledger preservation; coordinate, do not auto-run |
| V2 cloud full restore involving Extra Care ledger/visual overrides/scene decorations | **Intentionally blocked before deletion** in current source, until an approved atomic transactional restore exists |

The existing 16B/16C/18B/19B source guards are a **safe refusal**, not successful end-to-end cloud restore. If full production restore is a Phase 20 mandatory requirement, this must remain **BLOCKED/FAIL** until the missing safe implementation and E2E are completed and approved. A one-time manual database recovery procedure is **not** a substitute for user-facing restore without explicit scope acceptance.

Take a pre-release full DB backup and verify restore on staging. Never treat browser local storage or the 16A outbox as a database backup. Clear storage only after all pending edits are acknowledged or securely exported.

## 11. Deploy a **Worker Preview**, not production

**After passing local gates, with an approved staging backend.** The **V2** project's `wrangler.jsonc` has `name: cleaning-duty`, `assets.directory: ./dist/`, SPA fallback and `previews: {}`. The preserved **V1** `main` Worker config names `house-care-pwa`; these are separate deploy targets until an operator explicitly changes routing. Wrangler 4.135.0+ supports isolated **Worker Previews** via:

```bash
npx wrangler login
npx wrangler --version
# Build with staging/public browser configuration, never production DB credentials:
VITE_APP_MODE=cloud VITE_SUPABASE_URL=https://STAGING_REF.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=STAGING_PUBLIC_KEY npm run build
npx wrangler preview --name v2-testing
```

For Web Push testing also supply only staging **public** VAPID key. Never include a VAPID private key or Supabase service-role key in Vite. `wrangler preview` generates a stable preview URL for the named environment. Set that origin in the **staging** Supabase Auth allowlist/redirect URLs; if push is part of acceptance, provision a staging push secret/function/schedule only as needed and **without modifying the current production cron**. A preview URL alone does **not** isolate network calls embedded in the Vite build: verify that the compiled bundle targets staging.

Use Cloudflare Access when appropriate because Worker Preview URLs may be publicly reachable. Capture real network requests, HTML/SW response headers, and screenshot logs. **Do not run `npm run deploy` or `npx wrangler deploy` as a preview test:** those commands can update the production Worker. For PWA update testing, use a stable same-origin test URL. First validate Phase 15 V2 RC1 -> candidate upgrade; separately validate the **actual legacy V1 bundle** (`1.2.1-r4` from the supplied archive unless live inspection proves otherwise) -> candidate. Serve both old and new bundles on the **same testing hostname** by means of a reviewed test-only routing/Worker configuration. This is necessary because the V1 Worker name is `house-care-pwa` and the V2 Worker name is `cleaning-duty`. Verify update banner/activation/cache cleanup, offline reopening and deep links. Changing origin instead of route is a *new app installation*, not proof of an in-place SW upgrade. Never make a test deploy to production only to reproduce a SW upgrade.

## 12. Phase 20 release decision

All of these must be PASS with attached logs/traces, or release remains an RC:

- Actual `npm ci`, `npm run qa:release`, typecheck, Vite build and all domain suites.
- Real app E2E, browser and installed PWA, EN/IT, accessibility and complete screenshot index.
- Staging Postgres migration/RLS/atomicity, two-client conflict, backup/restore policy, V1 coexistence and controlled V2 activation.
- Staging Worker Preview, old-worker PWA update, push/notification and deep-link checks.
- Device startup/FPS/memory, Supabase traffic and quota measurements, passing agreed performance budget.
- A written restore and forward-only/recovery plan, responsible operators, sign-off and a rollback rehearsal.

A missing mandatory gate is **BLOCKED**; an observed unsafe behavior is **FAIL**. Neither may be reclassified PASS by manual opinion or by passing only a pure source test. If no Phase 20 code corrections are needed, the cumulative source is still `rc.9` until release approval. Only after all evidence is complete may the release coordinator assign the final product version `2.0.0` (or the approved number), update all version/cache/About/release-note references, rebuild from locked dependencies, rerun the full gate, tag and approve promotion.

## 13. Separately approved production database rollout (conditional)

**DO NOT RUN until explicitly approved.** In the change window:

1. Announce maintenance and coordinate every household/user/device. Freeze writes (including offline V1 activity awaiting sync), drain all V2 outboxes and account for unsynced edits; do not silently discard them.
2. Capture last known-good V1 Worker and secure DB snapshot. Validate the same tested migration files by checksum, ensure project ref is truly **production**, obtain DBA/owner sign-off.
3. Apply additive V2 migrations **only after** checking production migration history and a fresh `db push --dry-run` plan. Use the reviewed CLI/migration process, not an unreviewed SQL Editor paste or `reset`.
4. Immediately smoke-test actual V1 production client on an **unactivated** production test household against new schema: login, lifecycle, stock, Undo, layout, notifications and export. Verify no new errors, performance regressions or unexpected push duplication. Keep `main` and V1 Worker unchanged at this point.
5. Decide whether to stop at "V1+additive schema" or advance to V2 client release. **Do not activate** 16B/16C for any household that still has active V1 clients or unsupported restore expectations.

If any schema/RLS or V1 smoke gate fails, **do not activate V2 households or deploy final V2 frontend**. Revert schema only via an assessed DBA recovery procedure with validated backups, never by blind execution of rollback examples.

## 14. Separately approved production frontend + household cutover

**Only after every Phase 20 gate is PASS, approved final build exists and SQL is staged/proven.**

1. Decide the production **hostname and route** as a separate approved change: the current V1 source uses Worker `house-care-pwa`; V2 uses Worker `cleaning-duty`. Publishing `cleaning-duty` alone does **not** necessarily move the existing V1 production domain or installed PWA. If keeping the same hostname, verify and approve the Cloudflare route/domain mapping and same-origin SW upgrade; if switching hostnames, plan a separate install and new push subscription. Deploy the exact approved final artifact with the appropriate reviewed V2 Wrangler config (`npx wrangler deploy` only on explicit production approval), then perform the approved route switch. Preserve the previous Worker deployment ID AND route map for rollback; keep `main` protected and do not merge without a separate decision.
2. First run a restricted canary using an unactivated household. Confirm old V1 data/tasks/backup view still works and complete production frontend smoke without changes to task semantics.
3. For the initial V2-only activated test household, verify *all* users/devices have upgraded and offline V1 mutation queues are resolved. Capture a protected household export; activate 16B then 16C deliberately as authenticated owner, observing all versioned ledger semantics. Never bulk-enroll production households automatically.
4. Test owner/member real two-device operations and after-completion/Extra Care, then expand by controlled households with a reviewed rollback boundary. Unactivated households remain V1 compatible, subject to tested additive schema behavior.
5. Monitor DB, Worker, Push and device update results after each cohort; stop advancing on first unexpected conflict/restore issue. Do not schedule automatic migration of old V1 devices or client state.

## 15. Monitoring and safe rollback

Frontend rollback is *not* a DB rollback. If the new PWA/Worker has a regression before activation, pause writes and preserve outboxes. Restore the **previous production hostname routing** to the preserved V1 Worker if a route cutover was used, or use Cloudflare Dashboard Deployments -> Rollback / reviewed `npx wrangler rollback` only on the correct Worker, according to the recorded route/version map. Revalidate SW behavior: older cached bundles and outstanding offline requests can still exist on devices. Do **not** immediately permit V1 clients to mutate a household that has already been activated for integrated Extra Care/recurrence.

For SQL, preserve additive tables if possible, disable new V2 writes and collect evidence. The repository's `..._rollback.sql.example` files are **manual examples with data-loss/active-household preconditions**; some remove ledgers or custom instructions. Never run them automatically; assess and restore from a tested DB snapshot if the schema genuinely must revert. A forward-fix migration with the tables left intact is usually less dangerous than dropping historical ledger tables. Record exactly which transactions are acknowledged in local outboxes before clearing storage or switching users.

Suggested monitoring cadence after a controlled production rollout: initial 15/60-minute checks, first-day checks and following-day checks. Track app errors, task/stock mutation conflicts, push failures, DB utilization and unexpected write volume. Keep the incident decision maker identified.

## 16. Final decision template

```
Source SHA / branch:
App version / service worker cache key:
V1 preserved Worker version:
Staging Supabase project reference (not credentials):
Production schema migration history reviewed by:
Typecheck/build/full regressions: PASS | BLOCKED | FAIL
Browser/EN-IT/PWA/screenshots: PASS | BLOCKED | FAIL
Cloud RLS/two-user/backup and restore: PASS | BLOCKED | FAIL
V1 unactivated coexistence: PASS | BLOCKED | FAIL
Activated-household V1 safety boundary: PASS | BLOCKED | FAIL
Performance/Supabase Free measured: PASS | BLOCKED | FAIL
Rollback rehearsal: PASS | BLOCKED | FAIL
Approved by / approval date:
Release decision: GO | NO-GO
```

### Source references

Local source: `docs/V2_PHASE15_RELEASE_REGRESSION.md`; `docs/V2_PHASE16B_INTEGRATED_EXTRA_CARE.md`; `docs/V2_PHASE19B_REPORT.md`; `docs/V2_PHASE19B_BACKUP_COMPATIBILITY.md`; five SQL files and associated staging scripts listed above; `tools/check-version.cjs`, `tools/run-tests.cjs`, `wrangler.jsonc`, `.env.example` and `supabase/config.toml`.

Current platform guidance (verify again at deployment time):
- Supabase CLI migrations: https://supabase.com/docs/guides/local-development/cli-workflows
- Cloudflare Worker Previews: https://developers.cloudflare.com/workers/previews/get-started/
- Cloudflare Worker rollbacks: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Supabase database quota: https://supabase.com/docs/guides/platform/database-size

**No commands modifying shared infrastructure have been executed for this guide.**
