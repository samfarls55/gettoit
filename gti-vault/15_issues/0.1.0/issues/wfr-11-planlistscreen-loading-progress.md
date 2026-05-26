---
issue: wfr-11
title: Add Loading/Progress signal to PlanListScreen sections
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 252
pr: 284
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

## Comments

- 2026-05-26 — Closed via PR #284. `PlanListScreen` gained an `isLoading` init param (default `false`) and a pure-helper `isColdLoading(...)` that gates a new branch in `body`. Cold load (`isLoading=true` AND all four buckets empty) renders a `Pending` section header over three glass placeholder rows (`GTIRadii.card` + `GTIColor.Glass.fillSoft`, 64pt minHeight, no animation per `motion.md`'s no-pulse register). Hot reload (`isLoading=true` with any cached row already on screen) keeps the populated state visible — per the pattern-hub's "skeleton placeholders for content that has a known shape" + the anti-pattern callout against swapping already-painted content for a loader. `RootView` flips `@State isLoadingPlanList` around `refreshPlanList`; `defer` clears the flag on every exit path so a four-fetch failure falls through to the empty hero rather than getting stuck on a permanent skeleton. Stable accessibility id `planList.loading.container` + locked copy (`"Loading"` eyebrow, `"Loading your plans"` VO label). Snapshot/render coverage in `PlanListScreenLoadingTests` (codebase's snapshot-equivalent convention — pixel snapshot tooling not yet on the iOS dependency graph, same pattern `PlanListScreenRenderTests` uses).
