# House Care v1.2.0-r4 — assignment semantics + Home panning

## What changed

### Explicit assignment semantics

Assignments now have three distinct runtime meanings:

- **Specific person** — the occurrence is assigned to that member. If the Routine has a reminder, the push is delivered to that member's enabled devices.
- **Everyone / household** — there is still one shared occurrence, but its reminder is broadcast to every active household account. Each recipient receives the push on every enabled device registered to that member. Completing the shared occurrence resolves it for the household.
- **Unassigned** — no person is selected. The occurrence remains actionable, but no push notification job is created until it is reassigned to a person or Everyone.

The distinction is persisted on each occurrence as `assignment_scope`, so a one-occurrence reassignment is independent from later Routine edits.

### Home layout panning

The Home layout camera can now be panned by dragging. Outside Edit mode the drag may begin over empty layout space, a room, or an object. A short tap/click still selects the underlying item. In Edit mode, dragging an element continues to move/resize it while dragging the background pans the layout. The existing zoom controls and Fit Layout action remain available.

## Supabase update

Run this migration once, **before deploying the new web build**:

`supabase/migrations/20260831203000_v1_2_0_everyone_notifications.sql`

It adds `task_occurrences.assignment_scope`, backfills existing occurrences, updates the task-mutation/Undo RPCs, and updates reminder scheduling so `everyone` creates one notification job per active household account while `unassigned` creates none.

The migration intentionally does not bulk-rebuild existing reminder jobs, so currently valid person-specific reminders are not disturbed during the short deployment window.

## Edge Function update

After the SQL migration, redeploy the packaged existing Edge Function:

`supabase/functions/send-push/index.ts`

Keep **Verify JWT disabled**, as before. Do not change `CRON_SECRET`, VAPID keys, Supabase secrets, or the cron schedule.

The updated function validates both person-specific and Everyone recipients and retains the v1.2 notification format:

```text
Routine name
Action
Target(s)
```

## Web deployment

After SQL + Edge Function deployment, replace the repository contents with this package and push to the existing GitHub branch. Cloudflare can rebuild normally.

The service-worker cache version is `v1.2.0-r4`.

## Recommended checks

1. Create/edit a Routine and confirm the Who choices visibly distinguish **Everyone / household** and **Unassigned**.
2. Give an Everyone Routine a reminder and confirm every active household account with push enabled receives the same shared-task notification.
3. Confirm the task is still represented by one occurrence, not duplicated per member.
4. Reassign an occurrence from a named member to Everyone, then to Unassigned; confirm the labels and reminder behavior change accordingly.
5. Confirm an Unassigned occurrence does not generate a push reminder.
6. In Home, zoom in and drag the floor plan from a room/object and from empty space; confirm it pans rather than losing the selected geometry.
7. Tap/click a room without dragging and confirm it still opens the below-layout details.
8. Press the zoom percentage/Fit Layout control and confirm panning resets to the fitted layout.

## Verification in this package

- Phase 1 regression suite: pass.
- Phase 2 regression suite: pass.
- Phase 3 regression suite: pass.
- Phase 4 regression suite: pass.
- Corrective regression suite: pass.
- State-consistency regression suite: pass.
- New Everyone-assignment regression suite: pass.
- Source TS/TSX syntax/transpile check: pass.
- EN/IT translation-key parity: pass.
- CSS structural check: pass.
- Service-worker syntax check: pass.

A full Vite production build could not be executed in the packaging environment because dependency installation timed out; Cloudflare remains the final dependency-install/build verification step.
