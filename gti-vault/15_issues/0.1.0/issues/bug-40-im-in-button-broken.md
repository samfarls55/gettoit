---
issue: bug-40
title: "\"I'm In\" button doesn't work correctly"
status: needs-triage
type: HITL
github_issue: 312
created: 2026-05-26
grilled: null
---

# bug-40 — "I'm In" button broken (HITL placeholder)

## Symptom

Founder reports the "I'm in" ratification CTA on the verdict surface is not behaving correctly. Repro steps, expected vs actual, and which surface variant (live `VerdictScreen` vs `VerdictReadOnlyScreen`) are not yet captured — needs a hands-on session to characterize.

## Why HITL

Needs founder to drive the repro on real hardware (TestFlight build, no Mac available to AFK agents — see [[project_no_mac_ci_only_ios]]). Once repro + expected behavior are pinned down, a fix issue can be spawned (likely AFK).

## What this issue does NOT do pre-grill

- Guess the root cause.
- Edit `VerdictScreen` / `RatificationStore` / `PushCoordinator` blindly.

## Acceptance criteria (placeholder)

- [ ] Repro steps captured (which surface, group vs solo, host vs joiner, network state).
- [ ] Expected vs actual behavior documented.
- [ ] Fix issue spawned (or fixed inline if scope is trivial).

## Code breadcrumbs

- `ios/Sources/App/VerdictScreen.swift` — live committed verdict view, hosts "I'm in" CTA
- `ios/Sources/App/VerdictReadOnlyScreen.swift` — read-only sealed verdict variant
- `ios/Sources/App/RatificationStore.swift` — idempotent ratification write
- `ios/Sources/App/PushCoordinator.swift` — per-session push subscription gated on first "I'm in" tap
- `ios/Sources/App/TelemetryWriter.swift` — PRD user story 37 telemetry for the tap

## References

- [[project_pre_public_launch_milestone]] (memory)
