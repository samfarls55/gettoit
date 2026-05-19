---
issue: bug-11
title: Move snapshot/preview fixture factories out of the iOS app target
status: needs-triage
github_issue: 140
created: 2026-05-19
---

# bug-11 — Fixture factories ship fictitious venue names in the app target

## Problem

`VerdictScreen.swift`, `CheckinScreen.swift`, and `LockedScreen.swift` define
their display data structs (`Verdict`, `Plate`) with `static func fixture()`
factories — `fixture()`, `soloFixture()`, `noSurvivorFixture()` — that build
fully-populated sample instances with hardcoded fictitious content (place names
`Pico's Taqueria`, `Ren Soba`, `Café Lou`, `Halal Cart`, sample rule text, etc.).

These factories live in `ios/Sources/App/` — the **shipped app target** — not
the test target. The strings are compiled into the production binary as dead
code.

## Surfaced by

tb-26 (remove fictitious fallback venues). tb-26 deleted `QuizDummyCandidates`,
which was *reachable from a live code path* — the Q5 candidate fetch genuinely
returned it and rendered it to real users. These `fixture()` factories are the
**non-reachable cousins**: the same "hardcoded fictitious venue names in the app
target" smell, but strictly weaker.

## Not user-facing

The factories are `static func`s called only by snapshot tests and SwiftUI
`#Preview` blocks. No production path calls them — the real `VerdictStore`
populates `Verdict` from the database. A user cannot reach them. Risk today is
near-zero; this is a hygiene / tech-debt item, not a defect with user impact.

## Suggested fix (for triage to confirm)

Move the `fixture()` family into the test target (or a preview-only,
non-shipped file) so the app binary carries zero fictitious venue strings.
Wrinkle: the `#Preview` blocks in the screen files likely depend on these
factories — relocating them needs the previews to still resolve, so it is a
small but real change, not a one-liner.

## Acceptance criteria (tentative — triage to finalize)

- [ ] No fictitious venue names remain in the `ios/Sources/App` app target.
- [ ] Snapshot tests and SwiftUI previews still build and pass.
- [ ] The `ios` CI lane is green.

## Triage notes

- Decide whether this is worth actioning at all given near-zero risk.
- If actioned: assign `type: AFK` or `HITL` and a `ready-for-*` status.

## Blocked by

- None.
