# House Care V2 — Phase 0 Baseline Report

**Phase:** 0 — establish and normalize the pre-V2 baseline  
**Baseline application version:** `1.2.1-r4`  
**Backup schema:** `9`  
**Status:** **PARTIAL / NOT CLEARED FOR PHASE 1**

## 1. Source provenance

The supplied source archive is a GitHub-style source snapshot named `cleaning-duty-main.zip`.

- The archive contains **no `.git` directory**.
- Therefore the Git commit SHA / Git tag cannot be independently recovered from this archive.
- The previously mentioned `010d2b7` / `v1.3.4` observation cannot be verified from the supplied bytes and is not treated as authoritative.
- SHA-256 of the supplied archive:
  `28fccb18172436be550d260d71e66a90c04b306337b040ec80c84e7f311ea59f`

For this phase the uploaded source snapshot is the authoritative baseline.

## 2. Version audit before normalization

Observed in the supplied source:

| Surface | Value before Phase 0 |
| --- | --- |
| `package.json` | `1.2.1-r4` |
| README heading | `v1.2.1-r4` |
| service-worker cache version | `v1.2.1-r4` |
| backup `APPLICATION_VERSION` | `1.2.1` |
| manifest icon cache-busters | `1.2.1` |
| HTML favicon/touch-icon cache-busters | `1.2.1` |
| About/version display | no dedicated app-version display found |

The source itself therefore identifies as `1.2.1-r4`; the inconsistent values were backup metadata and public icon cache-busters.

## 3. Version normalization implemented

`package.json` is now the canonical application-version source for runtime TypeScript.

Changes:

- added `src/app/version.ts`, deriving `APP_VERSION` from `package.json`;
- backup exports now derive `APPLICATION_VERSION` from `APP_VERSION`;
- service worker remains `v1.2.1-r4`;
- manifest icon cache-busters are now `1.2.1-r4`;
- HTML favicon/touch-icon cache-busters are now `1.2.1-r4`;
- added `tools/check-version.cjs`;
- added `npm run check:version`;
- build/test scripts now run the version consistency check.

Current consistency check result:

`Version consistency check passed: 1.2.1-r4`

## 4. Dependency / lockfile state

The supplied repository contains:

- `package.json`;
- no `package-lock.json`;
- no `pnpm-lock.yaml`;
- no `yarn.lock`;
- no `node_modules`.

The intended package manager is npm based on the repository scripts and deployment documentation.

Dependency installation was attempted. The execution environment cannot resolve/connect to the npm registry, and the npm cache is empty. Therefore:

- dependencies could not be installed;
- a trustworthy npm lockfile could not be generated;
- no lockfile was fabricated manually.

This is an environment limitation, not a repository dependency-resolution result.

## 5. Tests

The repository's pure-domain test harness can run against the system TypeScript installation when exposed through `NODE_PATH`.

Result: **GREEN**.

Passing suites:

- Phase 0 pre-V2 regression backup test;
- v1.2.1 linked activities / Stock / cleanliness / presentation / backup;
- v1.2.1 loading and theme expansion;
- v1.2.0 corrective tests;
- v1.2.0 Everyone assignment;
- v1.2.0 Phase 1;
- v1.2 Phase 2;
- v1.2.0 Phase 3;
- v1.2.0 Phase 4;
- v1.2.0 state consistency.

The test harness was minimally updated to compile JSON imports because runtime application version now comes from `package.json`.

Important limitation: the system TypeScript version used for this fallback test execution is not the repository-declared TypeScript dependency, so this does not replace a clean `npm install && npm test` run.

## 6. Typecheck

A project typecheck was attempted with the available system TypeScript compiler.

It fails immediately because frontend dependencies and their declarations are not installed, beginning with:

- `react`;
- `react-router-dom`;
- `react/jsx-runtime`.

The resulting JSX/implicit-any cascade is not considered evidence of source defects because the expected React type packages are absent.

**Status: blocked until dependency installation is possible.**

## 7. Production build

`npm run build` was attempted.

The version consistency check passes, then TypeScript stops on the same missing React/dependency declarations before Vite is reached.

**Status: blocked until dependency installation is possible.**

## 8. Runtime baseline / screenshots

The app cannot be faithfully run from source without its React/Vite dependencies, and there is no committed `dist/` build in the archive.

Therefore authentic runtime screenshots could not be captured in this environment.

A screenshot inventory is reserved at:

`docs/baselines/v1.2.1-r4/README.md`

Required real-runtime captures include Overview, Home normal/edit/room modes, Actions, Routines, routine builder, Supplies, Analysis, Settings, task sheets, auth/setup and boot.

**No mock screenshots should be substituted for this baseline.**

## 9. Pre-V2 regression backup

Added:

`tests/fixtures/pre-v2-household-backup.json`

It is schema v9 and includes representative state for V2 regression:

- multi-member household;
- semantic rooms/items;
- Home layout scene/elements;
- Actions;
- Regular and Deep routines;
- completed history;
- rescheduled occurrence where `effectiveDueAt != scheduledSlotAt`;
- Regular and Deep health trajectories;
- low/reserve Stock;
- linked every-N routine;
- real linked child occurrence with `parentOccurrenceId`.

Added `tests/phase0_baseline.test.ts` to verify the fixture through the real backup parser and preserve these characteristics.

## 10. Current route/source baseline

Current primary routes from `src/App.tsx`:

- `/` → Overview;
- `/today` → redirect to Overview;
- `/task/:taskId` → Overview task deep link;
- `/home`;
- `/insights`;
- `/actions`;
- `/routines`;
- `/supplies`;
- `/settings`;
- unknown routes → Overview.

Auth, Setup and Boot are state-driven rather than normal shell routes.

## 11. Phase 0 exit-criteria status

| Exit criterion | Status |
| --- | --- |
| Exact source baseline recorded | PASS, except commit SHA unavailable because `.git` was not supplied |
| Consistent versioning | PASS |
| Canonical application version source | PASS |
| Clean dependency install | BLOCKED by sandbox network |
| Reproducible lockfile | BLOCKED by sandbox network |
| Current tests green | PASS for repository pure-domain suite |
| Typecheck green | BLOCKED by missing installed dependencies |
| Production build green | BLOCKED by missing installed dependencies |
| Local runtime verified | BLOCKED by missing installed dependencies |
| Real baseline screenshots | BLOCKED by missing installed dependencies |
| Pre-V2 regression backup | PASS |

## 12. Exact remaining Phase 0 commands

Once npm registry access is available in an environment containing this source tree, Phase 0 must resume with:

```sh
npm install
npm run check:version
npm test
npm run typecheck
npm run build
npm run dev -- --host 127.0.0.1
```

Then capture and store the real screenshots listed under `docs/baselines/v1.2.1-r4/README.md`, using local-only/cloud-disabled mode where possible and the pre-V2 fixture/backup for representative data.

Only after all of those checks pass should Phase 0 be marked complete and Phase 1 begin.
