# Cleaning Duties PWA — Product & Development Specification

**Document version:** 2.1  
**Status:** v1.1.1 maintenance release; source of truth  
**Date:** 2026-08-29  
**Initial deployment:** One household, two people, zero-cost target  
**Initial languages:** English, Italian

---

## 1. Executive assessment

The proposed application is feasible as a Progressive Web App and is well suited to a local-first-feeling, cloud-synchronized architecture. The difficult part is not authentication, recurrence, or notifications; it is designing enough abstraction to support arbitrary homes, objects, actions, schedules, assignment strategies, and stock states without exposing that abstraction as complexity to normal users.

The product should therefore follow one core architectural rule:

> **Stable internal primitives, configurable user-facing types, simple default workflows, advanced rules only when explicitly requested.**

The application should feel like a straightforward household cleaning app during normal use, while retaining a flexible model underneath.

The system should not treat everything as an arbitrary programmable object. Instead it should keep a small number of stable concepts:

- Household / workspace
- Member
- Home entity (place or item)
- Entity type
- Action
- Routine
- Task occurrence
- Recurrence schedule
- Assignment policy
- Supply
- Inventory status
- Notification policy
- Event / audit record

Users can customize labels, types, fields, relationships, target selectors, schedules, and optional rules around these primitives.

For the initial two-person deployment, the application can realistically operate at **€0/month** on current free tiers, assuming modest data volume and no large photo/video library. A practical stack is React + TypeScript + Vite/PWA, Supabase for database/auth/realtime/functions/cron, and Cloudflare for static hosting.

---

## 2. Product principles

### 2.1 Everyday use must require very little interaction

The application exists to reduce household coordination overhead, not create more administration.

For a normal due task, the primary actions should be immediately available:

- Complete
- Postpone
- Skip
- Reassign

A user should normally be able to complete a task with one tap. Notes, stock reporting, duration, condition information, or custom fields must never become mandatory unless the routine author explicitly configured them as required.

### 2.2 Configuration can be powerful; daily use must remain simple

Complexity belongs in configuration screens, not in the Today screen.

The product should distinguish between:

- **Daily mode:** fast, obvious, minimal decisions.
- **Configuration mode:** flexible, detailed, structured.
- **Advanced mode:** rule-based logic, selectors, policies, and expert options.

Advanced capabilities should be progressively disclosed instead of being visible by default.

### 2.3 Assignment must be understandable to non-programmers

Assignment should primarily use simple visual choices such as:

- Me
- Another person
- Alternate between people
- Take turns
- Anyone can do it
- Decide when the task appears

Only an explicit **Advanced assignment** section should expose rule-based conditions, weighting, workload logic, availability, or complex eligibility rules.

Users should not need to understand boolean expressions, scripts, predicates, or programming terminology.

### 2.4 Qualitative stock is the primary inventory model

The normal inventory interaction should be a small set of human-friendly states:

1. **Available**
2. **Low**
3. **Reserve only**
4. **Out of stock**

Optional secondary information may include a measured quantity, unit, package size, or estimated consumption, but those fields must not dominate the interface.

During a task the fastest useful interaction should be something like:

> Floor cleaner: Available / Low / Reserve only / Out of stock

This can be optional and shown only when the user wants to report a change.

### 2.5 History must be reliable

Past records must continue to represent what actually happened even after the home, routine, object, schedule, or assignment configuration changes.

Therefore:

- Task occurrences are immutable historical instances except for their own state transitions.
- Task targets are snapshotted when an occurrence is generated.
- Routine/configuration revisions are versioned.
- Deletion of referenced configuration normally means archive, not physical deletion.
- Important changes are recorded as events.

### 2.6 The home model and its drawing are separate

A room, surface, appliance, or piece of furniture exists independently from where and how it is drawn in the floor-plan editor.

The graphical layout is a presentation of the semantic home model, not the source of truth for it.

### 2.7 Cleaning is the first use case, not a permanent architectural limitation

The same primitives should later support general household care such as plant watering, filter changes, appliance maintenance, garden work, recycling, inspections, and similar routines without rebuilding the core system.

The UI can remain cleaning-oriented in the first releases.

---

## 3. Product vocabulary

Use consistent terminology in both UX and code.

| Internal concept | Default user-facing term | Meaning |
|---|---|---|
| Workspace | Household | Shared home/account scope |
| Entity | Place / Item | Anything in or around the home |
| Entity Type | Type | Room, floor, surface, appliance, furniture, custom types |
| Action Definition | Action | Reusable action such as Mop, Vacuum, Dust |
| Routine | Routine | Configured recurring chore |
| Task Occurrence | Task | One concrete due instance of a routine |
| Recurrence Set | Schedule | When a routine occurs |
| Assignment Policy | Assignment | Who should receive tasks |
| Supply | Supply | Cleaning product or consumable |
| Inventory Status | Stock | Qualitative availability state |
| Event Log | Activity history | What happened and when |
| Layout | Home layout | Visual representation of the home |

Do not use the word **activity** for all three of Action, Routine, and Task. They are deliberately separate concepts.

---

## 4. Core domain model

## 4.1 Household / workspace

The Household is the top-level isolation boundary.

It contains:

- Members
- Home structure
- Actions
- Routines
- Tasks
- Supplies
- Settings
- Notification preferences
- Audit history

Every relevant database row should carry a `workspace_id` or equivalent ownership relationship.

Initial roles:

- Owner
- Member

Potential future roles:

- Admin
- Guest
- Restricted member

## 4.2 Member

A member represents a person participating in household work.

Suggested fields:

- Stable ID
- Display name
- Linked login identity when applicable
- Active/inactive state
- Locale
- Notification settings
- Optional assignment availability/preference metadata

Do not assume every future participant requires a full login. The model should eventually allow a household person record to exist before an account is linked.

## 4.3 Entity

An Entity represents a place or item in the home.

Examples:

- Home
- Ground floor
- First floor
- Garden
- Kitchen
- Kitchen floor
- Sink
- Sofa
- Oven
- Table
- Plant

Suggested core fields:

- ID
- Household ID
- Entity Type ID
- Parent Entity ID where appropriate
- Name
- Optional localized names
- Tags / labels
- Custom typed properties
- Archived flag
- Revision/version metadata

## 4.4 Entity Type

Entity types should be configurable.

Default starter types can include:

- Building
- Floor / level
- Room
- Outdoor area
- Surface
- Furniture
- Fixture
- Appliance
- Object

Users can add custom types.

Entity types can define default custom fields and compatible actions without making those constraints mandatory.

## 4.5 Entity hierarchy and relationships

Support both containment and relationships.

Example containment:

```text
Home
└── Ground Floor
    ├── Kitchen
    │   ├── Kitchen Floor
    │   ├── Table
    │   ├── Counter
    │   ├── Sink
    │   └── Oven
    └── Living Room
        ├── Floor
        ├── Sofa
        └── TV
```

Relationships can describe connections that are not strict containment:

