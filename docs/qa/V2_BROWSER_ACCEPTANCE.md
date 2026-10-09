# House Care V2 — browser, device and visual acceptance

**Version:** 2.0.0-rc.1. **Status as packaged:** NOT EXECUTED against the running V2 app. Source/unit checks do not satisfy this sign-off. Fill in observed results, device/browser build, tester and screenshot references before promoting the release candidate.

## Repeatable environment

1. On a developer machine with network access run `npm install`, commit the generated `package-lock.json`, then `npm ci` and `npm run qa:release`.
2. Use `VITE_APP_MODE=local` with `npm run dev`; for upgrade tests, build and serve the **production** bundles rather than development mode.
3. Seed from `tests/fixtures/pre-v2-household-backup.json` using Settings → Backup → Import, or use the optional `tools/phase15-browser-capture.mjs` which seeds only an isolated browser context.
4. For browser captures optionally install Playwright: `npm install --no-save playwright`, `npx playwright install chromium`, then `V2_BASE_URL=http://localhost:5173 node tools/phase15-browser-capture.mjs`.
5. Use Android Chrome and iOS Safari as well as desktop Chromium/Firefox; use at least a 320 px narrow viewport, a normal phone (390×844), and large-text accessibility settings. Record network mode and locale per run.
6. Each row requires actual observation; a unit test, SVG proof, or static mockup **does not** close a browser row.

## Required interaction/E2E matrix

| ID | Scenario | Action and expected result | Observed | Evidence |
|---|---|---|---|---|
| E01 | House Menu | Open, traverse all 8 destinations, Escape/backdrop dismissal, Tab wrap, focus return, hardware back | NOT RUN | — |
| E02 | Active Deck Complete | Complete one real due occurrence; successful mutation advances deck; stamp follows success | NOT RUN | — |
| E03 | Undo | Undo completion; same occurrence reopens; no duplicate | NOT RUN | — |
| E04 | Reschedule | Change effective due time; canonical scheduled slot unchanged; updated Timeline placement | NOT RUN | — |
| E05 | Skip | Skip one occurrence; no cleanliness refresh; moves to Timeline | NOT RUN | — |
| E06 | Reassign | Change to member / Everyone / Unassigned; assignment and notification scope correctly reflected | NOT RUN | — |
| E07 | Linked child | Generated every-N child has own card/history, can finish separately; parent unaffected | NOT RUN | — |
| E08 | Timeline Restore | Restore completed/skipped/rescheduled item to today; original occurrence ID persists | NOT RUN | — |
| E09 | Home room mode | Select room, Start room, Done, Skip, Later, Undo; layout selection/edit still works | NOT RUN | — |
| E10 | Routine create/edit | All What/Where/When/Who/Reminder/Products/Refresh-to/Additional/advanced fields persist | NOT RUN | — |
| E11 | Stock | Quick status, quantity/edit/history, task-context report; offline-safe update | NOT RUN | — |
| E12 | Offline | Offline banner; stored local work usable; reconnect state correct | NOT RUN | — |
| E13 | App update | Existing installed PWA detects waiting SW; update banner → activate → reload | NOT RUN | — |
| E14 | Languages | Switch English/Italian, inspect forms, long labels, date formatting | NOT RUN | — |
| E15 | Reduced motion | Disable continuous animation and keep state understandable | NOT RUN | — |
| E16 | Large text | 200% text / browser zoom: no clipped controls or inaccessible tasks | NOT RUN | — |
| E17 | Narrow viewport | 320×640 and short-height phone: critical items, deck/actions, menu reachable | NOT RUN | — |

## Visual regression capture manifest

Captures must be **genuine running-app screenshots**, not authored SVGs or image-generator mockups. Save approved images in `docs/qa/screenshots/` and record viewport + locale + theme + data state for each.

| ID | Required state | Observed / approved |
|---|---|---|
| V01 | Overview — healthy Regular/Deep | NOT CAPTURED |
| V02 | Overview — overdue task front card | NOT CAPTURED |
| V03 | Overview — Deep task card | NOT CAPTURED |
| V04 | Overview — linked additional child | NOT CAPTURED |
| V05 | Overview — all handled / no due | NOT CAPTURED |
| V06 | Timeline — finished + upcoming + postponed | NOT CAPTURED |
| V07 | Home — normal selection | NOT CAPTURED |
| V08 | Home — edit mode, geometry handles | NOT CAPTURED |
| V09 | Home — room mode | NOT CAPTURED |
| V10 | Routines — library + builder | NOT CAPTURED |
| V11 | Actions — long custom action | NOT CAPTURED |
| V12 | Supplies — all four status expressions | NOT CAPTURED |
| V13 | Analysis — trend/outcome/history | NOT CAPTURED |
| V14 | Settings — theme preview | NOT CAPTURED |
| V15 | English and Italian | NOT CAPTURED |
| V16 | Retro, Fresh Sage, Night, Mono, Clear Spectrum, extreme custom | NOT CAPTURED |
| V17 | No-art, reduced-motion, large text, narrow viewport | NOT CAPTURED |

## Performance and accessibility gates

- Use Chrome DevTools and a low/midrange Android phone for long-task-list and deck interaction: observe frames, layout shifts, memory, paint/composite cost and interaction latency. Record measurements (not Node CPU proxies).
- Confirm only the foremost active Care Card renders full SVG, rear layers are CSS, Timeline thumbnails are compact, SVG IDs do not collide and no turbulence runs per card.
- Confirm task priority/due, stock status and cleanliness remain legible with art disabled and without color, including at 200% text.
- Verify all dialogs have meaningful names; focus stays inside and returns to trigger; destructive confirmations remain reachable by keyboard; touch targets are at least approximately 44×44 CSS px.
- Verify EN/IT date/time text and arbitrary long custom labels wrap without overlap or horizontal clipping.

## Installation, data and push acceptance

| Gate | Expected | Observed |
|---|---|---|
| I01 | New local-only household creates and runs in V2 | NOT RUN |
| I02 | Pre-V2 JSON import preserves routines, occurrences, events, layouts, products, people | NOT RUN |
| I03 | Legacy custom theme remains selected and its values unchanged | NOT RUN |
| I04 | Existing cloud workspace logs in and syncs without migration | NOT RUN |
| I05 | Android standard/maskable icons on light/dark launcher | NOT RUN |
| I06 | iOS Apple touch icon; installed-app launch | NOT RUN |
| I07 | V1 worker → V2 worker, cache cleanup, offline reload | NOT RUN |
| I08 | Real push delivery and `/task/:taskId` deep link | NOT RUN |
| I09 | Offline editing/sync-conflict recovery | NOT RUN |

## Sign-off

Release candidate build commit: __________

Tester / device / OS / browser: __________

Last run and evidence folder: __________

Blocking issues and retest results: __________

Final product/engineering/accessibility approval: **PENDING**
