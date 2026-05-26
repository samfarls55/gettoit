---
issue: wfr-17
title: Add initiator Leave path on WaitingScreen
status: ready-for-agent
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