- `connected_to`
- `connected_via`
- `located_in`
- custom future relationship types

This allows floor transitions, stairs, outdoor areas, adjoining rooms, and other topologies.

---

## 5. Custom metadata

Metadata should be flexible but typed.

Do not rely on unrestricted string key/value pairs as the primary model.

Supported custom field definitions should eventually include:

- Text
- Number
- Boolean
- Choice
- Multiple choice
- Date
- Date/time
- Quantity
- Entity reference
- Person reference

Example:

```text
Field: Material
Type: Choice
Options:
- Wood
- Ceramic tile
- Porcelain tile
- Marble
```

Typed fields allow search, filtering, validation, selectors, and later automation without requiring users to write logic.

---

## 6. Home editor

## 6.1 Semantic editor first, graphical editor second

The underlying home can be configured as a structured list/tree even before the graphical floor-plan editor is complete.

This allows development of the scheduling and task system without blocking on a sophisticated drawing tool.

## 6.2 Layout model

The layout stores display information such as:

- Floor / scene
- X/Y position
- Width / height
- Polygon geometry where relevant
- Rotation
- Z-index
- Icon
- Label placement

The layout references semantic Entity IDs.

Deleting or redrawing layout geometry must not delete the underlying entity or its historical references.

## 6.3 Editor capabilities

Initial graphical editor target:

- Multiple floors/scenes
- Add room
- Draw/resize room
- Optional free polygon room shape
- Add furniture/items
- Drag
- Resize
- Rotate
- Snap to grid / nearby geometry
- Labels
- Doors / room connections
- Stairs or links to another scene
- Outdoor areas
- Show/hide layers
- Select entity to edit properties

Avoid turning the first release into CAD software. Architectural precision is not required.

## 6.4 Separate edit mode and cockpit mode

Normal Home view is interactive but not editable.

A deliberate **Edit Home** mode is required before geometry or object placement can change.

This prevents accidental modification during daily use.

---

## 7. Actions

An Action is a reusable definition of something that can be done.

Examples:

- Mop
- Vacuum
- Dust
- Wipe
- Disinfect
- Wash
- Polish
- Clean

An Action can define optional defaults:

- Name and translations
- Icon
- Instructions
- Estimated duration
- Applicable entity types
- Applicable tags
- Suggested supplies
- Completion fields
- Effect on care/cleanliness estimate
- Custom typed metadata

Actions are reusable and do not themselves contain recurrence or a concrete due date.

---

## 8. Routines

A Routine combines:

- Action
- Target selector
- Schedule
- Assignment
- Notification settings
- Optional supplies
- Optional instructions or overrides

Example:

```text
Action: Mop
Target: Kitchen > Floor
Schedule: Monday and Friday at 19:00
Assignment: Alternate between Alex and Sam
Notification: At due time
Supply: Neutral floor cleaner
```

The routine is a definition. It is not the task the user completes.

---

## 9. Target selection

Routine targets must support different levels of specificity while keeping the normal UX simple.

### 9.1 Default target UX

The normal configuration flow should be visual:

1. Choose one or more places/items from the home.
2. Choose whether the action applies to:
   - This item only
   - Everything inside this area
   - Selected parts inside this area

Examples:

- Mop Kitchen Floor
- Clean whole Bathroom
- Dust selected Living Room furniture

### 9.2 Advanced selectors

Advanced mode may later allow dynamic selectors such as:

- All descendants with tag `moppable`
- All carpets on the ground floor
- All sinks in the household
- All entities of a particular type within an area

Users should build such selectors through filters and chips, not code.

### 9.3 Target snapshotting

When a Task is generated from a Routine, resolve its selector into concrete Task Targets and store those targets.

Example:

If a routine cleaned everything inside the Kitchen on Monday and a new cabinet is added on Tuesday, Monday's historical task must not later claim that the cabinet was included.

---

## 10. Tasks

A Task is one concrete occurrence generated from a Routine or manually created.

It stores or references:

- Routine and routine revision
- Action snapshot/reference
- Due date/time
- Concrete assignee
- Concrete target snapshot
- Notification schedule
- Optional supply snapshot/reference
- Current task state
- Version for conflict detection
- Audit events

Primary user actions:

- Complete
- Postpone
- Skip
- Reassign

Secondary actions:

- Start
- Add note
- Report stock
- View history
- Reopen where allowed

A routine edit should never silently rewrite an existing task occurrence.

---

## 11. Task state model

Keep stored state compact.

Suggested primary stored states:

- `scheduled`
- `in_progress`
- `completed`
- `skipped`
- `cancelled`

A postponement is primarily a scheduling change plus an event; it does not need to become a permanent terminal state.

**Overdue should be derived**, not stored:

```text
not completed/skipped/cancelled
AND due_at < now
```

This avoids contradictory states.

---

## 12. Recurrence and scheduling

The UI must support powerful recurrence without exposing raw recurrence syntax.

Internally use a recurrence representation compatible with standard calendar concepts such as recurring rules, explicit included dates, and excluded dates.

Required user-facing patterns include:

- Every X hours
- Every X days
- Every two days
- Every week
- Every Monday and Friday
- Every N weeks on selected weekdays
- Third Wednesday of every month
- First/second/third/fourth/last weekday patterns
- Explicit custom dates
- Excluded dates
- Individual occurrence changes
- Time of day
- Time zone

### 12.1 Recurrence builder

Default UX example:

```text
Repeat: Every [2] [weeks]
On: [Mon] [Fri]
At: [19:00]
```

Always show a preview of upcoming generated dates.

Example:

```text
Next occurrences
Mon 31 Aug · 19:00
Fri 4 Sep · 19:00
Mon 14 Sep · 19:00
Fri 18 Sep · 19:00
```

This preview is more important to normal users than exposing the formal recurrence rule.

### 12.2 Fixed-calendar versus completion-relative recurrence

A routine needs a clear anchor mode.

**Fixed calendar**

- Every Monday stays every Monday regardless of when the previous task was completed.

**After completion**

- Every two days means two days after the previous completion.

These represent different household intentions and must not be conflated.

The default can be fixed-calendar for calendar-like rules and completion-relative for explicit “after completion” intervals.

### 12.3 Manual occurrence changes

Moving one occurrence should normally create an exception instead of rewriting the routine.

Typical UI:

```text
Move task
- This task only
- This and future tasks
```

The second option can be introduced after the first MVP if necessary.

### 12.4 Collision handling

If postponing a task would collide with another occurrence of the same routine, warn the user and offer a simple choice such as:

- Keep both
- Skip/replace the next occurrence

---

## 13. Assignment

Assignment is intentionally simple by default.

### 13.1 Default assignment options

Recommended first-level UI:

**Who should do this?**

- Me
- [Other household member]
- Alternate between us
- Take turns
- Anyone
- Decide later

For a two-person household, most routines should be configurable without opening any advanced screen.

### 13.2 Concrete assignment on task generation

