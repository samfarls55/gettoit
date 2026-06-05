---
issue: wfr-24
title: Add Input Hints to SetupScreen name, distance, location
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 265
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-24 â€” SetupScreen Form Input Hints missing on name, distance, location

## What to build

- Name field: visible character limit (e.g., "40 chars").
- Distance slider: unit suffix ("mi") on the value label.
- Location field: mark optional with a hint ("Optional â€” we'll prompt later").

## Acceptance criteria

- [ ] Each field carries a visible hint without focus.
- [ ] Hints persist after the user types.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Input Hints]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #24.

## Comments

