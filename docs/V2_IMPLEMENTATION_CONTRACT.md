# House Care V2 — Product, Navigation and Route Contract

**Status:** Frozen for V2 implementation  
**Phase:** 1 — Product and route contract  
**Scope:** UI structure, navigation ownership, route compatibility, Care Card information hierarchy, responsive/accessibility behavior  
**Out of scope:** V2 visual implementation, page redesign, procedural SVG implementation, domain/backend changes

---

## 1. Purpose

This document is the authoritative V2 contract for **where House Care features live and how users reach them**.

It sits between the existing application behavior and the V2 visual/design-system work. Later implementation phases may change presentation, components and styling, but they must not silently change the responsibilities frozen here.

The V2 design principle is:

> **Configuration may remain powerful; daily operation must remain immediate.**

The V2 shell therefore removes persistent seven-destination bottom navigation and makes the default Overview a deliberately narrow daily surface.

This contract does **not** redefine recurrence, task lifecycle, cleanliness, assignment, Stock, linked activities, persistence, sync, backup, notification, Home-layout or room-mode semantics.

---

# 2. V2 shell contract

## 2.1 Persistent shell

Every authenticated household page uses the same V2 application shell.

The shell contains:

1. a **compact branded header**;
2. the existing **workspace/household switcher**;
3. existing save/sync/runtime state where relevant;
4. runtime banners when needed;
5. one persistent **House Menu** control;
6. the active page content.

There is **no persistent bottom navigation** at any breakpoint.

## 2.2 Compact branded header

The authenticated header owns:

- House Care compact brand mark / wordmark;
- current workspace identity and workspace switching;
- saving / pending-sync state when relevant;
- any compact account/member affordance that is needed by the final shell.

The header is not a substitute for the page title. Individual pages may still have their own content heading.

Workspace switching is **not** a House Menu destination.

## 2.3 Runtime indicators that must survive

V2 must preserve the current functional shell behaviors:

- offline banner;
- sync-conflict banner;
- application-error banner;
- service-worker update-ready banner;
- saving state;
- pending-sync count/state;
- app-badge count behavior;
- push-subscription synchronization.

These may be visually quieter in V2 but must not be removed.

## 2.4 House Menu

The House Menu is the single persistent navigation affordance replacing the bottom navigation.

Recommended order is frozen as:

1. **Overview**
2. **Timeline**
3. **Home**
4. **Routines**
5. **Actions**
6. **Supplies**
7. **Analysis**
8. **Settings**

Behavior:

- on narrow/touch layouts it opens as an accessible sheet or equivalent mobile menu;
- on wider layouts it may become a popover/panel;
- the active destination must be identifiable;
- it must be keyboard accessible;
- focus must be managed correctly when opened/closed;
- it must respect safe areas;
- opening the menu must not destroy the current page state.

The House Menu is navigation only. It is not a second dashboard.

---

# 3. Canonical V2 routes

The following routes are canonical in V2:

| Route | Destination | Responsibility |
|---|---|---|
| `/` | Overview | House State + current actionable work |
| `/timeline` | Timeline | handled-today and near-future operational chronology |
| `/home` | Home | spatial home cockpit, selection, room mode and Home editing |
| `/routines` | Routines | recurring maintenance rules and routine builder |
| `/actions` | Actions | reusable work/action definitions |
| `/supplies` | Supplies | Stock/supply state and history |
| `/analysis` | Analysis | analytical summaries, trends and historical analysis |
| `/settings` | Settings | household/app/account configuration |

Canonical routes are what V2 navigation should generate.

---

# 4. Compatibility routes and deep links

V2 must not break existing bookmarks, notification links or internal historical links.

## 4.1 `/today`

Compatibility behavior:

```text
/today -> /
```

Use a replace redirect.

`/today` is not shown in V2 navigation.

## 4.2 `/insights`

Current V1 navigation uses `/insights` for the Analysis page.

V2 canonicalizes Analysis at:

```text
/analysis
```

