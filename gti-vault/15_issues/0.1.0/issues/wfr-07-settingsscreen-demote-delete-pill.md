---
issue: wfr-07
title: Demote SettingsScreen DELETE pill to destructive style
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 248
---

# wfr-07 — SettingsScreen destructive DELETE button visually dominates DONE

## What to build

Restyle DELETE MY DATA from white-pill primary (SettingsScreen.swift:127-129) to destructive style (red outline or text-only). Promote DONE to primary pill. Keep existing two-step confirm alert.

## Acceptance criteria

- [ ] DELETE renders in destructive style per `design-system/components.md`.
- [ ] DONE is the visually dominant primary.
- [ ] Snapshot test on SettingsScreen render covers new hierarchy.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Settings Editor]]
- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #7.
