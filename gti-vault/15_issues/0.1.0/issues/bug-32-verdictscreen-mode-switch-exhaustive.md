---
issue: bug-32
title: Enumerate verdict mode cases in VerdictScreen.modeSnapshot switch
status: done
type: AFK
github_issue: 241
created: 2026-05-25
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-32 â€” VerdictScreen.modeSnapshot switch uses default for in-module mode enum

## Symptom

`ios/Sources/App/VerdictScreen.swift:949-955` switches over `mode` (in-module enum), explicitly handles `.noSurvivor` and `.readOnly`, and routes the remaining cases (`.solo`, `.committed`, `.default` if present) under `default:`. An inline comment claims "Solo intentionally falls through to the default copy" â€” but `.committed` ALSO falls through silently, with no comment acknowledging it. Surfaced by `/swift-code-review` 2026-05-25 against `CODING_STANDARDS.md` rule **ENUM-002** (S2 â€” robustness).

```swift
let eyebrow: String
switch mode {
case .noSurvivor: eyebrow = "Tonight"
case .readOnly:   eyebrow = "Tonight's verdict"
// Solo intentionally falls through to the default copy â€” the
// singular voice still produced a verdict.
default:          eyebrow = "Tonight, the verdict is"
}
```

## Fix scope

Replace `default:` with an explicit case list that names every mode currently routed to the fall-through copy. Drop the misleading inline comment.

```swift
case .solo, .committed, .default:
    eyebrow = "Tonight, the verdict is"
```

(Adjust the case list to whatever `mode` actually enumerates â€” read the `Mode` enum declaration in the same file before editing.)

Touches one computed property in one file.

## Acceptance criteria

- [ ] `VerdictScreen.modeSnapshot` `switch mode { ... }` over `eyebrow` lists every case explicitly; no `default:`.
- [ ] `eyebrow` value identical for each mode vs. before the change (covered by existing `VerdictScreenSnapshotTests`, `VerdictScreenReadOnlyTests`, `VerdictScreenNoSurvivorTests`, `VerdictScreenSoloTests` â€” confirm green).
- [ ] iOS build green.

## Brief for AFK agent

Full autonomy on:
- Whether to bundle all fall-through cases in one combined `case` clause or split them â€” combined matches the current shape with one branch.
- Whether to leave any per-case TODO comments if any mode's copy is plausibly going to diverge soon.

Out of scope:
- The `if isReadOnly ... else if isNoSurvivor ... else if isCommitted ...` ladder lower in the same property â€” that's a separate refactor (and uses bool flags, not switch).
- Other switches in `VerdictScreen.swift`.

## References

- `ios/Sources/App/VerdictScreen.swift:940-970` â€” `modeSnapshot` computed property.
- `CODING_STANDARDS.md` rule ENUM-002.

## Surfaced by

`/swift-code-review` against `ios/`, 2026-05-25.

## Comments

- 2026-05-26 â€” Closed via PR #245 (squash-merged to main, all CI green including `ios (xcodebuild test)`). Replaced `default:` in `VerdictScreen.modeSnapshot`'s eyebrow switch with explicit `case .default, .committed, .solo:`; dropped the solo-only fall-through comment. Added a `.committed` eyebrow lock test (`VerdictScreenRatifyTests.testCommittedEyebrowMatchesDefault`) to cover the previously-implicit case. iOS Mode enum cases: `.default`, `.committed`, `.readOnly`, `.noSurvivor`, `.solo` â€” all five now enumerated. Existing eyebrow assertions for the other modes were already present and stayed green.