Compatibility behavior:

```text
/insights -> /analysis
```

Use a replace redirect so new links settle on the canonical V2 route.

## 4.3 `/task/:taskId`

`/task/:taskId` remains a stable deep-link entry point because push notifications and Analysis/history links already target exact task occurrences.

It is a **resolver route**, not a separate primary page.

The route must resolve the occurrence using the same canonical occurrence/lifecycle reconciliation used by operational views.

### Active task resolution

If the exact occurrence is scheduled and operationally belongs to:

- overdue;
- due now/today;
- later today;

then the deep link resolves to **Overview** and:

- selects/focuses that exact occurrence;
- brings it to the active/front Care Card context where practical;
- opens task details when direct focus cannot safely reorder the deck.

The task must never be replaced by routine metadata or a generated pseudo-task.

### Future task resolution

If the exact occurrence is scheduled in the future, the deep link resolves to **Timeline** and:

- opens the exact task detail;
- selects its date when that date is inside the normal Timeline window;
- still permits exact detail access if the task date lies outside the normal seven-day browsing window.

A deep-linked future task must not disappear merely because it is outside the default Timeline range.

### Handled/postponed task resolution

If the exact occurrence is:

- completed today;
- skipped today;
- postponed away from today;

then the deep link resolves to **Timeline** and opens the exact task detail, including Restore to today when current lifecycle rules allow it.

### Linked child occurrence

A linked/additional child occurrence is resolved according to its **own** state and effective due time.

It remains an independent occurrence even when the parent is also visible.

### Missing/cancelled occurrence

If a task ID is unavailable or no longer actionable:

- do not manufacture a replacement occurrence;
- do not silently open an unrelated routine;
- show a small non-blocking unavailable/not-found state and provide a safe route back to Overview or Timeline.

### Push compatibility

Push payloads may continue to use:

```text
/task/<taskId>
```

The V2 client route resolver owns placement of the task in Overview versus Timeline.

## 4.4 Existing query-style deep links

The following current/internal links are part of the V2 compatibility contract:

### Home entity focus

```text
/home?item=<entityId>
```

V2 Home must consume this query and focus/select the requested semantic entity or its visual placement where possible.

If the entity exists but has no active placement, Home should still expose its semantic detail without inventing geometry.

**Current implementation note:** V1 Overview already emits this URL from critical-entity cards, but the current `HomePage` does not consume the query parameter. V2 must close this navigation gap.

### Settings error diagnostics

```text
/settings?errors=1
```

This continues to open/focus the error-log surface.

## 4.5 Unknown routes

Unknown application routes fall back safely to Overview:

```text
* -> /
```

This must not interfere with valid compatibility/deep-link resolution.

---

# 5. Primary page ownership

This section is authoritative for which top-level page owns each feature.

## 5.1 Overview

Overview is the default daily operational cockpit.

It contains exactly two primary content zones under normal operation:

1. **House State**
2. **Active Deck**

Overview does **not** become a general history, calendar or configuration surface.

## 5.2 Timeline

Timeline owns secondary operational chronology:

- handled work from today;
- skipped work from today;
- work postponed away from today;
- upcoming work for the next seven calendar days;
- day/date browsing for that operational window;
- Restore to today;
- future-task detail;
- relevant reschedule/reassign/detail operations.

Timeline is **not** a full calendar product and is **not** the long-term analytics/history product.

## 5.3 Home

Home continues to own:

- graphical/spatial Home view;
- scene switching;
- Home-level Regular/Deep cleanliness;
- entity/room selection and details;
- current tasks resolved against selected entity/subtree;
- supply alerts for selected entities;
- Start room / room mode;
- Home structure editing;
- entity types;
- semantic entities;
- visual placements/layout elements;
- scenes;
- relations/connections;
- pan/zoom/fit/edit interactions.

V2 visual work must not turn graphical layout placement into the source of semantic truth.

## 5.4 Routines

Routines continues to own:

