# Phase 16D — Fast Startup and Safe Hydration

**Source candidate:** v2.0.0-rc.2, based on verified Phase 16C ZIP. **No deployment, SQL or schema change.**

## Source-before/source-after startup waterfall

| Stage | Before Phase 16D | After Phase 16D | Measurement status |
| --- | --- | --- | --- |
| HTML/preboot and JS bundle | Eager page modules, preboot overlay | Overview eager, seven secondary page bundles + task deep-link resolver lazily imported via Suspense | No compiled bundle or browser timing available |
| Auth readiness | Supabase `getSession` + auth event | Same; session expiry also checked for offline cache | Instrumented `auth-ready`; device timing not captured |
| Household list | Invite claim, membership select and workspace select | Same online membership check before displaying any private snapshot | Instrumented `catalog-start` and `catalog-ready`; no live request trace |
| Household selection | Selection followed by cloud data wait | Selected from confirmed active catalog, checked against snapshot workspace ID | Instrumented `workspace-selected` |
| Cloud household read | Redundant invite claim and membership SELECT, followed by 18 parallel table queries and optional V2 capability/ledger reads | Fresh catalog confirms membership first, so duplicate invite claim and membership select are skipped; existing RLS still protects all table reads; same 18 tables fetched in background once snapshot is shown | Instrumented `cloud-read-start/end`, `tables-start/end`; no live bytes/times |
| Cached hydration | Offline fallback only, after cloud load failure | Fresh app-version/schema snapshot, scoped to user+workspace, loaded immediately **after** membership check; old compatible cache retained only for offline recovery | Instrumented `snapshot-read/hydrated`; cache parsing microbenchmark available |
| Recurrence materialization | Ran synchronously before first data-ready render | Scheduled after the first data-ready update and protected by activation epoch; 16A queue keeps generated writes ordered | Instrumented `materialization-end` |
| First Overview paint | Held until cloud read+materialization complete | Warm path can paint before full cloud read; cold path paints after cloud read but before materialization | Instrumented first Overview animation frame; device timing not captured |
| Boot exit | 520 ms minimum display hold + 360 ms exit animation | No minimum hold; 120 ms exit (0 under reduced motion), only after data/auth-ready | **880 ms vs 120 ms source-defined upper hold-plus-exit**, **not observed elapsed boot timing** |

## Security/integrity behavior

1. A cloud snapshot is never read for UI display before the app has a current authenticated account and an active workspace membership. Online: RLS-backed catalog is fetched. Offline/network transport failure: an unexpired cached Supabase session and per-account cached catalog are required. This is *provisional offline authorization*; a membership revoked on another device cannot be detected while offline. Server authorization denials never fall back to this path.
2. Snapshot scope, payload workspace ID, app version, schema and online age are checked. Old Phase 16C caches are eligible only in authenticated offline recovery, not accelerated online warm start.
3. The 16A coordinator alone merges full cloud refreshes with pending configuration/task/stock edits. No raw cloud response overwrites a pending mutation. The queued outbox is retained through offline restart, user signout and household switching, scoped by user+workspace. Private workspace snapshots and cached catalog/selection are erased on signout. Outboxes are not erased, as that would lose edits.
4. Failed catalog/household authorization does not display a previous private snapshot. If access is denied after optimistic hydration, the UI hides data and clears that workspace snapshot. Transport failures remain visible with a cached-data warning.
5. Epoch guards prevent delayed reads/generation from populating a different selected household or account. Lazy route modules do not change task semantics or navigation paths.
6. No polling, Realtime, Storage, SQL, new background job or server-side feature was added. Existing push, notifications, backup, Undo, recurrence, EN/IT, no-art and reduced-motion paths remain in source.

## Reproduce the timing measurements on a dependency-complete system

```bash
npm ci  # when a verified lockfile is available; repository did not supply one
npm test
npm run qa:static
npm run qa:syntax
npm run typecheck
npm run build
npm run preview
```

On a browser with the production bundle, inspect `performance.getEntriesByType('mark').filter(x => x.name.startsWith('housecare:'))` and `sessionStorage.getItem('housecare:startup:last')` after boot exit. Capture the full Performance/Network trace, including all 18 Supabase table calls and conditional capability queries. Report device make/OS, browser build, network profile, session status, app cache version, HTTP transfer bytes, LCP/Overview frame and worker state. Run at least 5 cold and 5 warm navigations. For installed standalone PWAs, capture separate runs with actual device tools, not browser emulation. The warm useful Overview target is <1000 ms where practical, but has **not been verified** in this environment.

Reproducible **parse-only** measurement (no browser or cloud): `node tools/bench-phase16d-startup.cjs docs/qa/phase16d-evidence/startup-microbenchmark.json`. This measures only local JSON envelope decode+workspace key check and deliberately leaves real cold/warm startup measurements `null`.

## Remaining risks and release gates

- **BLOCKED:** actual dependency-backed typecheck/build, compiled bundle sizes and Worker Preview. React, router and Vite dependencies were not installed; attempted package installation did not complete.
- **NOT RUN:** installed iOS/Android standalone-PWA startup measurements, responsive widths, PWA update banner/old SW activation/cache cleanup, accessibility paint proof, deep-link navigations and Auth sign-in/out browser walkthroughs.
- **NOT RUN:** expired/refreshing Supabase tokens, revoked membership, tenant switching and live cloud stale-read races against an actual backend. Automated tests use fake storage and in-memory coordinator transport.
- **KNOWN LIMIT:** the network background refresh still reads all 18 tables (plus capability queries). This phase accelerates *perceived warm paint*, not total downloaded history bytes. Further history slicing would require a stricter partial-data contract to avoid inaccurate Overview/cleanliness and clobbered outbox projections.
- **KNOWN LIMIT:** first opening on the new version may not have a versioned snapshot; it takes the cold path. The app-side 16C rolling buffer does not replenish when the app remains closed.
- **KNOWN LIMIT:** offline membership is based on the last cached account-scoped catalog and an unexpired token, not a real-time revocation check. A shared/unlocked device can still access its existing browser profile; encryption at rest is not provided.

**Gate:** SOURCE/DOMAIN PASS, build/cloud/device performance BLOCKED. Not a production-certified PWA release.
