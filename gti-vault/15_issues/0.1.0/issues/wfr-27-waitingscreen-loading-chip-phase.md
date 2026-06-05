---
issue: wfr-27
title: Add Loading indicator to WaitingScreen chip-phase load
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 268
pr: 304
merged: 2026-05-26
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-27 â€” WaitingScreen has no Loading/Progress signal during initial chip-phase load

## What to build

The `.loading` chip phase (`WaitingScreen.swift:100-151`) currently renders nothing. Add a `ProgressView` or subtle skeleton so the surface signals "data coming" instead of looking dead.

## Acceptance criteria

- [x] ProgressView or skeleton visible during `.loading`.
- [x] Snapshot test covers loading state.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Loading or Progress Indicators]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #27.

## Comments

### 2026-05-26 â€” Done (PR #304)

Shipped a `ProgressView` in the WaitingScreen CTA dock, gated on `phase == .loading`. The indicator sits in situ where the AuthUpgradeChip will land (per the *Loading or Progress Indicators* pattern: "Place the indicator in situ â€” where the missing content will appear â€” not in a generic top bar"). Hides the moment the chip-phase resolves to any other state so the spinner doesn't leak.

**Autonomy calls:**

- Chose `ProgressView` over skeleton â€” the chip slot is one capsule, not a content-shaped block, so a skeleton would mislead about the resolved chip's shape. Spinner sits cleanly in the same vertical real estate.
- Tinted `GTIColor.TextOnGradient.primary` to match the existing `quiz.q5.loading` / `submitting` ProgressView idiom in QuizScreen.
- Reserved `minHeight: 44` so the slot doesn't visibly jump when the indicator gives way to the resolved chip.
- Extracted the visibility rule as a public static predicate (`shouldRenderChipLoadingIndicator(for:)`) so the test covers every `ChipPhase` without spinning up a SwiftUI body. Mirrors the locked-constant / pure-helper idiom from `leaveChromeLabel` (wfr-17) and `sessionEndedToastLabel` (bug-37).
- Locked accessibility id as `waiting.chip.loading` (matches the `<surface>.<region>.<role>` convention).
