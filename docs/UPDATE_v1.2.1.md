# House Care v1.2.1 - update from v1.2.0-r4.2

This package implements the linked-activity and Overview feature update. The ZIP has **one project folder: `cleaning-duty-pwa`**. Use the contents of that folder as the repository root. There is no second `v121_work` or `v120_r42` folder to choose from.

## 1. Back up your household

In the currently deployed app, use **Settings > Backup > Export JSON** before upgrading. Keep the backup outside your Git repository. Existing routines default to contributing to cleanliness, so upgrading does not opt out existing cleaning rules.

## 2. Run the new Supabase migration

For an existing project already updated through r4.2, run **only this new file**:

`supabase/migrations/20260911133000_v1_2_1_linked_activities.sql`

Open Supabase > SQL Editor > New query, paste the entire file, and run it. The script uses a transaction and is written to be safe to rerun. It adds linked-routine/occurrence fields and the cleanliness participation flag, and updates the completion-health guard. It does not delete household data or rebuild/replay notification jobs.

Do not rerun old bootstrap/setup SQL or the historical notification-repair migrations for this upgrade. The new frontend requires the new columns; apply SQL before deploying the app.

## 3. Redeploy the existing send-push function

Open **Edge Functions > send-push > Code/Edit**, replace `index.ts` with:

`supabase/functions/send-push/index.ts`

Then deploy the update. The accompanying `deno.json` is unchanged from r4.2. Keep JWT verification disabled for this existing cron-secret-authenticated function. Keep the same VAPID keys, CRON_SECRET, other secrets, and cron schedule.

The new notification uses the activity/routine title as its title and the target item names as its body. Delivery still follows the existing rules: specific member, Everyone/household, or no notification for Unassigned. An extra activity is a separate occurrence and therefore uses the same reminder pipeline as any other activity. Exact line wrapping depends on the receiving device.

## 4. Deploy the web app

Extract the ZIP and open its `cleaning-duty-pwa` folder. Copy the **contents** into the existing cloned Git repository, replacing matching files. Preserve the repository's `.git` folder and your private environment settings. Do not copy `node_modules`, a private `.env`, or backup exports into Git.

From Git Bash inside your repository:

```bash
git status
git add -A
git diff --cached --stat
git commit -m "Release House Care v1.2.1"
git push
```

These commands assume the repository is already cloned and has its upstream branch configured, as in your preceding releases. Cloudflare should run the existing `npm run build` command. No build-variable changes are introduced.

Reopen or refresh the app after deployment. The package version and service-worker cache version are **1.2.1**. Existing installed-app icons may remain cached by the device even after the web assets update.

## 5. Configure an additional activity

Open **Routines > Add routine**, or edit an existing recurring routine. Set its title, action, targets, schedule, assignment, reminder and products as before.

Under **Additional activities**, choose **Add additional activity**. Give it its own activity title, action and target item(s), and set **Every N parent occurrences**. Choose its Regular/Deep channel, cleanliness participation, refresh level and products. Products can inherit from that extra's selected Action or use a custom Stock selection; they do not automatically inherit the parent's products. Save the parent once to save its extra activities too.

Example: a daily "Clean living room" routine starts on September 1. Add "Dust the bookshelf", target Bookshelf, action Dust, every 3 occurrences, with Wood polish as a required product. The extra appears on the parent's 3rd, 6th, 9th and subsequent matching slots. It is a separate actionable activity with its own completion/skip state.

## Counting and lifecycle decisions

- "Triggers" means scheduled cadence occurrences, **not completed cleanings**. The first theoretical occurrence is 1. Skipping or restoring a task does not reset the counter. Fixed-calendar counts remain anchored to the parent's start, even when an extra is added later.
- A one-off reschedule does not become a new trigger. Manually added exception dates do not increment the cadence count. Excluded calendar dates retain their theoretical position but do not create an extra without an actual parent occurrence at that slot.
- Newly added extras are not backfilled against completed historical work. For existing routines, they attach to eligible scheduled work from the extra's creation day onward.
- Once generated, an extra is independent: completing, skipping, or rescheduling its parent does not silently complete, skip, or move the extra. Use its own actions when needed.
- Parent schedule, timezone, assignment, reminders and lifecycle are inherited. Pausing/ending the parent stops its extras too. Editing an extra does not recreate the parent's tasks; removing it archives its rule and cancels pending extra work while retaining history.
- This release supports one parent/extra level, any number of extra definitions, and an interval of 1-100 occurrences. A one-off routine cannot have repeating extras.
- Completion-relative interval routines use persisted parent trigger ordinals. Their future exact dates cannot be known before the parent is completed; only generated parent occurrences create extras. The child's cleanliness estimate uses N nominal parent intervals between boundaries, rather than assuming future completion timestamps.

## Cleanliness and presentation

Every routine and extra has a **Counts toward cleanliness** control. Off excludes that routine from item, room, home, critical-card and current trend contributions, and completing it applies no cleanliness refresh. Its task, history, stock requirements and reminders remain available. Other active routines for the same item continue contributing. A wholly untracked channel displays Not tracked, not zero.

Changing this control does not rewrite past completions or invent a fresh cleaning when it is enabled again. Pausing and disabling cleanliness participation are different actions.

Overview now has a horizontally scrollable cleanliness rail, channel-labelled critical cards, clearer urgency/today grouping, and a separate Upcoming panel. Numerical percentages and bars remain alongside six mood levels; no mood is shown for Not tracked.

Activity cards use:

```text
Dust the bookshelf
Bookshelf - Dust
```

The first line is the routine's activity title; the second is the item(s) and the selected Action name. Required products show their current Stock status and available quantity in Overview, Home task lists and Start room. The new house/floor-plan icon is included at PWA, maskable, Apple-touch and favicon sizes.

## Verification and deployment checks

Before packaging, all eight pure TypeScript regression suites passed, including the linked-activity tests and all existing Phase 1-4/corrective/state-consistency/Everyone tests. Source syntax, translations, JSON, CSS parsing, service-worker syntax and icon sizes were checked.

**Not verified in this environment:** a full dependency-backed React/Vite production build, live Supabase migration execution, real device push delivery, or a browser-driven end-to-end UI run. The npm registry was unreachable (EAI_AGAIN), so Cloudflare's normal build and the checks below remain necessary. A successful syntax check is not a substitute for a production build.

After deployment, verify a test recurring parent with an every-2 extra; verify the extra's products and independent skip/completion; compare Overview/Home cleanliness with participation off; check Regular/Deep labels; and test both a member reminder and a household reminder. Confirm a child action has its own history and that reopening/refreshing does not duplicate it.
