# Phase 17B — Real browser / installed PWA acceptance matrix

**Status of the supplied execution:** BLOCKED for all real-app checks — React/Vite dependencies and the Playwright package are absent; npm registry DNS failed. Do not interpret the static/pure test PASS as browser/PWA sign-off.

To run on a connected machine (local-only; do not configure production):

```bash
npm install
npm run qa:release
npm install --no-save playwright
npx playwright install chromium
npm run dev -- --host 127.0.0.1
# separate terminal, at repository root:
V2_BASE_URL=http://127.0.0.1:5173 node tools/phase17b-browser-acceptance.mjs
```

Runner writes **real app screenshots**, sampled Chromium `requestAnimationFrame` intervals, JS heap (when available), user agent, dimensions and PASS/FAIL into `docs/qa/phase17b-evidence/browser`. No mockup screenshot is an acceptance substitute. A Chromium mobile context is emulation, not a physical device.

| Check | Required expected behavior | Evidence / status |
|---|---|---|
| Touch swipe left and right, phone portrait | Front follows finger, rear reacts, next/previous selected once, no accidental action | Automated runner prepared; NOT RUN |
| Desktop pointer left/right and cancel | Mouse drag browses; cancelled drag returns; no browser text selection | Runner prepared + manual cancel; NOT RUN |
| Velocity variation | Fast short horizontal flick navigates; slow short drag returns; momentum direction matches release | Pure thresholds PASS; browser NOT RUN |
| Rapid consecutive swipes | New swipe can interrupt returning/incoming; outgoing stays single; never skips multiple cards per release | Runner prepared; NOT RUN |
| Scroll and interactive controls | Vertical card details scroll; More, supplies +N, Complete, Sheet controls respond normally; horizontal swipe never triggers them | Manual/runner; NOT RUN |
| No task mutation / network | Card ID changes only, no task status/event writes or confirmation/Undo from swipe | Static source PASS; browser request and dialog checks NOT RUN |
| Refresh / reorder / Undo while dragging | Same ID retained on reorder; removal chooses adjacent card, no stale animation; task links stay valid | Pure ID selection PASS; real refresh NOT RUN |
| Extra Care integration | Due extra remains appendix inside primary Card, no independent extra completion | Existing domain PASS; UI NOT RUN |
| Reduced motion | CSS front transform suppressed; gesture browsing instant; no decorative spring | Static contract PASS; real settings NOT RUN |
| Keyboard / focus / EN and IT | Focus stage, Left/Right change cards, buttons have accessible names, screen-reader instructions, focus remains reachable | Source/i18n PASS; browser/screen reader NOT RUN |
| Tiny / narrow / tall viewport | House State + deck visible on common phone; fallback scroll for short/zoom/large text; actions not cropped | Phase 17A source retained; screenshot/device NOT RUN |
| iOS Safari installed PWA | Touch capture/scroll, keyboard, safe areas, app switch/resume, update from rc.3 to rc.4 | NOT RUN (physical device) |
| Android Chrome installed PWA | Gestures, 60/90/120Hz smoothness, memory, keyboard/AT alternative, back/forward deep link | NOT RUN (physical device) |
| Mobile performance, low-power CPU | Collect actual gesture p50/p95 frame interval and JS heap, repeat for 3/30/100 tasks, check no full SVGs behind card | Runner instrumentation prepared; NOT RUN |
| Realtime/network restrictions | No Supabase Realtime, polling loop or server writes during a gesture | Source changes inspected; device/cloud traffic NOT RUN |

**Manual follow-up:** Verify pointercancel from native scroll, incoming interrupted by a quick second gesture, fast swipe over text while sheet is closed, long English/Italian labels, touch targets, task completion/Undo after browsing, stock-sheet focus return, device accessibility zoom and reduced-motion settings. Capture separate installed-PWA and mobile-browser screenshots and measurements before release sign-off.
