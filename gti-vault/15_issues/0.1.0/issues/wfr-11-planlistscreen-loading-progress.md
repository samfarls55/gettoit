---
issue: wfr-11
title: Add Loading/Progress signal to PlanListScreen sections
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 252
---

# wfr-11 — PlanListScreen has no Loading/Progress on initial fetch + refresh

## What to build

PlanListScreen renders empty rows during `refreshPlanList` (RootView line 576 `.task`). Add skeleton rows or section-level `ProgressView` while any of the four fetch tasks is in-flight on first mount.

## Acceptance criteria

- [ ] Skeleton / spinner renders during cold load.
- [ ] No skeleton on hot reload (cached rows already on screen).
- [ ] Snapshot test covers loading state.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Loading or Progress Indicators]]
- [[../../30_design/interaction-patterns/surfaces#Mobile overlay]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #11.
