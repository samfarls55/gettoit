---
issue: wfr-08
title: Distinguish primary vs secondary CTA on LocationPermissionScreen
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 249
---

# wfr-08 — LocationPermissionScreen two CTAs share equal visual weight

## What to build

Promote "Share my location" to primary pill (existing white pill). Demote "Enter manually" to secondary text button. Both CTAs currently render in the same pill style.

## Acceptance criteria

- [ ] Primary/secondary distinction visible.
- [ ] Snapshot test covers both states.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]
- [[../../30_design/interaction-patterns/patterns#Clear Entry Points]]
- [[../../30_design/interaction-patterns/surfaces#Entry]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #8.