Even if the Routine uses a rotation or flexible strategy, each generated Task receives a concrete assignee where the policy can resolve one.

Example:

```text
Routine assignment: Alternate between Alex and Sam
Generated task: Assigned to Sam
```

### 13.3 Reassignment

A task can be reassigned independently without changing the routine.

The UI should distinguish:

- Reassign this task
- Change future assignment

The first action must be much easier to reach.

### 13.4 Advanced assignment

Advanced assignment is optional and hidden behind an explicit control.

Potential future capabilities:

- Round robin among more than two people
- Least recently assigned
- Exclude unavailable people
- Member labels/skills
- Weighted rotation
- Workload balancing
- Conditional assignment

Advanced rules must be built with form controls, filters, and readable sentences rather than source code.

Example visual rule:

```text
When target type is [Outdoor area]
Assign to [Members tagged Garden]
If nobody is available [Leave unassigned]
```

Do not allow arbitrary JavaScript or user-supplied executable code.

### 13.5 Explainability

Tasks should eventually expose a simple explanation:

```text
Why me?
Assigned to you because this routine alternates between Alex and Sam,
and you were next in the rotation.
```

This is especially important once advanced assignment exists.

---

## 14. Supplies and qualitative stock

## 14.1 Supply model

A Supply represents a product or consumable used by household actions.

Examples:

- Neutral floor cleaner
- Degreaser
- Glass cleaner
- Sponges
- Garbage bags

Core fields:

- Name
- Category
- Qualitative stock status
- Optional notes
- Optional default unit
- Optional numeric quantity
- Archived state

### 14.2 Primary qualitative statuses

Default statuses:

| Status | Meaning |
|---|---|
| **Available** | Normal stock, no attention required |
| **Low** | Running down; replacement should be considered |
| **Reserve only** | Only emergency/reserve stock remains |
| **Out of stock** | Nothing usable remains |

Optionally support **Unknown** as a system state when no report exists.

Do not use “Full” as the normal top state; a half-full product may still be perfectly available.

### 14.3 Numeric quantity is secondary

Optional quantitative data can include:

- Quantity
- Unit
- Package capacity
- Estimated usage

It should be placed in secondary details, not in the primary stock interaction.

### 14.4 Reporting stock during a task

Stock reporting should not interrupt completion by default.

A fast interaction can be available after or alongside completion:

```text
Anything running low?
[ No ]   [ Report supply ]
```

Selecting a supply then exposes only the qualitative states first.

The application should remember the current status so the user only needs to interact when something changed.

### 14.5 Supply defaults and overrides

Actions may suggest default supplies.

Routines may:

- inherit Action supplies;
- add supplies;
- remove supplies;
- override them for a particular target.

Example:

- Action `Mop` normally uses Neutral Floor Cleaner.
- Routine `Mop wooden bedroom floor` replaces it with Wood Cleaner.

---

## 15. Audit and event history

Use an append-oriented event model.

Possible task events:

- `TASK_CREATED`
- `ASSIGNED`
- `NOTIFICATION_SCHEDULED`
- `NOTIFICATION_SENT`
- `STARTED`
- `POSTPONED`
- `REASSIGNED`
- `COMPLETED`
- `SKIPPED`
- `REOPENED`
- `STOCK_REPORTED`
- `NOTE_ADDED`

Example human timeline:

```text
18:00  Task created and assigned to Alex
18:02  Notification sent
19:34  Alex postponed task to tomorrow at 18:00
17:59  Reminder sent
18:10  Alex reassigned task to Sam
19:04  Sam completed task
       Floor Cleaner reported LOW
```

Current Task state should remain directly queryable for speed; the event history exists for audit and explanation.

---

## 16. Cleanliness / care status

The application cannot objectively know that an area is physically clean unless users or sensors explicitly report it.

Therefore any visual “cleanliness bar” should be described as an **estimate** or **care status**.

Potential calculation inputs:

- Last completion
- Routine expected interval
- Overdue task weight
- Importance/priority
- Optional manual condition report

Example states:

- Fresh
- Good
- Due soon
- Needs attention
- Overdue

A numeric 0–100 representation can be used internally and visually, but the text status should remain understandable.

Parent areas can aggregate their children.

Example:

```text
Kitchen — 72 / Good
Floor — 42 / Needs attention
Counter — 94 / Fresh
Oven — 67 / Good
Sink — 89 / Fresh
```

The weighting formula must remain replaceable; do not bake one irreversible definition of cleanliness into historical data.

---

## 17. Main navigation and UX

Recommended primary navigation:

- Today
- Home
- Routines
- Supplies
- Settings

Avoid a large number of top-level sections.

## 17.1 Today — default landing screen

This is the primary operational screen after configuration.

Goals:

- Show what the current user needs to do now.
- Make completion one tap.
- Expose only the most useful actions.
- Avoid configuration concepts unless requested.

Example:

```text
Today — 4 tasks

NOW
Mop kitchen floor
Alex · due 10:00

[ Complete ] [ Postpone ] [ More ]

14:00
Clean bathroom sink
Sam

19:00
Vacuum living room
Alex
```

`More` can contain Skip, Reassign, Note, History, and similar secondary actions.

## 17.2 Task completion UX

Default path:

1. Tap Complete.
2. Task immediately completes.
3. Optional non-blocking follow-up can appear only when useful:
   - Report supply issue
   - Add note
   - Undo

If a Routine explicitly requires a completion field, request only that field.

Avoid forcing a task-details form for every completion.

## 17.3 Postpone UX

Fast presets first:

- Later today
- Tomorrow
- Next morning/evening where appropriate
- Pick date & time

Specific date/time remains fully supported without making every postponement use a calendar dialog.

## 17.4 Reassign UX

For the initial two-person household, reassignment should typically be a single tap to the other member.

For larger households later, show recent/recommended members first.

---

## 18. Home cockpit

The Home screen displays the visual home layout and its current state.

Primary purpose:

- Understand where attention is needed.
- Navigate spatially to tasks and items.
- See high-level stock alerts.

Use overlay modes rather than displaying all data at once.

Recommended overlays:

- Care / cleanliness
- Tasks
- Supplies
- Objects

Example room detail:

```text
Kitchen — Good

Needs attention
- Mop floor — overdue

Due soon
- Clean oven — tomorrow

Supplies
- Floor cleaner — LOW
- Degreaser — AVAILABLE
```

The cockpit should remain usable even if the house contains many objects; zoom level and filtering should determine how much detail is shown.

---

## 19. Routine configuration UX

The configuration screen should feel like filling in a sentence, not programming.

Suggested order:

1. **What?** — choose/create Action.
2. **Where?** — choose target place/item(s).
3. **When?** — configure Schedule.
4. **Who?** — choose simple Assignment.
5. **Reminder?** — choose notification timing.
6. **Supplies?** — optional.
7. **More options** — advanced configuration.

Summary example:

