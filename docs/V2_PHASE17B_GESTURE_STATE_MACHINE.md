# Phase 17B — Active Deck gesture state machine

## Scope/invariants

All gesture state is ephemeral UI state in `src/components/overview/ActiveDeck.tsx`. The pure geometry lives in `src/lib/deckGestures.ts`. The coordinator, task RPCs, recurrence, undo, supplies, notifications, backups, and data schema are not changed. One full `CareCard` is mounted, selected by `${householdId}:${task.id}`; rear cards are two CSS layers with `aria-hidden` and no SVG subtree.

| State | Entry / condition | Pointer or keyboard behavior | Exit and invariants |
|---|---|---|---|
| Idle | Default, no pointer capture | `ArrowLeft/Right` on focused stage or previous/next buttons browse by stable task ID; Complete/More remain independent buttons | Pointer-down on noninteractive front-card area -> Tracking; button click -> existing action callback only |
| Tracking | Primary left-button/touch contact over front card, pointer captured by stage | Await >=9px movement and a clear 1.18 axis ratio. Do not mutate the card, UI data, or task state | Vertical -> native scroll/cancel; horizontal -> Dragging; release without decision -> Idle |
| Dragging | Horizontal axis decided | Direct DOM compositor transform (`translate3d` + max 7deg rotation), bounded X to min(220px, 58% of width) and Y to 22px. Rear CSS shifts subtly. No React state update per movement | `pointerup` -> Release; `pointercancel` or identity removal -> settle/reset |
| Release | Valid horizontal pointerup | Last 85ms / <=10 samples estimate velocity. Direct displacement threshold min(112px, max(62px, 27% width)); else projected displacement with max 128px inertia and min 22px real movement / velocity >=0.48px/ms | Direction chosen -> Outgoing; otherwise -> Returning |
| Returning | Below threshold or cancelled | Bounded, light spring overshoot (duration 210–310ms). `prefers-reduced-motion` resets instantly. New swipe can cancel the return | Idle or Tracking on new contact |
| Outgoing | Navigation requested by swipe | Front exits in release direction, easing with duration dependent on release speed (140–260ms), and selection is changed only once after outgoing motion | New identity -> Incoming; external removal/household switch -> cancel/reset. Prevent parallel outgoing transitions |
| Incoming | Target ID committed | One incoming transition with slight 13px overshoot (330ms), no new heavyweight rear cards; can be interrupted for rapid successive swipes | Idle or Tracking |
| Cancelled/reconciled | Lost capture, pointercancel, household change, selected task removed/filtered | Clean up capture/animation/transform. Retain selected ID on reorder, or select closest surviving neighbor if deleted; stale outgoing completion checks the original active key | Idle, same household only |

### Event and safety rules

- Touch scroll remains `touch-action: pan-y`. Vertical gestures are not converted into navigation. Mouse and touch are both handled through Pointer Events; only the primary pointer and primary button start a drag.
- Events starting on buttons, links, inputs or dialog controls are excluded. Stage `click` capture suppresses the synthetic click from a completed drag, and a new deliberate press clears stale suppression. Task completion, Skip, More and Undo are **never invoked by `navigate()`**.
- Motion is disabled via `prefers-reduced-motion`; swiping still changes selection instantly, without transforms. Buttons and keyboard remain usable. An EN/IT screen-reader instruction describes both methods.
- Data refresh with unchanged selected ID may update its details without remounting the card. Filtering, Undo or completion removing the selected occurrence picks an adjacent surviving ID. Switching households always invalidates the prior selection and animation.
- No Supabase calls, polling, React state updates per pointer move, database writes, or generated art during drag. No GPU/frame-rate performance claim without device measurements.
- Returning/outgoing animation timing is decorative. The task state and navigation are never persisted, and physical swipes are nondestructive.

## Acceptance concerns requiring an actual browser

Pixel-accurate pointer-capture behavior, scroll/drag arbitration, synthesized click ordering, low-power frame timing, stale data refresh mid-swipe, installed PWA touch behavior, device memory, and long-label/compact-screen overflow require the real-app Playwright runner or device checks. Pure tests assert geometry, thresholds, ID selection, and the nonmutation code contract only.
