---
issue: wfr-27
title: Add Loading indicator to WaitingScreen chip-phase load
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 268
---

# wfr-27 — WaitingScreen has no Loading/Progress signal during initial chip-phase load

## What to build

The `.loading` chip phase (`WaitingScreen.swift:100-151`) currently renders nothing. Add a `ProgressView` or subtle skeleton so the surface signals "data coming" instead of looking dead.

## Acceptance criteria

- [ ] ProgressView or skeleton visible during `.loading`.
- [ ] Snapshot test covers loading state.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Loading or Progress Indicators]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #27.