```text
Mop
Kitchen floor
Every Monday and Friday at 19:00
Alternate between Alex and Sam
Notify at due time
Uses Floor Cleaner
```

Before saving, show the next generated occurrences and resolved assignees.

---

## 20. Routine preview and simulation

Every Routine creation/edit flow should show a human-readable preview.

Example:

```text
Mop kitchen floor

Targets
Kitchen Floor

Schedule
Every Monday and Friday at 19:00

Assignment
Alternating Alex → Sam

Supplies
Neutral Floor Cleaner

Next tasks
Fri 28 Aug — Alex
Mon 31 Aug — Sam
Fri 4 Sep — Alex
Mon 7 Sep — Sam
```

For future advanced rules, extend this into a 30-day simulation view.

This preview is a key protection against mistakes in complex configurations.

---

## 21. “Why is this task here?”

The architecture should preserve enough information to explain a task.

Example:

```text
Mop Kitchen Floor

Created because
Routine “Kitchen Floor” selected Kitchen Floor.

Due today because
The routine runs every Monday and Friday at 19:00.

Assigned to you because
The routine alternates between Alex and Sam and you were next.

Supplies
Neutral Floor Cleaner
Mop
```

This is not necessarily required in the first MVP UI but should be supported by the data model.

---

## 22. Notifications

Support Web Push through standard PWA technologies.

Possible reminder configurations:

- At due time
- 30 minutes before
- 1 hour before
- Previous day at same time
- Previous day at a chosen time
- Custom offset

Future version can support multiple reminders per task.

Notifications belong to the concrete Task, generated from the Routine's Notification Policy.

Notification delivery should be audited.

On iOS/iPadOS, Web Push is supported for installed Home Screen web apps on versions supporting the modern PWA push APIs. The UX must account for permission being optional and user-controlled.

Privacy setting for notification content can eventually support:

- Detailed: `Mop kitchen floor is due at 19:00.`
- Private: `You have a household task due at 19:00.`

---

## 23. Localization

Initial locales:

- English (`en`)
- Italian (`it`)

Rules:

- Never use display labels as stable identifiers.
- Keep application strings in translation resources.
- Use stable IDs for Actions, Entity Types, status values, and configuration objects.
- Let user-created content remain as entered, with optional translated labels later.
- Use locale-aware date, time, number, and plural formatting.

Example internal stock status:

```text
stock.low
```

Possible labels:

```text
en: Low
it: In esaurimento
```

Do not duplicate business logic by language.

---

## 24. Time zones

Household schedule configuration must use an IANA time-zone ID such as:

```text
Europe/Rome
```

Do not store a fixed UTC offset such as `UTC+2` as the household scheduling definition.

Store actual timestamps in UTC where appropriate, while preserving the intended local recurrence/time-zone context.

This is required for daylight-saving correctness.

---

## 25. Offline and synchronization

The PWA should eventually remain useful when temporarily offline.

Minimum offline cache:

- App shell
- Today's tasks
- Current home layout
- Core entity labels
- Supply statuses

Offline mutations can be queued locally and synchronized when connectivity returns.

Important actions to support offline eventually:

- Complete task
- Postpone task
- Report stock
- Add note

Use record versions or equivalent optimistic concurrency control to detect simultaneous edits rather than silently overwriting them.

For the first two-person release, full offline mutation support can follow the online core if it would delay the MVP too much, but the data model must not prevent it.

---

## 26. Import and export

A manual full household export/import is required.

Primary format:

- JSON

Export should include all user-owned logical data required to reconstruct a household:

- Household settings
- Members/person records where appropriate
- Entity types
- Entities and relationships
- Layouts
- Custom field definitions and values
- Actions
- Routines
- Schedules
- Assignment policies
- Supplies and current stock
- Tasks and task targets
- Audit/events
- Relevant revisions

Exclude secrets, authentication tokens, push subscription secrets, and provider-specific credentials.

Import must validate schema version before writing data.

Export format should contain:

```text
schema_version
exported_at
application_version
```

Migration functions can convert older exports to the current schema.

This manual export is also the initial backup strategy because the intended free database tier does not provide automatic backups.

---

## 27. Security and authentication

Initial authentication options:

- Email/password
- Optional supported OAuth provider later

Authorization must be enforced at database/backend level, not only in frontend code.

Every household-owned row should be protected so only members of that household can access it.

Recommended approach with Supabase:

- PostgreSQL Row Level Security
- Household membership table
- Least-privilege policies
- Server-side/Edge Function validation for privileged mutations

Do not expose administrative service credentials to the PWA client.

---

## 28. Configuration versioning and archival

Configuration that can affect generated Tasks should carry revision information.

Examples:

- Routine revision
- Action revision where required
- Assignment policy revision
- Target selector revision

Historical Task data should reference the revision or snapshot necessary to explain its generation.

Deleting referenced configuration should normally set an archived flag.

Physical deletion is reserved for unreferenced or explicitly purged data.

---

## 29. Suggested logical data model

This is conceptual and will be refined before migrations are implemented.

```text
workspaces
workspace_members
profiles

entity_types
entities
entity_relations
field_definitions
entity_field_values
layout_scenes
layout_elements

action_definitions
action_revisions
action_field_definitions

routines
routine_revisions
routine_target_selectors
recurrence_sets
assignment_policies
notification_policies

task_occurrences
task_targets
task_events

supplies
supply_stock
supply_events

push_subscriptions

audit_events
```

Common fields where applicable:

```text
id
workspace_id
created_at
created_by
updated_at
archived_at
version
```

Do not blindly add all common fields to every table; use them where the domain semantics require them.

---

## 30. Technical architecture

Recommended initial stack:

### Frontend

- React
- TypeScript
- Vite
- PWA manifest
- Service Worker
- Responsive mobile-first UI
- SVG-based home editor/cockpit initially

### Backend / cloud

- Supabase PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Realtime where useful
- Supabase Edge Functions for trusted server behavior
- Supabase Cron / `pg_cron` for scheduled dispatch and notification checks

### Hosting

- Cloudflare static assets / Workers deployment

### Notifications

- Standard Web Push
- VAPID credentials stored only on trusted backend
- Push subscriptions per member/device

### Scheduling strategy

Do not create one permanent background process per recurring routine.

Instead:

1. Maintain/generate upcoming task occurrences within a bounded horizon.
2. Store concrete notification times.
3. Run a periodic scheduler that finds due unsent notifications.
4. Send Web Push.
5. Record delivery attempt/results.

Exact generation horizon can be tuned after implementation.

---

## 31. Zero-cost feasibility

Verified against vendor documentation on 2026-08-28.

### Supabase Free

Current documented free allowances include, among other limits:

- 500 MB database size per project
- 50,000 monthly active users
- 1 GB storage
- 500,000 Edge Function invocations
- 2 million Realtime messages
- 200 peak Realtime connections
- 5 GB egress

The Free plan currently does not include automatic backups and may pause inactive projects after one week of inactivity.

For two active household users with primarily structured data, this is far above the expected initial usage.

