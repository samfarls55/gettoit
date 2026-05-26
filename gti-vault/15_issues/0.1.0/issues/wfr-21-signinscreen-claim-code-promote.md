---
issue: wfr-21
title: Promote claim-code affordance on SignInScreen
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 262
---

# wfr-21 — SignInScreen claim-code affordance buried

## What to build

The claim-code path renders as a quiet eyebrow-token link under the Apple pill. Promote it to a clearly secondary action so users with an existing code can find it without scanning the page.

## Acceptance criteria

- [ ] Claim affordance renders as a labeled secondary button or chip.
- [ ] Snapshot test covers both Apple-only and Apple+claim renders.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Clear Entry Points]]
- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #21.
