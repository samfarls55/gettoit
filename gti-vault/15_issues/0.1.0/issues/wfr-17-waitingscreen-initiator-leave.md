---
issue: wfr-17
title: Add initiator Leave path on WaitingScreen
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 258
---

# wfr-17 — WaitingScreen initiator has no Leave affordance

## What to build

Once the initiator has submitted Q5 and lands on Waiting, there is no path to back out. Add a chrome Leave button that triggers room-expire (existing `MemberLeaveStore` path) and returns to PlanList.

## Acceptance criteria

- [ ] Leave chrome visible on WaitingScreen for initiator role.
- [ ] Tap expires the room and routes back to PlanList.
- [ ] Snapshot test covers chrome present + tap behaviour.

## Blocked by

None — ships as a chrome-only add now.

**Entanglement (soft):** finding #5 in the workflow-review run report ([[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]]) is a grill on WaitingScreen's session-ended state machine. If the grill formalises a session-ended transition, the Leave-fires-room-expire wiring should be revisited against the new state machine. Ship now, revisit if/when the grill resolves.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/principles#P-01. Safe Exploration]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #17.

## Comments

- **2026-05-26 (AFK close)** — Shipped on `afk/wfr-17`. Adds a top-leading text-verb `Leave` chrome to the S04 Waiting surface, visible only to the initiator (view-layer guard on `WaitingStore.isInitiator`). Tap fires a new `MemberLeaveStore.leaveAndExpire(roomID:userID:)` method that drops the initiator's `members` row AND marks `rooms.status = 'expired'`, then clears `postQuizHost` so the RootView precedence chain returns the user to S00 Plan list. Distinct from the existing `leave(role:isSolo:)` path because the S04 Waiting Leave semantics are "end the session for everyone" — the verdict can no longer fire without the initiator's `Decide now` tap, so a non-solo initiator leaving Waiting must expire the room. Invitees never see the chrome; their session-end path remains the Plan-list Leave-plan row. Tests cover: `MemberLeaveStore.leaveAndExpire` runs DELETE then UPDATE (and a failed DELETE suppresses the UPDATE), `WaitingScreen.leaveChromeLabel == "Leave"`, initiator tap fires `onLeave` once, invitee tap is a no-op, and `PostQuizHostScreen.onLeaveWaiting` forwards correctly. The entanglement noted in `## Blocked by` (finding #5 / WaitingScreen session-ended state machine) remains soft — when the grill resolves into the formal state machine ([[bug-37-waitingscreen-session-ended-handler|bug-37]]), the Leave-fires-room-expire wiring can be revisited against the new transitions.