### Cloudflare

Cloudflare currently documents free/unlimited serving of static assets for this model, while Workers Free currently allows up to 100,000 Worker requests per day and five Cron Triggers per account.

The initial architecture does not need a high volume of Worker execution because most backend work can remain in Supabase.

### PWA push

Modern Web Push uses the browser Push API, Notifications API, and Service Workers. iOS/iPadOS have supported Web Push for Home Screen web apps since 16.4.

### Expected initial monthly infrastructure cost

```text
€0
```

Assumptions:

- Two users
- Modest structured data
- No large media library
- Provider subdomains are acceptable
- Manual JSON backup/export is acceptable
- No premium SMTP/custom-domain requirement

Potential future paid costs include custom domains, stronger automated backups, large storage, higher traffic, premium email delivery, or substantially larger user counts.

---

## 32. Development strategy

The application should be built as a sequence of vertical slices. Each phase should produce something usable and testable rather than building all infrastructure before any workflow works.

A central rule for development:

> **Do not start the sophisticated graphical floor-plan editor until the Action → Routine → Task → Complete loop works correctly.**

The editor is visually important but is also one of the highest-risk areas for consuming development time without validating the core household workflow.

---

# Development phases

## Phase 0 — Foundation and project contract

### Goal

Create the technical foundation and freeze the first version of the vocabulary/domain rules.

### Deliverables

- Repository/application skeleton
- React + TypeScript + Vite
- PWA manifest and installability baseline
- Supabase project connection
- Environment configuration
- Database migration framework
- Authentication skeleton
- English/Italian localization framework
- Base design system/components
- Routing/navigation skeleton
- Error/logging conventions
- This specification stored with the project

### Domain decisions to codify

- Action vs Routine vs Task
- Entity and Entity Type
- Household isolation
- Task state definitions
- Stock status enum
- Fixed-calendar vs after-completion recurrence
- Archive/version conventions

### Exit criteria

- App runs locally and from deployed free hosting.
- A user can sign in.
- Locale can switch between English and Italian.
- Database migrations can be applied reproducibly.
- Household-scoped authorization model exists.

---

## Phase 1 — Core daily workflow vertical slice

### Goal

Prove the essential value of the application without a graphical home editor.

### Deliverables

#### Household and people

- Create household
- Invite/link second member or create initial member relationship
- Owner/member access

#### Structured home model

- Create Entity Types
- Create/edit/archive Entities
- Parent/child hierarchy
- Simple tree/list home browser
- Labels/tags

#### Actions

- Create/edit/archive Actions
- Basic name/icon/instructions

#### Routines

- Create Routine
- Select one or more exact targets
- Basic recurrence:
  - one-off
  - daily interval
  - selected weekdays
  - weekly interval
- Time of day
- Fixed-calendar scheduling
- Simple assignment:
  - Me
  - Other member
  - Alternate
  - Anyone/unassigned where appropriate

#### Tasks

- Generate concrete Task occurrences
- Today screen
- Complete
- Skip
- Postpone to explicit date/time
- Reassign
- Audit events

### UX priority

A normal task completion must be one tap.

### Exit criteria

For one full week, the two intended users could realistically coordinate actual chores through the app without needing database changes or developer intervention.

---

## Phase 2 — Recurrence, configuration UX, supplies, import/export

### Goal

Make the core flexible enough for real household configuration while retaining a simple interface.

### Deliverables

#### Recurrence builder

- Every X hours/days/weeks/months where semantically supported
- Multiple selected weekdays
- Nth weekday of month
- Time of day
- Upcoming occurrence preview
- Fixed-calendar mode
- After-completion mode
- Explicit date exclusions/inclusions
- Move one occurrence
- Collision handling

#### Routine builder refinement

Wizard/sentence flow:

1. What?
2. Where?
3. When?
4. Who?
5. Reminder?
6. Supplies?
7. More options

#### Supplies

- Create/edit/archive Supply
- Qualitative status:
  - Available
  - Low
  - Reserve only
  - Out of stock
- Optional numeric quantity as secondary detail
- Attach default supplies to Actions
- Override supplies on Routines
- Fast stock reporting without mandatory completion form
- Supply history/events

#### Typed metadata baseline

- Field definitions
- Text
- Number
- Boolean
- Choice
- Multi-choice if feasible in this phase

#### Backup

- Manual JSON export
- Schema version in export
- JSON import
- Validation before import

### Exit criteria

The app can represent the majority of the originally described recurrence patterns and can be configured without requiring programming knowledge.

---

## Phase 3 — Visual home editor and cockpit

### Goal

Add the spatial interaction model that differentiates the application from conventional chore lists.

### Deliverables

#### Editor

- Multiple floor/scene support
- Room geometry
- Place furniture/items
- Drag/resize/rotate
- Labels
- Connections
- Links between floors/scenes
- Outdoor area support
- Explicit Edit Home mode

#### Cockpit

- Read-only/interact mode
- Click/tap room or item
- Show current tasks for target
- Show care/cleanliness estimate
- Show relevant supply alerts
- Overlay modes:
  - Care
  - Tasks
  - Supplies
  - Objects

#### Target selection integration

- Select Routine targets directly from the visual home
- Whole-area target
- Exact-item target
- Selected parts inside an area

### Exit criteria

The visual home is useful for both configuration and current-state understanding, not merely decorative.


**Implementation status:** baseline complete 2026-08-28. The implemented layout remains presentation-only and independent of semantic entities. Routine target selection supports exact targets and an explicit **Area + contents** scope; generated Tasks snapshot the resolved concrete targets. The Care score is currently a derived, replaceable estimate rather than persisted truth.

---

## Phase 4 — Notifications, PWA polish, offline resilience

### Goal

Make the application dependable enough to behave like an installed household utility.

### Deliverables

#### Push

- Push subscription management
- Permission UX
- Due-time notifications
- Previous-day notifications
- Custom offsets
- Notification audit events
- Notification click deep-links to Task
- Graceful behavior when notification permission is unavailable

#### PWA

- Installability polish
- Icons/splash/manifest review
- App badge where supported and useful
- Update/version handling

#### Offline

- Cache app shell
- Cache Today/tasks and home data
- Offline read support
- Queue selected offline mutations
- Synchronization on reconnect
- Conflict/version handling

### Exit criteria

The application can reliably support day-to-day household use from mobile Home Screen installations, including intermittent connectivity.

**Implementation status:** baseline complete 2026-08-28. Push reminders are server-driven through derived notification jobs and a scheduled Supabase Edge Function. Reminder choices include due time, common offsets, custom offsets, and previous-day delivery. Installed clients support notification deep-links, app badges where available, explicit application updates, offline cached household data, and queued operational mutations. Complete, Skip, Postpone, Reassign, and qualitative stock changes use optimistic version checks so a reconnect conflict does not silently overwrite a newer server change. General configuration editing remains online-only in cloud mode. Push subscriptions and notification jobs are runtime state and are intentionally excluded from JSON backup schema v4.

