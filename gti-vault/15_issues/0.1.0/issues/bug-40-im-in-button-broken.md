---
issue: bug-40
title: "\"I'm In\" button doesn't work correctly"
status: needs-triage
type: HITL
github_issue: 312
created: 2026-05-26
grilled: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-40 â€” "I'm In" button broken (HITL placeholder)

## Symptom

Founder reports the "I'm in" ratification CTA on the verdict surface is not behaving correctly. Repro steps, expected vs actual, and which surface variant (live `VerdictScreen` vs `VerdictReadOnlyScreen`) are not yet captured â€” needs a hands-on session to characterize.

## Why HITL

Needs founder to drive the repro on real hardware (TestFlight build, no Mac available to AFK agents â€” see [[project_no_mac_ci_only_ios]]). Once repro + expected behavior are pinned down, a fix issue can be spawned (likely AFK).

## What this issue does NOT do pre-grill

- Guess the root cause.
- Edit `VerdictScreen` / `RatificationStore` / `PushCoordinator` blindly.

## Acceptance criteria (placeholder)

- [ ] Repro steps captured (which surface, group vs solo, host vs joiner, network state).
- [ ] Expected vs actual behavior documented.
- [ ] Fix issue spawned (or fixed inline if scope is trivial).

## Code breadcrumbs

- `ios/Sources/App/VerdictScreen.swift` â€” live committed verdict view, hosts "I'm in" CTA
- `ios/Sources/App/VerdictReadOnlyScreen.swift` â€” read-only sealed verdict variant
- `ios/Sources/App/RatificationStore.swift` â€” idempotent ratification write
- `ios/Sources/App/PushCoordinator.swift` â€” per-session push subscription gated on first "I'm in" tap
- `ios/Sources/App/TelemetryWriter.swift` â€” PRD user story 37 telemetry for the tap

## References

- [[project_pre_public_launch_milestone]] (memory)
