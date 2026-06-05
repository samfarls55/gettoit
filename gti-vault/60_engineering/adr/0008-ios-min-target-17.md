---
adr: 0008
title: iOS minimum deployment target â€” iOS 17
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0008 â€” iOS minimum deployment target: iOS 17

## Status

Accepted â€” 2026-05-12.

## Context

The Xcode project hasn't been initialized yet. Min-deployment target gates SwiftUI APIs, ActivityKit (Live Activities), the Observable macro, and a handful of SDKs (`supabase-swift`, future analytics). Choosing too low costs ergonomics; choosing too high costs reach.

## Decision

**iOS 17 minimum.**

## Why

1. **SwiftUI maturity.** Observable macro (`@Observable`), `ContentUnavailableView`, modern `.onChange(of:initial:)`, `ScrollView` content margins â€” all iOS 17. Boilerplate-light compared to iOS 16.
2. **ActivityKit / Live Activities are stable.** [[../stack-patterns#push-notifications|stack-patterns.md]] calls for a "3 of 5 voted, deadline 2m" Live Activity. iOS 16 had Live Activities but with significant rough edges; iOS 17 is the first stable target.
3. **Sign in with Apple proven.** iOS 17 Authentication Services flow is the well-trodden path used by [[0007-auth-anonymous-default-apple-upgrade|ADR 0007]].
4. **Device reach is adequate.** ~95% of active devices on iOS 17+ in 2026. Holdouts on iOS 16 are disproportionately low-engagement users; their absence does not distort the thesis test.
5. **iOS 18 over-trims.** Drops ~10â€“15% of devices including the kind of "friend on an older iPhone" invitee the viral loop depends on.

## Consequences

### Positive

- Modern SwiftUI ergonomics throughout.
- Live Activity feature works without backporting.
- supabase-swift requires iOS 13 minimum â€” well below our floor.

### Negative / accepted tradeoffs

- **~5% of devices excluded.** Accepted.
- **iOS 18-only APIs unavailable.** Mesh gradients, predictive completion APIs â€” not 0.1.0 critical.

## Re-evaluation triggers

- iOS 19 ships and an essential v2 feature requires it â€” bump minimum at next major release.
- A specific iOS 18-only API becomes core to the product roadmap.

## References

- [[0001-ios-tech-stack-supabase|ADR 0001]]
- [[../stack-patterns|stack-patterns.md]]