---

## Phase 5 — Advanced targeting and assignment

### Goal

Add powerful automation without making it the normal workflow.

### Deliverables

#### Advanced target selectors

Visual filter builder for concepts such as:

- All items of type X
- All descendants of area Y
- All items tagged Z
- Compound filters

No source-code rules.

#### Advanced assignment

Optional advanced screen supporting selected strategies:

- Round robin
- Least recently assigned
- Availability exclusion
- Member tags/eligibility
- Weighted rotation
- Workload-aware assignment

#### Explainability

- Why is this task here?
- Why was it assigned to me?
- Which selector matched this target?

#### Simulation

- Preview next 30 days
- Show generated dates
- Show resolved targets
- Show resolved assignees
- Highlight conflicts

### Exit criteria

Power users can express complex household logic, while a new user can continue using the application without encountering those concepts.

**Implementation status:** baseline complete 2026-08-28. Routine configuration keeps the original What / Where / When / Who flow unchanged and places dynamic target selectors, advanced assignment, and simulation under More options. Dynamic selectors support type, label, descendants-of-area, and all/any compound matching without executable rules. Advanced assignment supports candidate pools, member eligibility labels, temporary unavailability exclusion, round robin, least-recent, weighted rotation, and nearby-workload balancing. Generated Tasks snapshot target-match and assignment explanations. Task details expose “Why is this task here?” and per-target match reasons. Multi-target Tasks support optional target-by-target completion while retaining one-tap whole-task completion as the normal path. Offline target completion uses the same optimistic version queue as other daily actions. Backup schema v5 includes the new logical configuration/history fields.

---

## Phase 6 — Hardening, analytics, and future household care

### Goal

Improve reliability and expand capabilities only after real usage reveals the valuable directions.

### Candidate deliverables

- Better audit explorer
- Household workload analytics
- Completion trends
- Care-score tuning
- Supply consumption estimation
- Predicted low-stock warnings
- Templates / starter home content
- Shared routine templates
- Richer custom fields
- More household member roles
- General maintenance actions beyond cleaning
- Optional sensors/integrations
- Photos/attachments if justified
- Automated backup strategy if moving beyond free/hobby deployment

Do not commit to these before actual use demonstrates value.

**Implementation status:** v1 baseline complete 2026-08-28. Phase 6 deliberately implements only the hardening items justified without real-world usage data: a searchable audit/insights screen, completion and workload summaries, cautious qualitative stock outlook based only on repeated status history, three-level care-estimate sensitivity, an optional starter household pack that creates no schedules, accessibility/reduced-motion/focus improvements, a top-level render error boundary, timestamped deployable migrations, production deployment documentation, and backup schema v6. Sensors, attachments, purchasing, automated backup infrastructure, extra member roles, and complex analytics remain post-v1 candidates.

---

## 33. Explicit MVP exclusions

To prevent scope explosion, the first working release should not require:

- Architectural CAD accuracy
- 3D rendering
- Automated room recognition
- Arbitrary executable rules
- AI-generated schedules
- Quantitative inventory management as the primary model
- Purchasing integrations
- Native iOS/Android application
- Complex analytics dashboards
- Photos/video
- Sensor integrations
- Public multi-tenant onboarding beyond what is necessary for the two intended users

The architecture should permit future expansion without implementing it now.

---

## 34. UX acceptance principles

Any feature should be reviewed against these rules.

### Daily-use test

Can a non-technical user complete the common action without understanding the underlying model?

### Interaction-cost test

Does this feature force extra taps during normal chores when the information could be inferred, remembered, or made optional?

### Progressive-disclosure test

Can advanced configuration stay hidden until requested?

### Explainability test

If automation makes a decision, can the app explain it in ordinary language?

### Historical-integrity test

Will editing today's configuration alter the meaning of yesterday's history?

### Rename test

Can a user rename a room, Action, Type, or Supply without breaking logic?

### Offline/conflict test

What happens when two people act on the same Task from different devices?

### Localization test

Is business logic independent from English/Italian labels?

### Accessibility test

Can the essential workflow be completed without relying only on color, tiny hit targets, drag gestures, or hover states?

---

## 35. Recommended first implementation sequence inside each phase

When implementation begins, prefer a complete thin slice over broad unfinished infrastructure.

Example Phase 1 sequence:

1. Sign in and household creation.
2. Create two members.
3. Create Kitchen entity.
4. Create Kitchen Floor entity.
5. Create Mop Action.
6. Create one Routine targeting Kitchen Floor.
7. Generate one concrete Task.
8. Show it on Today.
9. Complete it.
10. Record completion event.
11. Add recurrence.
12. Add alternate assignment.
13. Add postpone/skip/reassign.
14. Generalize UI for arbitrary Entities and Actions.

This creates demonstrable value very early and continuously tests whether the abstraction remains usable.

---

## 36. Initial source-of-truth decisions

The following decisions are considered accepted unless deliberately revised later:

1. PWA rather than native application for the initial product.
2. Initial household consists of two users.
3. Target initial infrastructure cost is €0/month.
4. React + TypeScript + Vite is the preferred frontend direction.
5. Supabase is the preferred initial backend direction.
6. Cloudflare static hosting/Workers is the preferred initial hosting direction.
7. Stable internal primitives with configurable user-facing types.
8. Action, Routine, and Task are separate concepts.
9. Semantic home data is separate from graphical layout data.
10. Entities support both hierarchy and relationships.
11. Target resolution is snapshotted onto generated Tasks.
12. Assignment is simple by default; rule-based assignment is advanced only.
13. Daily-use UX minimizes interaction and avoids unnecessary forms.
14. Supply stock is qualitative first; numeric quantity is optional secondary information.
15. Default supply states are Available, Low, Reserve only, and Out of stock.
16. History is event/audit based and must survive later configuration edits.
17. Complex recurrence is supported through a friendly builder plus occurrence preview.
18. Fixed-calendar and after-completion recurrence are distinct concepts.
19. Individual date changes are occurrence exceptions unless the user explicitly changes the Routine.
20. Overdue is derived rather than a permanent stored terminal state.
21. Cleanliness/care shown by the app is an estimate, not an objective measurement.
22. English and Italian localization exist from the beginning.
23. Household scheduling uses IANA time zones such as Europe/Rome.
24. Web Push is the initial notification mechanism.
25. Manual JSON export/import is required and acts as the initial backup strategy.
26. Advanced rules must be declarative and visual; arbitrary executable user code is out of scope.
27. The sophisticated graphical editor follows the first working Action → Routine → Task loop.

---

## 37. Open product questions to resolve through implementation rather than up-front complexity

These do not block Phase 0/1 and should be answered from real use where possible:

- Exact care/cleanliness score formula
- Whether “Take turns” and “Alternate” need separate semantics for two users
- How far ahead Task occurrences should be materialized
- Default postponement presets
- How aggressively missed notifications should be retried
- Whether supplies need per-location stock later
- Whether users need manual condition reports for rooms/items
- Whether routine changes should support “this and future” immediately or after MVP
- Which advanced assignment policies prove genuinely useful
- Which graphical editor interactions work best on phone versus desktop/tablet

These should remain explicit open questions rather than being solved with speculative complexity.

---

## 38. Current external platform references

These references are included because free-tier limits and browser capabilities can change and should be rechecked before production decisions.

- Supabase Pricing: https://supabase.com/pricing
- Supabase billing/usage documentation: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase scheduled Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare static assets billing/limitations: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- WebKit — Web Push for Home Screen web apps on iOS/iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

---

## 39. How this document should be maintained

This file is intended to be the product source of truth while the application is developed.

When a product decision changes:

1. Update the relevant section.
2. Update **Initial source-of-truth decisions** if the change affects an accepted principle.
3. Add a short changelog entry below.
4. Increment the document version when the change is material.

Do not maintain competing product specifications unless a later architecture/design document deliberately specializes this one.

---

## 40. Changelog

### 1.0 — 2026-08-28

- Consolidated initial product assessment.
- Defined stable domain primitives.
- Separated Action, Routine, and Task.
- Established semantic-home versus graphical-layout separation.
- Made assignment simple by default with advanced rules optional.
- Made qualitative supply stock the primary inventory interaction.
- Added manual JSON export/import as the initial backup strategy.
- Added phased implementation plan from foundation through advanced automation.
- Established initial zero-cost deployment architecture.


### 1.1 — 2026-08-28 — Phase 1 implementation baseline

- Implemented Phase 0 foundation and Phase 1 core daily workflow in the working repository.
- Added a zero-setup local-storage mode for development/testing; cloud mode remains the intended shared-use mode.
- Phase 2 materializes fixed-calendar tasks through a rolling 45-day horizon; hourly routines use a shorter 14-day horizon to avoid excessive occurrence creation.
- Editing or archiving a Routine cancels its future pending materialized Tasks, preserves them in history, increments the Routine revision, and materializes the updated schedule.
- Added simple second-person linking: an owner may create an invited membership by email; a Supabase account signing in with that exact email claims the pending membership.
- Kept advanced assignment logic outside the standard Routine UI.


### 1.2 — 2026-08-28 — Phase 2 implementation baseline

- Added friendly recurrence configuration for intervals in hours/days/weeks/months, selected weekdays, and nth-weekday monthly patterns.
- Added fixed-calendar versus after-completion scheduling. After-completion is intentionally limited to interval schedules in the normal UI.
- Added upcoming occurrence previews, date exclusions, explicit inclusions, and a simple move-one-occurrence control.
- Added Reminder preferences to Routine configuration; actual Web Push delivery remains Phase 4.
- Added qualitative-first Supplies with Available, Low, Reserve only, and Out of stock states; quantity/unit remain optional advanced details.
- Added default Action supplies, Routine supply overrides, Task supply snapshots, fast stock reporting, and append-only supply history.
- Added typed custom metadata fields for places/items, Actions, and Supplies.
- Added schema-versioned manual JSON export/import. Import preserves the current authenticated owner identity while restoring logical household data.
- Added Supabase migration `20260828111000_phase2_configuration.sql`, including an owner-only restore reset function rather than general client DELETE permissions.

### 1.3 — 2026-08-28 — Phase 3 implementation baseline

- Added a visual Home editor with multiple floor/outdoor scenes, area/object placements, drag/resize/rotate, polygon geometry, grid snapping, labels, layering, and explicit editor mode.
- Kept semantic home entities independent from visual geometry; removing/redrawing a placement does not delete entities, Routines, or history.
- Added semantic connections for doors, passages, stairs, and links between scenes.
- Added the operational Home cockpit with Care, Tasks, Supplies, and Objects overlays plus target inspection.
- Added a visual Routine target picker with **Only this** and **Area + contents** scopes.
- Area-scoped Routines resolve descendants when generating a Task and snapshot the concrete targets for audit stability.
- Added backup schema v3 for layout data while retaining import compatibility with Phase 2 schema-v2 exports.
- Added Supabase migration `20260828112000_phase3_visual_home.sql`.
- The Phase 3 Care score is deliberately provisional/derived and may be tuned without changing persisted history.

### 1.4 — 2026-08-28 — Phase 4 implementation baseline

- Added per-device Web Push subscription management with permission UX and graceful unsupported/blocked states.
- Added server-derived notification jobs for due-time, previous-day, preset-offset, and custom-offset reminders.
- Added scheduled Supabase Edge Function delivery, stale-subscription cleanup, delivery retries, and `NOTIFIED` / `NOTIFICATION_FAILED` Task audit events.
- Added notification click deep-links directly to the relevant Task.
- Added PWA installability polish, manifest shortcuts, app badge where supported, and explicit service-worker update handling.
- Added cached cloud household data for offline reads and restoration of an existing cached Supabase session while offline.
- Added an offline operational mutation queue for Complete, Skip, Postpone, Reassign, and qualitative supply stock updates.
- Added optimistic task/supply version checks, idempotent mutation event IDs, reconnect synchronization, and visible conflict handling rather than last-write-wins.
- Added backup schema v4; runtime push subscriptions and derived notification jobs remain outside backups.
- Added Supabase migration `20260828113000_phase4_pwa_notifications.sql`, Edge Function `send-push`, and a one-time hosted Cron/Vault setup example.
- General household/configuration edits intentionally remain online-only in cloud mode for Phase 4.


### 1.5 — 2026-08-28 — Phase 5 implementation baseline

- Added optional visual/declarative target selectors for type, label, descendants-of-area, and compound all/any matching.
- Kept simple target selection as the default; advanced selectors live under **More options** and are unioned with explicit targets.
- Added optional advanced assignment with candidate pools, eligibility labels, temporary unavailability exclusion, round robin, least-recent, weighted rotation, and workload-aware strategies.
- Added per-member assignment profiles for eligibility labels and temporary unavailability.
- Added 30-day Routine simulation showing generated dates, resolved targets, resolved assignees, and conflicts before saving.
- Added explainability snapshots on generated Tasks: schedule reason, assignment reason, target-selector summary, and per-target match reasons.
- Added optional partial completion of multi-target Tasks while preserving one-tap whole-task completion as the normal interaction.
- Added offline/reconnect support and optimistic version conflict handling for target-level completion.
- Added backup schema v5 and Supabase migration `20260828114000_phase5_advanced_rules.sql`.

### 1.6 — 2026-08-28 — Phase 6 / v1.0 release baseline