- routine list;
- add/edit routine;
- pause/resume;
- end routine;
- archive;
- Action selection;
- Regular/Deep channel;
- activity title;
- Counts toward cleanliness;
- target selection;
- advanced dynamic targeting;
- fixed-calendar recurrence;
- after-completion recurrence;
- exceptions;
- assignment;
- advanced assignment;
- reminder policy;
- products;
- Refresh to;
- configured every-N additional activities.

Configured additional activities are visible here as configuration even when no child occurrence currently exists.

## 5.5 Actions

Actions continues to own reusable work definitions:

- create Action;
- edit Action;
- instructions;
- icon;
- default supplies;
- custom metadata;
- archive rules/restrictions.

Actions are not task occurrences and must not be presented as due work.

## 5.6 Supplies

Supplies continues to own Stock:

- create supply;
- edit supply;
- qualitative status;
- optional quantity/unit;
- quick state updates;
- Stock history;
- archive restrictions.

Task-context Stock reporting remains available from operational task details as well.

## 5.7 Analysis

Analysis owns descriptive/historical analysis rather than daily task execution:

- 7/30/90 period selector;
- today outcome summary;
- Regular cleanliness trend;
- Deep cleanliness trend;
- activity outcomes;
- historical event timeline/details.

Analysis may deep-link exact occurrences through `/task/:taskId`.

Analysis does not replace Timeline.

## 5.8 Settings

Settings continues to own:

- household/workspace settings;
- people;
- assignment profiles;
- custom fields/metadata definitions;
- Overview preferences such as critical threshold/count;
- appearance/themes;
- language;
- notifications/device setup;
- PWA install guidance;
- backup/export/import;
- error log/diagnostics;
- runtime-mode/account actions such as cloud sign-out/local reset where currently supported.

---

# 6. Overview contract

## 6.1 Overview objective

Overview answers only two questions:

1. **How is the house doing?**
2. **What should I do now?**

Everything on the page must support one of those questions.

## 6.2 House State

House State contains:

### Home condition

- Regular home cleanliness;
- Deep home cleanliness;
- `Not tracked` where the canonical engine has no eligible contributors.

These values use the existing canonical cleanliness engine.

They are not task-count, completion-rate or gamification scores.

### Critical entities

House State includes the current most-critical entities using existing critical-selection semantics:

- configured critical threshold;
- configured count;
- merged entity treatment where both Regular and Deep are critical;
- due/overdue context;
- navigation into Home.

The standard phone presentation should prioritize approximately the top three entities, while still respecting the configured count through a compact/horizontal treatment when more are configured.

Critical entities never become duplicate pseudo-tasks.

### Work scope

When multiple active household members exist, Overview exposes:

- **My tasks**;
- **Household tasks**.

This control affects task occurrence projections, especially Active Deck.

It does **not** change:

- Regular home cleanliness;
- Deep home cleanliness;
- physical cleanliness state;
- critical-entity cleanliness calculations.

The UI must not imply that changing assignee scope changes the house's physical condition.

## 6.3 Active Deck

Active Deck contains actionable scheduled occurrences from the existing operational groups:

```text
overdue
+ dueNow
+ laterToday
```

Existing ordering remains authoritative:

- oldest/earliest overdue first;
- due-now items by effective due time;
- later-today items by effective due time.

V2 may visually stack/fan cards, but the deck is a projection of real occurrences, not a new task model.

### Excluded from Active Deck

Do not show as normal deck cards:

- completed occurrences;
- skipped occurrences;
- items postponed away from today;
- future occurrences after today;
- cancelled occurrences;
- routine configuration that did not generate an occurrence.

Those belong elsewhere according to this contract.

## 6.4 Overview content removed in V2

The following V1 sections leave Overview:

- Finished;
- Upcoming;
- seven-day day rail;
- future-day selection/browsing.

They move to Timeline before the old Overview implementation is removed.

---

# 7. Timeline contract

## 7.1 Timeline objective

Timeline answers:

