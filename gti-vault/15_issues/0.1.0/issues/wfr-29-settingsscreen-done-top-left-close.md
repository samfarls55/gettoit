---
issue: wfr-29
title: Switch SettingsScreen DONE to iOS top-left close convention
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 270
---

# wfr-29 — SettingsScreen "DONE" label + center placement breaks iOS habituation

## What to build

Replace the bottom-center plain-text "DONE" with a top-leading X icon (or "Close") matching iOS sheet dismissal convention. Combines with [[wfr-07-settingsscreen-demote-delete-pill|wfr-07]] (DELETE demotion). Assumes [[wfr-06-settingsscreen-entry-from-planlist|wfr-06]] (Settings entry point) has landed.

## Acceptance criteria

- [ ] Top-leading close affordance.
- [ ] Tap dismisses sheet.
- [ ] Bottom-center DONE removed.

## Blocked by

- [[wfr-06-settingsscreen-entry-from-planlist|wfr-06]] — Settings entry point.
- [[wfr-07-settingsscreen-demote-delete-pill|wfr-07]] — DELETE demotion. Pair these two so the sheet chrome is coherent on a single review.

## Hub anchors

- [[../../30_design/interaction-patterns/principles#P-07. Habituation]]
- [[../../30_design/interaction-patterns/surfaces#Settings]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #29.
