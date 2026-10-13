# Phase 19A/19B — Browser, PWA and Staging Acceptance

**Status:** NOT EXECUTED in a running browser or shared Supabase. Source tests only. Record screenshots, actual browser console, viewport size/device/OS, FPS and network bytes when executing.

## 19A — Home illustration and invariant checks

- [ ] Desktop Chromium, phone Safari, Android Chrome: confirmed layout defaults to Illustrated Mode. Turn it off/on; colors/names do not affect room hit targets.
- [ ] Edit Mode: no print/props over draggable edge/vertex/resize handles; after 5 move/resize and connection edits geometry persists exactly as before.
- [ ] Pan, zoom (0.75–2.5), fit and scene switching; illustration stays within polygon bounds and scales with the existing canvas.
- [ ] Start Room / Complete / Skip / Later / Undo: unchanged events, supply effects, notifications and labels.
- [ ] Empty/partial/unknown layouts, missing entity types, long EN and IT labels; no clipping on narrow 320px/mobile and 200% zoom.
- [ ] Overdue and due are labeled in text in each accessible room and remain readable with alternate/mono/night palettes.
- [ ] `document.body.dataset.v2NoArt='true'`: only semantic non-art canvas remains; original object icons are present.
- [ ] Reduced motion disabled decorative effects; keyboard focus and room selection accessible.
- [ ] Capture actual before/after full-app screenshots, DOM node/path counts, time-to-render, and touch performance (not available from Node proof).

## 19B — scene customization and sync

- [ ] Approved staging migration applied to staging (never shared production without express consent), RLS fixture loaded.
- [ ] A saves one prop; B (same household member) sees it after normal refresh/app reopen, no Realtime or polling.
- [ ] Outsider cannot select/write the scene data; direct client DML rejected.
- [ ] A/B conflicting CAS revision produces visible recoverable conflict with no silent overwrite.
- [ ] Do 150 slider changes, move by touch and keyboard: verify **zero RPCs during editing and one RPC after Save** via Network panel.
- [ ] Restart offline with unsynced Save; retry online; verify one durable revision and no double-save after lost acknowledgement.
- [ ] Reset to Auto stores an empty list/revision and does not resurrect old artwork after stale reply.
- [ ] Archive/delete/recover scene, missing anchor, deleted entity, workspace switch/logout; no cross-household reveal or stale local editor draft.
- [ ] V1 login/task edits/reset on safe disposable fixture; schema-11 export/local import; schema-9 and schema-10 Auto fallback.
- [ ] Cloud backup restore with saved scene data **refuses before deletion**, with clear message.
- [ ] Collect `pg_total_relation_size` table/index metrics (SQL shown in report), row count and PostgREST transfer bytes; compare with project Free-tier limits.

**Remaining blockers:** full dependency-backed build, real iOS/Android installed PWA, browser interaction/accessibility run, PostgreSQL/RLS staging verification and live storage measurements.
