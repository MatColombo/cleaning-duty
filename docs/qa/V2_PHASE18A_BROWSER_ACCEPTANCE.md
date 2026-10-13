# Phase 18A — Browser and PWA acceptance matrix

**Status:** All live browser/PWA tests **NOT RUN** in this handoff. The dependency-backed build is blocked by unavailable project React/Vite packages. Static proof HTML/SVG is not a real app screenshot. This checklist must be executed on a dependency-complete environment with sample local-mode data.

1. Open Routines > any existing card > Character Studio, Actions > any card > Character Studio, and Home > select entity > Character Studio. The modal title matches the selected subject. Newly created entities not yet committed are not required to have a Studio entry in 18A.
2. On each entry, confirm `Artwork: Auto`, stable original art, and the explicit EN/IT nonpersistent notice. Capture actual editor screenshots at 320x568, 375x667, 390x844, 430x932, 768x1024 and landscape; check scroll reaches final Close button without clipping.
3. Change each built-in object, expression, eyes, brows, mouth, pose, hand, scale/proportion, props, scene, palette and motion preset. Verify immediate repeatable preview and no thrown errors. Check 48/96/240px recognition, thumb gesture and unknown/arbitrary non-Latin name fallback.
4. Change multiple values > Undo steps > Reset to Auto > Undo. Auto must visually equal original and restore after a close/reopen, refresh or household switch. Reopen always starts fresh Auto; no saved selection persists.
5. Use keyboard Tab/Shift+Tab, arrows on range/selects, Escape and sheet Close. Focus stays trapped in sheet while open and returns to opening button after close. Verify VoiceOver/TalkBack labels and no art-only domain information.
6. Switch app EN/IT and preview light/night; validate labels, focus, selected color contrast and long Italian strings. Test custom high/low-contrast themes outside the Studio, confirming no palette markup injection.
7. Enable `prefers-reduced-motion`. All hero-preview CSS animations are disabled; repeat on phone with reduced-motion system preference. Animations do not repeat indefinitely, and no task-card actions are triggered by editing art.
8. Open the browser Network tab, filter Supabase/HTTP requests, interact with all Studio inputs and close. **Expected: zero new art-related writes, uploads, or image services.** Compare to baseline automatic application activity. Check localStorage/IndexedDB and backup output for absence of `StudioOverrides` or new persistence keys.
9. Check routine creation/editing, task completion, Undo, stock updates, notifications, linked Extra Care and recurrence after visiting Studio; no domain changes. Test logout/switch-household while the Studio is open and ensure no draft leak.
10. Repeat desktop browser, mobile browser and installed iOS/Android PWA where devices are available. Capture real screenshots, screen-reader notes, frame timings and any known limitations before acceptance.

### Reproduction on a network-connected developer machine

```bash
npm ci
npm run qa:release
npm run dev -- --host 127.0.0.1
# use browser devtools to run the manual matrix above
```

Do not use production Supabase credentials or execute pending Phase 16A–16C migrations for 18A validation. Use safe local-mode fixtures.
