---
issue: wfr-28
title: Improve Action Dot Menu discoverability on PlanListScreen
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 269
---

# wfr-28 — PlanListScreen Action Dot Menu has no discoverability affordance

## What to build

The Action Dot Menu (three-dot affordance on Pending Created cards) is currently invisible until tapped. Either raise its visual weight (slightly higher contrast / dedicated chrome glyph), or add a long-press affordance with a visible hint on first launch.

Full autonomy on which lever to pull. Pick the simpler ship.

## Acceptance criteria

- [ ] Dot menu visually distinct on every Created card.
- [ ] First-launch hint or improved icon contrast.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Touch Tools]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #28.
