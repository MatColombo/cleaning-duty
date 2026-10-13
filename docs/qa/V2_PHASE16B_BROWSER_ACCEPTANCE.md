# Phase 16B — Browser/PWA acceptance (to run; not marked passed)

**Environment prerequisite:** isolated V2 staging household after approved SQL migration and deliberate activation. Keep a separate unactivated household for V1 parity. Build/serve the real app with dependencies; test actual mobile browser and installed PWA.

| ID | Scenario & steps | Expected acceptance | Status |
|---|---|---|---|
| B01 | Create linked Extra Care every 4 primary occurrences; open primary #4 in Overview | Single primary Care Card; compact Extra Care appendix + supplies; no independent child card or Complete | Not run |
| B02 | Open primary #4 `...`; postpone Extra Care; inspect #5 | #4 appendix suppressed; #5 due (not #8); keyboard/touch focus readable | Not run |
| B03 | Repeat postponement on #5; inspect #6 | #6 due; no secondary card/actions | Not run |
| B04 | Complete #6, then open #8 | #6 one Extra completion; #8 ordinary due Extra still exists; no double count | Not run |
| B05 | Create collision where postponed Extra and next regular trigger coincide | One due appendix, one completion/event/effect only | Not run |
| B06 | Complete #4 without touching Extra controls | Primary and Extra completed together; two attributed events; changes Regular/Deep cleanliness appropriately | Not run |
| B07 | Undo primary completion from banner, then reload | Primary and Extra open again, cleanliness exactly restored; no duplicate Extra history | Not run |
| B08 | Skip primary while Extra due, then inspect next primary | Extra not completed, remains owed; no cleanliness effect | Not run |
| B09 | Reassign and reschedule primary in task `...` | Extra stays linked to same occurrence ordinal, assignment and notification behavior preserved | Not run |
| B10 | Pause/archive Extra then resume; archive/restore workspace | No false completion, obligation/history retained when applicable | Not run |
| B11 | Miss due parent; open next primary; use same household concurrently on two devices | Outstanding Extra due once; stale version rejected/recoverable; never silent dual completion | Not run |
| B12 | Complete parent, immediately update required supply; drop Wi-Fi, reload, reconnect | Both ops visible/durable/order-preserved; no duplicate events/supplies | Not run |
| B13 | Complete then Undo while first request delayed; reload/refresh | Final scheduled state correct, Extra reversed and no double effects | Not run |
| B14 | Overview, Timeline, Home room mode, notifications, deep link to older child, Analysis/history | Parent-only actionable cards; existing child history readable; old child link leads safely to parent; Extra attribution visible | Not run |
| B15 | EN/IT, small phone, large text, reduced motion, keyboard, touch, screen reader | `...` accessible, appendix labeled, no inaccessible off-screen controls | Not run |
| B16 | Import schema 8/9 backup locally, including legacy completed child; export/reopen | Child history preserved, outstanding carry maps correctly, no independent V2 child operation | Not run (domain automated tests passed) |
| B17 | Attempt cloud import into activated household; attempt ledger-bearing backup into legacy cloud household | Before destructive reset, explicit error; no data changed | Not run |
| B18 | Use legacy V1 app on unactivated household; then try V1 write on activated linked task | Unactivated unchanged; activated task mutation rejected; note configuration mixed-client limitation | Not run |
| B19 | Logout/switch household with unsent Complete+Extra | Queue remains user+household scoped; no leaking or losing data; restore needs exclusive queue | Not run |
| B20 | Staging SQL RLS: owner/member/outsider and duplicate RPC replay | Only authorized members read/act; duplicate event does not double apply | Not run |

**Capture evidence:** screenshots of Overview due/completed, task `...`, Timeline old child/history, Home room mode, Analysis; network HAR/RPC results, DB event/snapshot rows, console logs, browser/PWA device/version, EN/IT and accessibility notes. Do not claim device/E2E completion without these artifacts. No Realtime or background polling should be observed.