> **What did we handle today, and what is coming next?**

It is an operational chronology, not an analytics dashboard.

## 7.2 Handled today

Timeline owns the current `finished` projection semantics, including:

- completed today;
- skipped today;
- scheduled tasks postponed away from today through a workflow event today.

Preserve authoritative lifecycle reconciliation.

A reopened occurrence is not treated as finished.

## 7.3 Postponed-away behavior

Preserve the current mutual-exclusion behavior.

A task postponed away from today and represented as handled today is not duplicated again in the standard Upcoming projection for the same Timeline view.

Restore to today reopens/reuses the existing occurrence.

It must not create a replacement occurrence.

## 7.4 Upcoming

Timeline shows scheduled actionable work for the next seven calendar days in the household timezone.

Default browsing remains a seven-day operational preview.

Timeline is not a month/week calendar product.

## 7.5 Day/date browsing

Users can select a date inside the seven-day operational window and inspect that day's work.

The UI may use:

- horizontal day cards;
- compact date tabs;
- another accessible equivalent.

The interaction must not require a horizontal gesture without visible/keyboard alternatives.

## 7.6 Task operations in Timeline

Timeline must support exact task detail.

Where valid for the occurrence, task details may expose existing operations such as:

- reschedule;
- reassign;
- Restore to today;
- Stock reporting;
- target completion where applicable;
- linked-child controls;
- history/detail.

Timeline must call existing mutation services.

It does not get its own mutation implementation.

## 7.7 Timeline and task scope

When task scope is exposed in Timeline it must use the same semantics as Overview:

- My tasks;
- Household tasks.

Cleanliness remains independent of viewer/task scope.

Whether the scope control is persisted between Overview and Timeline is an implementation preference, not a business rule; both surfaces must default consistently to the current-member scope when a current member exists.

---

# 8. Care Card contract

## 8.1 Purpose

A Care Card is the V2 operational presentation of one real task occurrence.

It is not:

- a new database entity;
- a replacement for TaskOccurrence;
- a routine definition;
- a gamified score object;
- an owned/tradable object in V2.

## 8.2 Information hierarchy

Every full active Care Card follows this priority order.

### 1. Activity title

Primary label.

Use the occurrence/routine-facing activity title.

Fallback to the Action name only when the activity title is absent.

### 2. Target / Action

Secondary operational context.

Conceptually:

```text
Target(s) · Action
```

For multi-target work, preserve access to the complete target list. The compact card may summarize when required by width, but must not misrepresent the targets.

### 3. Due / overdue state

Must clearly communicate:

- overdue duration/date where relevant;
- due-now/today state;
- later-today time.

This information must not be conveyed through color/artwork alone.

### 4. Assignment

Show one of:

- member;
- Everyone/household;
- Unassigned/anyone.

Everyone and Unassigned remain semantically distinct.

### 5. Relevant cleanliness context

Show cleanliness only where it helps the user understand the task/target state.

Examples:

- Regular score;
- Deep score;
- target/entity condition.

Do not invent an occurrence-based cleanliness score.

### 6. Stock warning

If required products need attention, surface the important current Stock state.

The card may prioritize the most severe warning, while full task detail preserves complete product access.

### 7. Triggered linked activity

Show a linked/additional activity only when an actual child occurrence exists for this parent occurrence.

Presentation may use V2 language such as:

- Extra Care;
- side-quest-style visual treatment.

This is presentation only.

The child remains a real, independently actionable occurrence.

### 8. Complete

Primary action for an actionable occurrence.

Existing confirmation, mutation, cleanliness and Undo semantics remain authoritative.

### 9. Reschedule

Visible secondary action.

Reschedule changes execution time only and does not change the theoretical cadence/cleanliness trajectory.

### 10. More

More opens task details/secondary actions rather than duplicating the Reschedule control.

## 8.3 More/task detail contents

The detail surface remains the home for lower-frequency or verbose controls such as:

