# House Care v2.0.0-rc.1 — Release candidate notes

**Status: candidate only. NOT production-certified.** The pure regression suite is passing. The dependency-backed frontend build and live browser/device/PWA/cloud checks must pass before publishing a final V2 release.

## What changes for users

- A single floating **House Menu** replaces persistent bottom tabs and keeps all eight destinations reachable.
- Overview becomes a viewport-first **House State + Active Deck** cockpit. Home Regular/Deep cleanliness and critical entities remain separate from actionable Care Cards.
- **Timeline** receives finished/skipped/rescheduled work, future day browsing and Restore to today.
- Actions, Routines, Home, Supplies, Analysis, Settings, auth/setup and branded boot now share the V2 retro-vector language.
- Care Cards use locally generated deterministic SVG compositions from reusable authored household objects, faces, gestures and halftone patterns. Repeated routine editions stay recognizable; unknown activity names have a branded fallback.
- Semantic appearance presets remain customizable and saved theme values are unchanged; artwork inks adapt for contrast.
- New launcher, maskable, Apple touch and favicon assets match the V2 mark.

## Compatibility and intentional non-changes

- Recurrence, canonical triggers, occurrence identity, linked every-N child independence, assignments, reminders, Refresh-to, Stock, room mode, cleanliness and history semantics **do not change**.
- Existing `/today`, `/insights` and `/task/:taskId` routes remain supported.
- No new Supabase migration, card-ownership system, card-game mechanics, XP, streaks or persisted image/recipe data.
- V1.2.1-era backups (including pre-V2 schema 9) remain importable and are tested with an actual historical fixture. New backups record this release-candidate application version.

## Technical hardening in Phase 15

- Canonical candidate version set to `2.0.0-rc.1` across package, README, service worker, manifest, HTML icon URLs and backup exports.
- Orphan V1 Today page, mask-only illustration wrapper/manifest and unused V1 art removed; inactive legacy selectors pruned; root-token generations consolidated under `src/styles/tokens.css`.
- New release-level offline static checks and service-worker/backup upgrade simulation.
- Release-gate commands: `npm run qa:static`, `npm test`, `npm run typecheck`, `npm run build` or `npm run qa:release`.
- Browser/device screenshots and real interaction sign-offs are explicitly tracked in `docs/qa/V2_BROWSER_ACCEPTANCE.md`.

## Known open gates

1. npm registry unavailable in the packaging environment, so dependency installation, lockfile creation, React/Vite typecheck and production build have **not** been verified.
2. Real mobile/desktop browser UI, accessibility, performance and screenshots remain unverified; Node SVG timings are not a browser benchmark.
3. V1→V2 installed-PWA upgrade, real notification click/push, offline sync, cloud-mode integration and icon appearance on actual devices remain unverified. The service worker has only been simulated offline.
4. A final sign-off and release version promotion (for example `2.0.0`) must follow, not precede, those checks.

**Deployment recommendation: NO-GO for final production release until the open gates close.**
