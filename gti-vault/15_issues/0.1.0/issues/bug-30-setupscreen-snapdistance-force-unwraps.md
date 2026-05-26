---
issue: bug-30
title: Replace force-unwraps in SetupScreen.snapDistance
status: done
type: AFK
github_issue: 239
created: 2026-05-25
merged: 2026-05-26
---

# bug-30 — SetupScreen.snapDistance force-unwraps

## Symptom

`ios/Sources/App/SetupScreen.swift:103-104` force-unwraps `distanceSteps.first!` and `distanceSteps.last!`. Surfaced by `/swift-code-review` 2026-05-25 against `CODING_STANDARDS.md` rule **OPT-001** (S1 — correctness/safety).

```swift
public static func snapDistance(_ value: Double) -> Double {
    if value <= distanceSteps.first! { return distanceSteps.first! }
    if value >= distanceSteps.last! { return distanceSteps.last! }
    ...
}
```

`distanceSteps` is a `static let` literal so the unwrap cannot crash in practice — but the standards rule still wants the `!` removed (or wrapped in `!!` per OPT-002 if a documented trap is preferred).

## Fix scope

Replace both force-unwraps with `??` fallbacks. Use `0` as the floor fallback and `Self.maxDistanceMiles` as the ceiling fallback (both already defined adjacent in the same struct). Body becomes:

```swift
let firstStop = distanceSteps.first ?? 0
let lastStop = distanceSteps.last ?? Self.maxDistanceMiles
if value <= firstStop { return firstStop }
if value >= lastStop { return lastStop }
```

Touches one method in one file.

## Acceptance criteria

- [ ] No `!` force-unwraps remain in `SetupScreen.snapDistance(_:)`.
- [ ] `snapDistance` returns identical values for the existing test cases in `ios/Tests/SetupScreenTests.swift` / `ios/Tests/SetupScreenRenderTests.swift` (whichever covers slider snap behaviour). If no existing coverage, add a small test that asserts:
  - `snapDistance(-1) == distanceSteps.first`
  - `snapDistance(100) == distanceSteps.last`
  - `snapDistance(distanceSteps[2]) == distanceSteps[2]`
- [ ] iOS build green (`xcodebuild` lane via CI).

## Brief for AFK agent

Full autonomy on:
- Whether to inline the fallback constants or hoist into private static lets.
- Whether to add new tests or rely on existing coverage.

Out of scope:
- Other force-unwraps elsewhere in the codebase. Repo-wide grep already confirmed only these two `!` sites remain (no `try!` / `as!` anywhere).
- Re-architecting `distanceSteps` storage.

## References

- `ios/Sources/App/SetupScreen.swift:95-115` — `snapDistance` definition.
- `CODING_STANDARDS.md` rule OPT-001, OPT-002.
- `gti-vault/15_issues/_runs/2026-05-25-*-swift-code-review.md` — run note (to be written by skill).

## Surfaced by

`/swift-code-review` against `ios/`, 2026-05-25.

## Comments

### 2026-05-26 — done (PR #244)

AFK execution closed via [PR #244](https://github.com/samfarls55/gettoit/pull/244) (merged 2026-05-26 00:51 UTC, squash commit `b58c739`).

- Applied the spec body verbatim: `distanceSteps.first ?? 0` and `distanceSteps.last ?? Self.maxDistanceMiles`, lifted into `firstStop` / `lastStop` locals so each optional is only evaluated once.
- Fallback constants kept inline (not hoisted) — single use, comment cites OPT-001 + bug-30 so the rationale is at the read site.
- Added `testSnapDistance_bug30AcceptanceCriteria` in `SetupScreenTests.swift` pinning the three exact acceptance cases (`-1` → first, `100` → last, `distanceSteps[2]` passthrough). Existing `testSnapDistanceMaps_endpoints_andInterior` was not touched (regression lock, surgical-changes rule).
- All CI gates green including `ios (xcodebuild test)`. No design-system / surface change.

Next swift-code-review sweep should find this site clean.
