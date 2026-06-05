---
issue: bug-04
title: Question transition motion lag â€” gradient ~1s behind card on every transition
github_issue: 44
status: done
type: AFK
created: 2026-05-14
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-04 â€” Question transition motion lag

## Parent

[[../_index|0.1.0 backlog]] candidate #4.

## What's broken

On every question-to-question transition during the quiz, the foreground card advances instantly while the background gradient interpolation lags about a second behind. Reads as broken motion â€” the user has already started reading the new question while the gradient still belongs to the previous one.

User confirmed: the lag happens on **every** question transition, not isolated to a specific Q. Implies the offending CHOREO constant lives in a shared transition primitive used across all question screens, not a per-screen drift.

## Fix scope

Per-screen / per-primitive surgical fix to align the gradient curve's duration with the card transition duration.

- Adjust the gradient interpolation duration to match the card transition duration exactly. Match `ms` values, do not round.

If verification (below) surfaces another offender, fold into the same fix. This is NOT a broader motion review â€” that would be a separate issue.

## Acceptance criteria

- [ ] On a real iOS device, walking the quiz from Q1 through the final question shows no perceptible lag between card transition and gradient interpolation on any transition.

## Resolution

Root cause: the iOS `QuizScreen.swift` content router relied on SwiftUI's default no-animation transition between routed question views, while the background gradient ran a 1100ms ease-in-out tween. The card swapped instantly, the gradient kept moving for another second â€” that's the "~1s lag" the user reported.

Fix: pair the card cross-fade with the gradient ms-exact. `QuizScreen.swift` now re-keys the routed content on `coordinator.step` and applies `.transition(.opacity).animation(...)` with the same `GTIMotion.Duration.gradTween` (1100ms) + `GTIMotion.Easing.inOut` already powering the gradient. Reduced motion drops both layers to 300ms linear in lockstep.

Strategy: **(b) tune card up to match gradient.** The gradient duration is locked in `motion.md` Â§"Gradient surface tween" as the load-bearing "time-of-day" read â€” shortening it would break the narrative the gradient does. Tuning the card up to match keeps both load-bearing behaviors intact. No new motion token (the card aliases `--grad-tween`).

## Blocked by

None â€” can start immediately.

## Adjacencies

- If verification reveals motion mismatches outside the question-transition primitive (e.g. on S01 â†’ Pick a Vertical, or on S05 verdict reveal), surface as a separate follow-up issue. Do not silently expand scope.
