---
issue: wfr-12
title: Add Home/Back affordance to LockedScreen
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 253
---

# wfr-12 — LockedScreen has no Escape Hatch from terminal state

## What to build

`LockedScreen` renders the verdict-locked state with no path back to PlanList. Add a top-leading or footer "Home" affordance that routes to the post-sign-in PlanList.

## Acceptance criteria

- [ ] Home/Back affordance visible on LockedScreen.
- [ ] Tap dismisses LockedScreen and returns to PlanList via the RootView precedence chain.
- [ ] Snapshot test covers the new chrome.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/principles#P-01. Safe Exploration]]
- [[../../30_design/interaction-patterns/surfaces#Entry]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #12.
