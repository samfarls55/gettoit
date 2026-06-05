---
issue: wfr-22
title: Add Q1..Q5 labels to QuizScreen progress capsules
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 263
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-22 â€” QuizScreen Progress Indicator capsules lack step labels

## What to build

The progress strip (`QuizScreen.swift:184-201`) animates fill state but the capsules are visual-only. Add "Q1 of 5" / step-number labels adjacent to or inside the row so screen readers and sighted users get position.

## Acceptance criteria

- [ ] Step indicator carries human-readable text.
- [ ] VoiceOver reads "Question N of 5".
- [ ] Snapshot test covers Q1..Q5.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Progress Indicator]]
- [[../../30_design/interaction-patterns/surfaces#Do]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #22.

## Comments

- 2026-05-26 â€” AFK shipped on `afk/wfr-22`. Added compact `Q{n} of 5` text under the 5-segment progress capsules in `QuizScreen.topBar`, and bound the locked `"Question {n} of 5"` accessibility label from `design-system/accessibility.md` Â§4 to the combined strip+label element. Two static helpers (`QuizScreen.progressAccessibilityLabel(forStep:)` and `QuizScreen.progressVisibleLabel(forStep:)`) own the copy so tests can pin it without touching the view. Snapshot smoke covers Q1..Q5 render; source-level tests pin the topBar's a11y wiring (same pattern as bug-25 centering test). Decision: chose VStack(capsules, Text) inside the centred slot rather than placing the label adjacent â€” keeps the bug-25 horizontal symmetry intact and the label tracks the same step transitions VoiceOver already announces via the parent label.
