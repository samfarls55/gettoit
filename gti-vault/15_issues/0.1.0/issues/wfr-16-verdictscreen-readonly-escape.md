---
issue: wfr-16
title: Restore Escape affordance on VerdictScreen .readOnly
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 257
pr: 289
merged: 2026-05-26
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-16 â€” VerdictScreen .readOnly mode suppresses Home chrome

## What to build

`.readOnly` currently hides the Home chrome row (`VerdictScreen.swift:391-413`). Add a "Close" or "Done" affordance that fires the existing `onAdvance` callback â€” for the late-joiner branch this opens Solo Setup (the existing re-invite CTA), but the chrome should be visible regardless.

## Acceptance criteria

- [x] `.readOnly` mode renders a Close/Done affordance.
- [x] Tap fires `onAdvance`.
- [x] Snapshot test covers `.readOnly` render with chrome.

## Blocked by

None â€” ships as a chrome-only add now.

**Entanglement (soft):** finding #1 in the workflow-review run report ([[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]]) is a grill on VerdictScreen's 5-mode collapse. If that grill splits `.readOnly` out into its own surface, this chrome add migrates there cleanly. Ship now, revisit if/when the grill resolves.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/surfaces#Focus]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #16.

## Comments

