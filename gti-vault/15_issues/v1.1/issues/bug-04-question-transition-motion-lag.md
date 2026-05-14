---
issue: bug-04
title: Question transition motion lag — gradient ~1s behind card on every transition
github_issue: 44
status: ready-for-agent
type: AFK
created: 2026-05-14
prd: v1-prd
---

# bug-04 — Question transition motion lag

## Parent

[[../_index|v1.1 backlog]] candidate #4.

## What's broken

On every question-to-question transition during the quiz, the foreground card advances instantly while the background gradient interpolation lags about a second behind. Reads as broken motion — the user has already started reading the new question while the gradient still belongs to the previous one.

User confirmed: the lag happens on **every** question transition, not isolated to a specific Q. Implies the offending CHOREO constant lives in a shared transition primitive used across all question screens, not a per-screen drift.

## Fix scope

Per-screen / per-primitive surgical fix to align the gradient curve's duration with the card transition duration.

- Identify the offending `CHOREO` constants in `design-system/code/screens/` — likely in the question-screen primitives (the shared transition wrapper if one exists, or each `ScreenQNN.jsx` if duplicated).
- Adjust the gradient interpolation duration to match the card transition duration exactly. Match `ms` values, do not round.
- Per [[../../../../CLAUDE|root CLAUDE.md]] design-system rules: never inline raw durations / easing literals — values come from existing tokens or, if a new motion token is needed, register in `tokens.json` first.

If verification (below) surfaces another offender, fold into the same fix. This is NOT a broader motion review — that would be a separate issue.

## Acceptance criteria

- [ ] On a real iOS device, walking the quiz from Q1 through the final question shows no perceptible lag between card transition and gradient interpolation on any transition.
- [ ] `node design-system/scripts/verify.mjs` green.
- [ ] `design-system/CHANGELOG.md` entry referencing this issue.
- [ ] If a new motion token was introduced (rather than tuning an existing one), `design-system/motion.md` updated.

## Blocked by

None — can start immediately.

## Adjacencies

- If verification reveals motion mismatches outside the question-transition primitive (e.g. on S01 → Pick a Vertical, or on S05 verdict reveal), surface as a separate follow-up issue. Do not silently expand scope.
