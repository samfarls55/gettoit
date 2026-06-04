---
adr: 0021
title: Expo managed TypeScript rewrite becomes the active iOS client path
status: accepted
date: 2026-06-04
supersedes: null
superseded_by: null
---

# 0021 - Expo managed TypeScript rewrite becomes the active iOS client path

## Status

Accepted - 2026-06-04. Founder decision from the iOS tech-stack migration grill.

This updates the iOS-client portion of [[0001-ios-tech-stack-supabase|ADR 0001]]: Swift + SwiftUI is now legacy/frozen, while Supabase remains the backend choice.

## Context

The existing iOS app is Swift + SwiftUI under `ios/`, generated with XcodeGen and shipped through TestFlight. It has broad XCTest coverage, but the founder only has a Windows machine. That makes the normal feature loop painfully slow:

- Swift tests need macOS/Xcode, so local Windows verification cannot run the iOS suite.
- UI iteration depends on CI, simulator-unavailable Windows workarounds, and TestFlight/device checks.
- Existing workarounds have not made SwiftUI iteration fast enough.

The goal is not a small refactor. The founder is set on a new testing-friendlier client stack, preferably React/TypeScript-shaped, even if the migration is significant.

No public users are on the app, so migration may break the current Swift TestFlight build and may reshape Supabase contracts when doing so reduces client complexity. Product behavior still needs to reach full parity before launch.

## Decision

Build a new Expo managed React Native + TypeScript app in `mobile/` as the active future iOS client.

The rewrite is a parallel migration to full pre-launch parity, not a bridge inside the existing Swift app. The Swift app stays in `ios/` as legacy reference until Expo ships.

Locked choices:

- `mobile/` lives at the repo root as a sibling to `ios/`, `web/`, `supabase/`, and `design-system/`.
- Expo web is a dev-only preview target, not a replacement for the existing Next.js web fallback.
- The migration target is behavioral parity, not pixel parity.
- Swift iOS is feature-frozen immediately: only critical bug/security/TestFlight fixes go to `ios/`.
- New mobile feature work goes to `mobile/`.
- Source of truth is design-system surfaces + `CONTEXT.md`; Swift code/tests are reference evidence, not unquestioned product law.
- Navigation uses an explicit app-state router/state machine first. Expo Router may handle shell/deep-link entry, but product routing stays centralized and unit-testable.
- The Expo app talks to the same Supabase project directly through a typed repository/service layer.
- Supabase schema/RPC cleanup is allowed during migration when it serves a migrated flow. No speculative backend rewrite.
- Preserve the exact current auth model: S00a Sign-in Gate, Sign in with Apple as iOS entry, Account claim before Apple sign-in, and same `user_id` preservation semantics when upgrading an Anonymous session.
- Windows-local verification standardizes on TypeScript typecheck, Vitest for pure logic, React Native Testing Library for component/state behavior, service fakes/mocks for Supabase and native boundaries, and Playwright only for dev-only Expo web smoke/screenshots.

## Considered alternatives

### Keep SwiftUI and improve architecture/testing

Rejected because it does not solve the founder's main constraint: local Windows development cannot run Xcode/iOS simulator workflows. Swift Testing and better seams improve code quality but leave the iteration loop centered on CI/TestFlight.

### Bare React Native

Rejected as the default because it adds native-project flexibility before the migration has proven it needs that flexibility. Bare RN still requires Xcode/macOS somewhere for iOS native build/link/debug work, and it increases the amount of native configuration that Windows-local tests cannot verify.

Bare RN remains an escape hatch if a specific Expo-managed blocker proves unavoidable.

### Expo managed, but replace the Next.js web fallback too

Rejected for scope. Expo web is valuable as a Windows-friendly preview surface for mobile UI states, but the existing `web/` app has a separate product role: browser fallback for Web invitees. Replacing it would combine two migrations and blur platform responsibilities.

### Incrementally embed Expo/RN into the Swift app

Rejected because it creates two mobile UI stacks in one app during the migration. The cost lands exactly where the project is already slow: native iOS build, signing, and runtime integration. Parallel rewrite keeps the migration boundary clear.

## Consequences

- Add `mobile/` with an Expo managed TypeScript app and local scripts (`mobile:dev`, `mobile:web`, `mobile:test`, `mobile:typecheck`, `verify:mobile`) when implementation begins.
- Keep `ios/` buildable where cheap, but stop adding product scope there.
- Port flows in vertical slices. Recommended order:
  1. Foundation: Expo app shell, tokens, typed route reducer, test harness, Supabase repository seams, mocked native/service boundaries.
  2. Golden path: S00a Sign-in Gate -> Plan list -> Setup -> Quiz -> Waiting -> Live verdict.
  3. Remaining state parity: joined Plans, history, read-only verdict, no-survivor, reroll, delete/exit/leave, settings.
  4. Native parity spikes: Apple auth, universal links, location/Search area, share sheet, push.
  5. Release swap: bundle id/entitlements, EAS/TestFlight, parity checklist, Swift retirement.
- Existing Swift tests can be mined for expected behavior, fixtures, and edge cases, but Expo tests should be written from product contracts.
- Because there are no users, Supabase migrations may simplify the client contract even if old Swift builds break. The Next.js web fallback must be updated when shared contracts change.
- iOS-exact runtime behavior still requires cloud build/device checks. Expo improves the daily loop; it does not make iOS Simulator available on Windows.

## Open questions

- Which Expo SDK/modules are sufficient for Search area behavior: map camera, current location, typed search, radius display, density preview pins, and iOS feel?
- How will EAS credentials and bundle-id handoff interact with the existing TestFlight lane?
- Should any shared domain code move into a package later, or should `mobile/` duplicate/adapt until reuse earns its cost?
- Which Supabase contracts should be simplified first as part of the golden-path migration?
