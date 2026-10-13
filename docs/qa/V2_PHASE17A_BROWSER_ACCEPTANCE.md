# Phase 17A — real browser + installed-PWA acceptance

**Current state: NOT RUN.** The dependency-backed Vite app is unavailable in the isolated artifact environment. Chromium command-line smoke timed out even on `about:blank`; it did **not** produce usable screenshots or measurements. `docs/qa/phase17a-evidence/layout-fixture.html` is an isolated CSS harness only, **not** a screenshot of the running application.

## Repeatable browser capture

On a connected development machine, install the repository dependencies and Playwright, run `npm run build && npm run preview -- --host 127.0.0.1`, and in a second shell run `V2_BASE_URL=http://127.0.0.1:4173 node tools/phase17a-browser-acceptance.mjs`. The script seeds local-only test tasks, takes actual app screenshots, and writes `metrics.json` for 390×844, 375×812, 360×740, 320×640, 430×932, and 768×1024 in EN/IT. It checks horizontal overflow, visible action position, absence of House Menu overlap, standard-phone page scrolling, six-supply expansion, modal focus and Escape.

This browser runner is deliberately optional (requires a separately installed Playwright). Running a headless desktop Chromium viewport is **not** equivalent to installing the PWA on iOS or Android.

## Manual acceptance matrix — all unchecked

- [ ] iPhone Safari 375×812, 390×844, 430×932: address bar expanded/collapsed, safe area, home-screen standalone. Capture actual usable visual viewport and `getBoundingClientRect` for header, House State, Deck, Complete, More and House Menu.
- [ ] Android Chrome 360×740 and 390×844: browser and installed standalone, top/bottom system bar, PWA update. House State + Deck fit without page scroll on standard screens where content is normal; Complete/More never hidden or overlapped.
- [ ] 320×640, landscape, low height and split-screen: page-level scrolling permitted; no unreachable controls, no horizontal clipping. Desktop/tablet at 768×1024 and 1024×768.
- [ ] Dynamic keyboard/VisualViewport resize and pinch zoom: responsive fallback uses page scrolling; no jumps leaving actions inaccessible; header measured rather than assumed to be 58 px.
- [ ] Large font (200%), OS text magnification, EN and IT long room/routine names: no clipped actions and no trapped keyboard focus; scrollable card content is keyboard reachable.
- [ ] No tasks, overdue task, due now, later today, Deep and Regular cards, 1–3 critical items, many critical items, long critical names; House Menu, scope switch and Undo banner.
- [ ] Required supplies counts 0/1/4/5/8; correct severity Out → Reserve only → Low → Available; missing stock shown as unavailable, not Available.
- [ ] Main + due Extra Care share supplies: exact one chip per supply ID; no phantom postponed/completed Extra. Inventory quantity 0, positive quantities, missing quantities and units in full sheet.
- [ ] Open `+N` on touch, mouse and keyboard; focus trapped within sheet, Escape/backdrop/close, focus returns to `+N`, all stocks and current on-hand quantities fully readable.
- [ ] Check external scroll, screen reader names, accessible pressed/focus states, reduced-motion, dark palette, alternative themes and no-art testing mode.
- [ ] Complete → Undo, reassign/reschedule/skip through More, update stock in task sheet, timeline/history and notifications still work; no data engine or task-lifecycle changes.
- [ ] Test old installed PWA worker → `v2.0.0-rc.3` update notice/cache cleanup; offline standalone and deep-link reopen.

## Recorded here

Pure-domain / source regression and static audit pass; real browser/PWA captures are **not available**. Do not mark any checkbox passed based on the CSS fixture or source inspection.
