# Phase 16D browser and installed-PWA acceptance checklist

All items **NOT RUN** in the current environment unless specifically labeled simulated. Record screenshots, performance trace filename, OS/browser version, auth state and exact result per test.

- [ ] Cold first login; cleared browser storage; valid/expired token, unexpected auth error. Private data must stay hidden until membership is verified.
- [ ] Warm browser restart on confirmed account, normal and constrained network. Inspect timeline `auth-ready`, `catalog-ready`, `snapshot-hydrated`, `overview-paint`, `tables-start/end` and `boot-exit`. Record median/p95 over five runs; target <1s to first usable Overview if feasible.
- [ ] Warm installed PWA reopen, iOS and Android at 360/375/390/430px where available; collect stand-alone timing, safe area and no-overlap screenshots. Verify app gestures remain responsive while cloud fetch is pending.
- [ ] Offline PWA reopen with valid cached token/catalog/snapshot; display cached-home warning; queue edit, restart offline, return online, wait for 16A reconciliation.
- [ ] Offline token expired, deleted local cache, incompatible cache version, malformed snapshot. Never show old private Overview or another account's household.
- [ ] Change cloud member access while device is offline, then reconnect. The app must surface revoked membership, hide cached content and not reapply unauthorized mutations.
- [ ] Two users alternate sign-in on one browser. Sign-out clears private cache and catalog; old user's scoped durable queue is not replayed under a new account.
- [ ] Rapid household A → B → A while 18-table fetch/pending mutation in flight. No stale A/B cross-display or outbox leakage.
- [ ] Edit A, edit B while cloud read is delayed. Both remain after refresh/reload. Complete + Undo + Stock action remain ordered and idempotent.
- [ ] Test old worker → rc.2 update notice, activation, navigation cache cleanup, offline cached reopen; no stuck preboot.
- [ ] Visit deep link `/task/:id`, Timeline, Home room mode, Routines, Supplies, Actions, Analysis and Settings; verify code-split module loading/error fallback does not lose the destination.
- [ ] Check EN/IT rotating phrases, no-art/reduced-motion, large text and screen-reader loading status; Exit motion disabled when reduced-motion is on.
- [ ] Import/restore backup with pending outbox: remains exclusive, no snapshot reappears after restore; validate backups and notifications.
- [ ] Capture full cold/warm browser+PWA Waterfall including auth, membership, 18 table fetch and capability calls, HTTP bytes, first Overview paint and boot exit. Contrast against the same environment running Phase 16C.

Source-only checks: `npm test`, `npm run qa:static`, `npm run qa:syntax`; see evidence logs. No browser or cloud tests were executed.
