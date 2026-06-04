---
status: ready-for-agent
type: HITL
github_issue: 336
---

# TB-18: Release swap and Swift retirement

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Cut the active iOS client over from legacy SwiftUI to the Expo app. This includes release configuration, bundle identity and entitlement handoff, EAS/TestFlight path, documentation updates, and explicit human approval that the Swift app is retired as active product scope.

## Acceptance criteria

- [ ] Expo release configuration uses the intended bundle identity, entitlements, and app metadata for TestFlight/App Store continuity.
- [ ] CI/release docs explain the new EAS/TestFlight path and the legacy Swift status.
- [ ] Human approval is recorded for cutover timing and Swift retirement.
- [ ] A TestFlight build from the Expo path is accepted and installable, or any blocking release issue is documented.
- [ ] `ios/` is clearly marked legacy/frozen/retired according to the approved final state.
- [ ] Final parity checklist references TB-17 results and any accepted residual risks.

## Blocked by

- TB-14: No-survivor and reroll.
- TB-15: Read-only verdict and Plan history.
- TB-17: Native runtime parity checklist.

