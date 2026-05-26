---
issue: wfr-15
title: Add Cancel affordance to CheckinScreen choice phase
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 256
---

# wfr-15 — CheckinScreen has no Cancel on choice surface

## What to build

Before the user taps a checkin outcome, there is no path to abandon. Add a top-leading "Cancel" chrome glyph.

## Acceptance criteria

- [ ] Cancel visible on choice phase.
- [ ] Tap dismisses without writing a checkin.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #15.
