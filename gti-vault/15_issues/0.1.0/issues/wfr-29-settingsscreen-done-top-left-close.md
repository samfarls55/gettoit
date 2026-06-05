---
issue: wfr-29
title: Switch SettingsScreen DONE to iOS top-left close convention
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 270
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-29 â€” SettingsScreen "DONE" label + center placement breaks iOS habituation

## What to build

Replace the bottom-center plain-text "DONE" with a top-leading X icon (or "Close") matching iOS sheet dismissal convention. Combines with [[wfr-07-settingsscreen-demote-delete-pill|wfr-07]] (DELETE demotion). Assumes [[wfr-06-settingsscreen-entry-from-planlist|wfr-06]] (Settings entry point) has landed.

## Acceptance criteria

- [ ] Top-leading close affordance.
- [ ] Tap dismisses sheet.
- [ ] Bottom-center DONE removed.

## Blocked by

- [[wfr-06-settingsscreen-entry-from-planlist|wfr-06]] â€” Settings entry point.
- [[wfr-07-settingsscreen-demote-delete-pill|wfr-07]] â€” DELETE demotion. Pair these two so the sheet chrome is coherent on a single review.

## Hub anchors

- [[../../30_design/interaction-patterns/principles#P-07. Habituation]]
- [[../../30_design/interaction-patterns/surfaces#Settings]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #29.

## Comments