- full task details;
- complete target for multi-target tasks;
- required Stock details/reporting;
- reassign;
- skip;
- Restore to today where applicable;
- history;
- explanation/why-this-task information;
- triggered linked-activity controls.

## 8.4 Linked child interaction

Parent and child remain independent.

Completing, skipping or rescheduling the parent must not automatically perform the same action on the linked child.

If the child is actionable while its parent is not in the same projection, the child may appear standalone so work never disappears.

## 8.5 Artwork priority

Care Card artwork is always subordinate to operational information.

Rules:

- hiding artwork must not make the task unusable;
- artwork must not replace title, due state, assignment or actions;
- operational text remains real accessible text;
- decorative SVG art should normally be hidden from assistive technology;
- visual rarity/variation does not alter task priority or task semantics.

---

# 9. Responsive contract

## 9.1 Standard phone target

The default phone layout is portrait-oriented and viewport-first.

At ordinary phone sizes and default/normal text scale:

- House State is visible in the upper zone;
- Active Deck is visible in the lower zone;
- the primary daily interaction should not require scrolling through a long dashboard stack;
- House Menu remains reachable without a bottom navigation bar.

A reference target is approximately modern phone CSS viewports in the range of 360–430 px wide with typical contemporary heights. This is a design target, not a hard minimum-height assumption.

## 9.2 Small-height devices and accessibility text

Do **not** enforce a fixed-height Overview that clips content.

When any of the following make the standard composition unsafe:

- short viewport;
- browser UI reducing available height;
- large system/font scaling;
- long translated labels;
- long user-entered titles;

then Overview may vertically overflow/scroll.

Priority is:

1. readable information;
2. reachable actions;
3. preserved logical order;
4. visual composition.

Never reverse that priority.

## 9.3 Narrow width

At narrow widths:

- action controls may stack/wrap;
- metadata may move to additional rows;
- artwork may shrink or simplify;
- nonessential decoration may disappear;
- critical entities may use horizontal internal scrolling;
- page-level horizontal overflow is not allowed.

## 9.4 Wider screens

On tablets/desktop widths, V2 may place House State and Active Deck side by side or use a broader two-zone composition.

The logical reading/focus order remains:

1. House State;
2. Active Deck.

Do not add extra primary dashboard zones merely because more width is available.

## 9.5 Deck interaction

Only the front/current card needs full controls.

Rear cards may show reduced metadata/artwork to communicate stack depth.

If drag/swipe is supported:

- it is optional enhancement only;
- equivalent visible/keyboard controls are required;
- it must respect reduced motion.

Swipe must never be the sole method for completing, selecting or navigating work.

---

# 10. Accessibility contract

V2 presentation must preserve or improve current accessibility behavior.

Required:

- keyboard-accessible House Menu;
- focus trapping/return for modal sheets;
- semantic labels for icon-only controls;
- due/overdue status not communicated by color alone;
- cleanliness values represented as text/percentage or `Not tracked`;
- decorative SVG art not used as the sole state indicator;
- `prefers-reduced-motion` support;
- touch-friendly targets;
- no content clipping at large text sizes;
- logical DOM/focus order matching House State then Active Deck;
- localized English/Italian labels allowed to expand rather than being truncated into ambiguity.

---

# 11. Feature reachability matrix