- Closed the initial development plan as House Care v1.0.
- Added Insights with searchable task/supply audit history, completion rate, on-time rate, 14-day trends, and household workload summaries.
- Added cautious qualitative supply outlook; no quantitative inventory interaction is required.
- Added Relaxed / Balanced / Strict care-estimate sensitivity. This changes only cockpit scoring and never schedules or history.
- Added an optional localized starter pack for empty households with example types, rooms, actions, supplies, labels, and a simple floor layout; it creates no Routines or notifications.
- Added focus-visible, minimum-target, reduced-motion and render-error hardening.
- Added backup schema v6 and application version 1.0.0.
- Renamed Supabase migrations to CLI-compatible timestamp filenames and added a v1 hardening/index migration.
- Added a production deployment guide for Supabase, Cloudflare Workers Static Assets, Auth, Web Push, Cron/Vault, two-user onboarding, smoke tests, and updates.
- Explicitly deferred photos, sensors, purchasing integrations, additional role systems, automated off-site backups, and large analytics dashboards until real usage justifies them.


### 1.7 — 2026-08-28 — v1.0.1 maintenance release

- Added cloud workspace discovery, explicit home switching, per-device last-home selection, create-another-home flow, and archived-home recovery.
- Added owner-only archive/restore/permanent-delete operations. Permanent delete is intentionally gated behind archive and exact-name confirmation.
- Archived homes cancel pending notification jobs; restoring rebuilds reminders for still-scheduled tasks.
- Scoped cloud cache, offline mutation queues and sync conflicts by user + workspace so homes remain isolated during offline operation.
- Improved the Home editor for touch: continuous pointer motion, snapping only on gesture end, snap disabled by default, screen-transform-correct SVG coordinates, and enlarged invisible resize/vertex hit targets.
- Geometry inputs now buffer edits and commit on blur/Enter rather than persisting every keystroke.
- Mobile form controls use at least 16px text to prevent iOS Safari focus zoom.
- Added migration `20260828170000_v1_0_1_workspace_management.sql`; backup schema remains v6 and application version is 1.0.1.

### 1.8 — 2026-08-29 — v1.0.2 maintenance release

- Moved modal sheets, including the home selector, to a document-level portal and added iOS safe-area/dynamic-viewport constraints so mobile menus remain visible in portrait orientation.
- Persisted the selected home per cloud account using Supabase Auth user metadata, with per-device fallback for offline startup. When no valid remembered home exists, the newest active home is selected; home creation is shown only when there are no active homes.
- Persisted English/Italian locale per cloud account using Auth user metadata, retaining local per-user and browser-locale fallbacks.
- Hardened Routine creation against repeated submit gestures and identical duplicate definitions. Generated Task occurrence IDs are deterministic and cached duplicate occurrences are normalized while preserving the stronger historical record.
- Replaced generic object stringification in user-facing errors with structured error normalization.
- Added bounded local-only diagnostics: maximum 40 entries, 30-second repeat grouping, recent UI action context, route/home/user/online context, and no form-value/password capture. Diagnostics are never sent to Supabase.
- No database migration is required; application version is 1.0.2 and backup schema remains v6.


### 1.9 — 2026-08-29 — v1.0.3 maintenance release

- Hardened cloud persistence against legacy/cached duplicate records by deduplicating every bulk upsert payload using its actual conflict key before sending it to Supabase. Task/routine target payloads are deduplicated by their composite keys, and persisted failures now identify the exact table in local Diagnostics.
- Kept duplicate repair client-side and non-destructive: existing database history is not mass-deleted or rewritten merely because an old client produced repeated in-memory rows.
- Added Home-layout zoom controls from 75% to 250% with a one-tap reset to 100%. Zoom affects only the SVG layout canvas, never browser/page zoom.
- Added per-placement label font size, optional wrapping, and configurable wrapping width. Wrapping uses anywhere-break behavior so a single long word can wrap; label width may exceed object width so readability is not constrained to the object boundary.
- Fixed polygon resizing after adding/moving vertices by moving bounding-box resize interaction away from polygon vertex handles. Width/height continue to scale normalized polygon points as a group.
- Added migration `20260829183000_v1_0_3_layout_labels.sql` for the three visual label preference columns. Backup schema remains v6 and application version is 1.0.3.

### 2.0 — 2026-08-29 — v1.1.0 dual care + layout presentation

- Added one simple Routine classification: **Routine cleaning** or **Deep cleaning**. The classification is snapshotted onto generated Tasks so later Routine edits never reinterpret historical work. Existing Routines/Tasks migrate as Routine cleaning.
- Split cockpit care into two derived dimensions. **Routine care** represents short-term upkeep. **Deep care** represents slower long-term condition and exists only when at least one active Deep Routine resolves to the selected entity/subtree. Places without Deep Routines do not show a meaningless Deep bar.
- A completed Deep task can refresh the Routine physical-care estimate for the same scope without mutating or falsely completing older Routine task records. Routine completion never restores Deep care.
- Effective overall condition is derived internally from Routine care and Deep deterioration (`Routine × (0.5 + 0.5 × Deep)` with normalized percentages when both dimensions exist). Users see health bars and status, not the formula or coefficients.
- Care aggregation remains target-aware: a parent area aggregates only concrete Routine/Deep work that resolves into its subtree; descendants with no Deep requirement do not create Deep-care obligations. Partial target completion is respected per scope.
- Added stacked game-style Routine/Deep health bars to the Home layout Care overlay and explicit dual bars in the selected-area inspector.
- Added content-fit Home layout camera behavior. Opening a scene centers/fits its current placements with padding; zoom controls operate only on the SVG camera, and the 100% control recomputes the fit.
- Added per-placement visual presentation: fill color, automatically darker contour, text color, optional text background color, label position (top/center/bottom), and label rotation presets for horizontal/diagonal/vertical presentation. Existing font-size, width and wrapping controls remain.
- Added per-scene background color. These visual settings do not alter semantic home entities, Routine targets or history.
- Added migration `20260829190000_v1_1_dual_care_layout_style.sql`, backup schema v7, and application version 1.1.0. No notification Edge Function, Web Push secret, cron, or Cloudflare environment changes are required.

### 2.1 — 2026-08-29 — v1.1.1 Today correctness and occurrence reconciliation

- Reworked Today into explicit **To do / Completed / All** views. Completed/skipped work is excluded from the default queue instead of sharing the same work list.
- Added optional **For me / Household** scope. Unassigned tasks remain visible in For me because any household member may act on them.
- Split open work into **Due now** (including overdue work) and **Later today**, making newly generated recurrence occurrences visually distinct from the task just completed.
- Routine name is now the primary Today title; Action and concrete target snapshots remain visible as secondary context.
- Task details use a distinct Task Details sheet and expose whole-task Complete for scheduled tasks.
- Routine edits now cancel all still-scheduled occurrences of the previous definition, including overdue occurrences. Completed/skipped history is never rewritten.
- Startup/materialization automatically retires stale scheduled occurrences whose Routine revision has been superseded or archived, repairing old-time/new-time duplicates produced by earlier clients.
- Today performs an additional defensive deduplication by task ID and natural occurrence key before rendering.
- Backup schema remains v7; application version is 1.1.1. No database migration, Edge Function, Web Push, cron, or Cloudflare variable change is required.

