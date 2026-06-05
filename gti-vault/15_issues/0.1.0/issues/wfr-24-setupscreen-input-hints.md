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

- 2026-05-26 â€” Closed via PR #302. Added three adjacent Input Hints to `ios/Sources/App/SetupScreen.swift`: `Up to 40 characters` under the name field, `Optional â€” we'll prompt later` under the C-23 LocationPicker, and `From your location, in miles` under the C-21 distance slider. Copy lives behind three pure static helpers (`nameHintCopy()` / `whereToHintCopy()` / `distanceHintCopy()`) so the canonical strings are pinned by unit tests + reused by the view body. Hint treatment is the existing `body` token at 14pt regular + `TextOnGradient.tertiary` (white-at-0.55) â€” smaller and lighter than the eyebrow (11pt bold UPPERCASE) per `patterns.md` Â§"Input Hints". The original `surfaces/01-setup.md` "no truncation indicator" line is now explicitly overridden by this finding; the surface doc gained a new Â§"Input hints" section listing all three. JSX spec mirrored to keep design-system â†” iOS in lockstep.
