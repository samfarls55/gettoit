---
status: done
type: HITL
github_issue: 336
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-18: Release swap and Swift retirement

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Cut the active iOS client over from legacy SwiftUI to the Expo app. This includes release configuration, bundle identity and entitlement handoff, EAS/TestFlight path, documentation updates, and explicit human approval that the Swift app is retired as active product scope.

## Cutover note

- [[../../../60_engineering/expo-release-cutover|Expo release cutover]]

## Acceptance criteria

- [x] Expo release configuration uses the intended bundle identity, entitlements, and app metadata for TestFlight/App Store continuity. _(`mobile/app.json` + `mobile/eas.json` checked 2026-06-05.)_
- [x] CI/release docs explain the new EAS/TestFlight path and the legacy Swift status. _(`mobile/README.md`, `ios/README.md`, root `README.md`, `docs/agents/verification.md`, and `expo-release-cutover` updated 2026-06-05.)_
- [x] Human approval is recorded for cutover timing and Swift retirement. _(Founder approved all three TB-18 HITL gates on 2026-06-05.)_
- [x] A TestFlight build from the Expo path is accepted and installable, or any blocking release issue is documented. _(Founder accepted Expo TestFlight build `1003` for TB-18 closure on 2026-06-05.)_
- [x] `ios/` is clearly marked legacy/frozen/retired according to the approved final state. _(`ios/README.md` marks SwiftUI retired as active product scope; CI legacy Swift jobs disabled.)_
- [x] Final parity checklist references TB-17 results and any accepted residual risks. _(See linked cutover note and [[../../../60_engineering/expo-native-runtime-parity|Expo native runtime parity]].)_

## Agent completion note

2026-06-05: Completed agent-actionable cutover work:

- Added active mobile release docs in `mobile/README.md`.
- Replaced stale Swift TestFlight docs in `ios/README.md` with legacy/retired status.
- Updated root repo map and agent verification matrix for active `mobile/`.
- Added CI mobile verify lane and disabled legacy Swift `ios` + Swift TestFlight jobs.
- Added `gti-vault/60_engineering/expo-release-cutover.md` to record release config, TB-17 handoff, and residual risks.

HITL completion:

- Founder approved cutover timing as 2026-06-05.
- Founder approved Swift retirement as active product scope.
- Founder confirmed Expo TestFlight build `1003` is accepted/installable for TB-18 closure.
- Founder noted multiple TB-18 issues remain, to be addressed after closure as follow-up work.

## Blocked by

- TB-14: No-survivor and reroll.
- TB-15: Read-only verdict and Plan history.
- TB-17: Native runtime parity checklist.