| Existing feature | V2 primary access |
|---|---|
| Today's actionable work | Overview → Active Deck |
| Home Regular/Deep state | Overview → House State; Home |
| Critical entities | Overview → House State |
| Open critical entity spatially | Overview → critical entity → `/home?item=<id>` |
| Complete | Overview Care Card / task detail / Home room mode |
| Skip | Care Card More/task detail / Home room mode |
| Reschedule | Care Card / Timeline/task detail |
| Reassign | Care Card More/task detail / Timeline detail |
| Complete target | Task detail |
| Report Stock while cleaning | Task detail |
| Triggered additional child | Care Card appendix/detail; Home; Timeline where projected |
| Finished today | Timeline |
| Skipped today | Timeline |
| Postponed away from today | Timeline |
| Restore to today | Timeline/task detail |
| Upcoming seven days | Timeline |
| Day browsing | Timeline |
| Spatial layout | Home |
| Room mode | Home |
| Edit entities/types/layout/relations | Home edit/configuration |
| Action library | Actions |
| Routine list | Routines |
| Routine builder | Routines |
| Additional-activity configuration | Routines |
| Stock catalog/history | Supplies |
| Historical trends/outcomes | Analysis |
| Historical event timeline | Analysis |
| Household/workspace configuration | Settings |
| People/assignment profiles | Settings |
| Custom fields | Settings |
| Overview critical preferences | Settings |
| Themes/appearance | Settings |
| Language | Settings |
| Notifications | Settings |
| Install PWA | Settings |
| Backup/import | Settings |
| Error log | Settings / `/settings?errors=1` |
| Workspace switching | Persistent V2 header |
| Offline/sync/update/errors | Persistent shell/runtime banners |

---

# 12. Explicit V2 exclusions

The following are **not** part of this V2 contract:

- trading Care Cards;
- Care Card ownership/economy;
- household barter marketplace;
- in-app card game;
- XP;
- streak systems;
- rarity systems that reward neglect/overdue work;
- finance or real-value card systems;
- full calendar replacement;
- runtime generative-AI artwork;
- storing generated SVG/raster card images in the database;
- domain-engine rewrite.

These require separate product decisions and, in several cases, new persistent domain models.

---

# 13. Implementation constraints derived from this contract

Later coding phases must follow these rules:

1. Extract Timeline **before** deleting Finished/Upcoming from Overview.
2. Replace bottom navigation only after all destinations are reachable from House Menu.
3. `/analysis` becomes canonical before `/insights` is retired as a visible route.
4. `/task/:taskId` remains valid throughout migration.
5. Push notification URLs do not need to change when V2 launches.
6. Overview/Timeline reuse existing canonical task projection and mutation services.
7. Overview never recomputes cleanliness from occurrence counts.
8. Care Cards never become a second task data model.
9. Linked activity visual treatment never collapses parent/child lifecycle independence.
10. Responsive fallback may introduce vertical scrolling; clipping operational content is forbidden.

---

# 14. Frozen decisions checklist

The following questions are considered resolved by this document.

## Overview versus Timeline

- Overview = House State + Active Deck.
- Timeline = handled today + postponed today + upcoming seven days + date browsing + restore.

## Navigation

- no bottom nav;
- one House Menu;
- eight destinations in the frozen order;
- workspace switcher stays in the header.

## Canonical routing

- `/` Overview;
- `/timeline` Timeline;
- `/home` Home;
- `/routines` Routines;
- `/actions` Actions;
- `/supplies` Supplies;
- `/analysis` Analysis;
- `/settings` Settings.

## Compatibility

- `/today` redirects to `/`;
- `/insights` redirects to `/analysis`;
- `/task/:taskId` remains the exact-occurrence deep-link resolver;
- `/home?item=<id>` is supported;
- `/settings?errors=1` is supported.

## Care Card

- frozen 10-level information/action hierarchy;
- artwork is secondary;
- child activity only appears operationally when a real child occurrence exists;
- More owns verbose/secondary actions.

## Responsive

- standard phone = viewport-first House State + Active Deck;
- accessibility/short-height = vertical overflow allowed;
- no clipping;
- no page-level horizontal scrolling;
- wide screens may use two columns without adding more primary zones.

---

# 15. Phase 1 exit status

This contract resolves the required Phase 1 decisions:

- what belongs on Overview;
- what belongs on Timeline;
- where every current top-level feature is reached;
- how canonical and compatibility routes behave;
- how push/task deep links resolve;
- what a Care Card must contain;
- how linked child activities appear;
- how standard and accessibility responsive layouts behave;
- what V2 explicitly does not include.

**No V2 page implementation is included in Phase 1.**
