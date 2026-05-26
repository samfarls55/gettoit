---
issue: wfr-24
title: Add Input Hints to SetupScreen name, distance, location
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 265
---

# wfr-24 — SetupScreen Form Input Hints missing on name, distance, location

## What to build

- Name field: visible character limit (e.g., "40 chars").
- Distance slider: unit suffix ("mi") on the value label.
- Location field: mark optional with a hint ("Optional — we'll prompt later").

## Acceptance criteria

- [ ] Each field carries a visible hint without focus.
- [ ] Hints persist after the user types.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Input Hints]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #24.
