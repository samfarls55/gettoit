---
issue: wfr-09
title: Add text+icon affordance to SetupScreen disabled CTA
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 250
pr: 278
---

# wfr-09 — SetupScreen disabled CTA uses opacity only

## What to build

When primary CTA is disabled (SetupScreen.swift lines 628, 644, 656, 664), swap label to "Name required" or add a small disabled icon. Opacity-only fails for low-vision and colorblind users.

## Acceptance criteria

- [ ] Disabled CTA carries a visible label change or icon.
- [ ] Snapshot test covers disabled + enabled states.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/principles#V-02. Color]]
- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #9.

## Comments

- 2026-05-26 — Closed via PR #278. Both dock CTAs now swap their visible label to `Name your plan` / `NAME YOUR PLAN` when the `nameValid` gate is false; opacity dimming retained as a complementary cue. Voice register stays warm-friend (not `Name required`). Wired through pure `primaryLabelToDisplay` / `secondaryLabelToDisplay` helpers so the disabled label and `.disabled(...)` modifier share a single `nameValid` source of truth. Pure-logic coverage in `SetupScreenTests`; render-smoke coverage of both disabled + enabled dock states in `SetupScreenRenderTests` (per the codebase's snapshot-equivalent convention — pixel-snapshot tooling not yet on the iOS dependency graph, same pattern `QuizScreenSnapshotTests` uses).
