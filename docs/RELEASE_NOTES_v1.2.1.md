# House Care v1.2.1 - linked activities and a clearer Overview

## Included

- Additional activities attached to a recurring parent, every N canonical parent occurrences (1-100), with separate titles, actions, targets, products, channels and cleanliness participation.
- Stable parent/child occurrence links and trigger ordinals, persisted through cloud sync and backup schema 9; import remains compatible with backup schemas 2-8.
- A per-routine Counts toward cleanliness toggle, honoured by the canonical client engine and the database completion-health function. Existing routines retain their previous participation by default.
- Horizontally scrollable cleanliness rail, numeric and emoji state feedback, explicit Regular/Deep/both labels, clearer urgent/today groups, and separated next-seven-days content.
- Activity title followed by item - action name on cards, with stock requirements also shown in Home task lists and Start room.
- Notification title is the activity title; notification body is the target item(s). Existing r4.2 subscription recovery and assignment delivery logic are retained.
- New house/floor-plan app icon assets, including maskable and Apple touch variants.
- Same-day rescheduling no longer places one active occurrence in Finished as well. A selected critical item's second low channel remains visible even when another item occupies that channel's display limit.

## Upgrade

Apply the single new SQL migration, redeploy the existing send-push function, then deploy the web package. See UPDATE_v1.2.1.md for exact paths, setup, trigger-count decisions and verification limitations.

## Deliberate limits

There is one level of additional activities, not arbitrary nested automation. Extras are separate tasks rather than checkboxes that implicitly complete with their parent. Parent assignment/reminder settings are inherited at creation; each generated occurrence may subsequently be reassigned or rescheduled on its own. There is no new notification queue or cron mechanism in this release.

Cleanliness remains an estimate based on maintenance cadence, not a physical measurement. Completion-relative future dates use nominal intervals until a parent occurrence is actually generated. Analysis currently evaluates the currently tracked routine set; the participation toggle does not add a complete historical versioning system for every routine configuration edit.

## Checks performed

Eight executable pure-domain suites passed. TS/TSX transpile syntax, service-worker syntax, translation parity, JSON, CSS parser and icon-size checks passed. Dependency-backed production build, real Postgres execution, real notifications and browser end-to-end interactions require deployment validation; they are not claimed as passed locally.
