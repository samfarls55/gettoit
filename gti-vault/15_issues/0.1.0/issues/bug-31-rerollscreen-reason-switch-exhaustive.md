---
issue: bug-31
title: Enumerate Reason enum cases in RerollScreen.handleSubmit switch
status: done
type: AFK
github_issue: 240
created: 2026-05-25
merged: 2026-05-26
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-31 â€” RerollScreen.handleSubmit switch uses default for in-module enum

## Symptom

`ios/Sources/App/RerollScreen.swift:498-508` switches over `Reason` (in-module enum, 5 cases: `.cost`, `.dist`, `.mood`, `.diet`, `.avail`), handles `.mood` and `.diet` explicitly, and lumps `.cost` / `.dist` / `.avail` under `default:`. Surfaced by `/swift-code-review` 2026-05-25 against `CODING_STANDARDS.md` rule **ENUM-002** (S2 â€” robustness). A future case addition to `Reason` will compile silently into the no-op `default:` branch instead of surfacing a compiler warning.

```swift
switch reason {
case .mood:  vibeOrNil = newVibe; chipOrNil = nil
case .diet:  vibeOrNil = nil; chipOrNil = selectedDietChip.rawValue
default:     vibeOrNil = nil; chipOrNil = nil
}
```

## Fix scope

Replace `default:` with an explicit case list:

```swift
case .cost, .dist, .avail:
    vibeOrNil = nil
    chipOrNil = nil
```

Touches one private method in one file. No callers affected.

## Acceptance criteria

- [ ] `RerollScreen.handleSubmit()` switch lists every `Reason` case explicitly; no `default:`.
- [ ] Behaviour unchanged: existing reroll-screen tests pass with no edits (`ios/Tests/RerollScreenSnapshotTests.swift`, `ios/Tests/VerdictRerollHostTests.swift`, and any other reroll coverage).
- [ ] iOS build green.

## Brief for AFK agent

Full autonomy on:
- Whether to keep the three non-vibe / non-chip cases combined in one `case .cost, .dist, .avail:` clause or split into three single-case clauses. Combined is closer to the current shape.

Out of scope:
- Other switch statements in the file. Only the `handleSubmit` switch was flagged.

## References

- `ios/Sources/App/RerollScreen.swift:492-510` â€” `handleSubmit`.
- `CODING_STANDARDS.md` rule ENUM-002.

## Surfaced by

`/swift-code-review` against `ios/`, 2026-05-25.

## Comments

- 2026-05-26 â€” AFK execution merged (PR [#243](https://github.com/samfarls55/gettoit/pull/243), squash commit `59c7530`). One-line refactor: `default:` in `RerollScreen.handleSubmit()`'s `switch reason` replaced with explicit `case .cost, .dist, .avail:` (combined-clause shape per the brief's "closer to the current shape" guidance). Behaviour unchanged â€” all existing reroll tests (`RerollScreenSnapshotTests`, `VerdictRerollHostTests`) pass with no edits. CI `ios (xcodebuild test)` green in 3m51s, all other lanes green. Compile-time safety net is now in place: a future `Reason` case addition will trigger a switch-exhaustiveness warning instead of silently compiling into the no-op branch.
