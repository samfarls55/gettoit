---
issue: wfr-09
title: Add text+icon affordance to SetupScreen disabled CTA
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 250
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
