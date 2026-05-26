---
issue: wfr-13
title: Add Cancel affordance to PostQuizHost resolving phase
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 254
---

# wfr-13 — PostQuizHostScreen resolving spinner has no Escape Hatch

## What to build

While the post-Q5 router polls `verdicts`, the user is trapped on a spinner. Add a "Cancel" or "Back to plan" affordance (top-trailing) that fires `host.teardown()` + clears `postQuizHost`.

## Acceptance criteria

- [ ] Cancel affordance visible during `.resolving` phase.
- [ ] Tap returns to PlanList without firing the verdict.
- [ ] Snapshot test covers the resolving phase with chrome.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/principles#P-01. Safe Exploration]]
- [[../../30_design/interaction-patterns/surfaces#Do]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #13.
