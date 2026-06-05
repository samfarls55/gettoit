---
issue: wfr-26
title: Add persistent label to SetupScreen name field
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 267
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-26 â€” SetupScreen name field uses placeholder-as-label (anti-pattern)

## What to build

`SetupScreen.swift:484-502` uses the prompt as the only label. Once the user starts typing the label disappears. Add a persistent floating label or a static label above the field.

## Acceptance criteria

- [x] Label persists during and after typing.
- [x] VoiceOver reads the label.
- [x] Snapshot test covers empty + typed states.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Input Prompt]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #26.

## Comments

