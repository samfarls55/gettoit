---
status: done
github_issue: 325
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Expo Mobile Rewrite PRD

## Problem Statement

The current iOS client is Swift + SwiftUI and depends on macOS/Xcode for meaningful local verification. The founder works from a Windows machine, so the normal loop for feature work is too slow: Swift tests cannot run locally, iOS UI iteration waits on CI/TestFlight, and prior workarounds have not made mobile development feel fast enough.

The product still needs a complete iOS client before launch. The rewrite must preserve GetToIt's product behavior while moving active mobile development into a stack where most logic, state, and UI behavior can be tested quickly from Windows.

## Solution

Build a new Expo managed React Native + TypeScript mobile client as the active future iOS app. The Expo app will be migrated in parallel to full pre-launch parity with the Swift app, using design-system surfaces and `CONTEXT.md` as the source of truth. The existing Swift client becomes legacy reference and is feature-frozen.

Expo web is a development-only preview target. It helps inspect mobile surfaces and run smoke tests from Windows, but it does not replace the existing Next.js Web invitee fallback. The Expo app talks directly to Supabase through typed repositories/services and may simplify Supabase contracts during migration because there are no public users yet.

## User Stories

1. As the founder, I want to run mobile typechecks on Windows, so that I can catch basic errors without waiting for CI.
2. As the founder, I want to run mobile unit tests on Windows, so that I can iterate on product logic quickly.
3. As the founder, I want to inspect mobile screens in a browser preview, so that UI work does not require TestFlight for every change.
4. As the founder, I want most mobile behavior covered by fast local tests, so that CI and TestFlight are release checkpoints rather than the daily feedback loop.
5. As the founder, I want the Swift app frozen during migration, so that product work does not split across two mobile stacks.
6. As the founder, I want the Expo app to reach full pre-launch parity, so that the Swift app can be retired before public launch.
7. As the founder, I want behavior parity rather than pixel parity, so that the rewrite can improve iteration speed without being blocked by exact SwiftUI reproduction.
8. As a future agent, I want one explicit app-state router, so that navigation precedence is understandable and testable.
9. As a future agent, I want route transitions tested as reducer/state-machine behavior, so that deep-link, quiz, verdict, and settings bugs can be caught locally.
10. As a future agent, I want product contracts derived from design-system surfaces and `CONTEXT.md`, so that stale Swift implementation details do not become accidental requirements.
11. As an Account member, I want the S00a Sign-in Gate to appear whenever my session is not Linked-Apple, so that iOS keeps the post-S00a identity invariant.
12. As an Account member, I want Sign in with Apple to remain the only iOS entry path, so that auth behavior matches the current product model.
13. As a Web invitee installing the app, I want to enter a Claim code before Apple sign-in, so that my Anonymous session can be upgraded instead of stranded.
14. As a Web invitee installing the app, I want Account claim to preserve my `user_id`, so that my existing Plan votes and memberships stay attached.
15. As an Account member, I want a Plan list as my signed-in landing surface, so that I can see Created, Joined, Decided, and History Plans.
16. As an Account member, I want the Plan list to support empty and populated states, so that first use and returning use both have clear paths.
17. As an Account member, I want to create a solo Plan, so that I can get a recommendation for myself.
18. As an Account member, I want to create a group Plan, so that I can invite others into the quiz round.
19. As an Account member, I want to edit a pending Plan, so that I can correct setup details before launching a Room.
20. As an Account member, I want Setup to capture Plan name, participant scope, Search area, and session Parameters, so that the quiz starts with the right context.
21. As an Account member, I want Search area to be selected through a map-centered area editor, so that the candidate pool reflects where I actually want to go.
22. As an Account member, I want Search area behavior to include current location, typed place jumps, radius display, and preview pins, so that I can size the area confidently.
23. As an Account member, I want launching a Room to require a committed Search area, so that candidate fetching has real geography.
24. As an Account member, I want to share a group invite link, so that other Plan members can join.
25. As an Account member, I want Universal Links to route into the correct Plan state, so that invite links work from cold and warm app launches.
26. As a Plan member, I want to answer quiz questions in order, so that my needs and preferences feed the verdict.
27. As a Plan member, I want Plan back navigation to preserve prior answers, so that correcting an answer is safe.
28. As a Plan member, I want Plan exit/leave to remove me from the active Room, so that I can bow out without corrupting other members' state.
29. As a Plan member, I want Q5 preference probe cards to use real candidates, so that the verdict learns from actual venue choices.
30. As a Plan member, I want Q5 no-results behavior when candidate fetch cannot produce usable cards, so that the app never shows fictitious venues.
31. As an initiator, I want Waiting to show member progress, so that I understand whether the group is ready.
32. As an initiator, I want to manually close voting from Waiting, so that the verdict can fire before everyone responds.
33. As a joiner, I want Waiting to update when the verdict fires, so that I move forward without manual refresh.
34. As a Plan member, I want a live verdict surface after the verdict fires, so that I can act on the recommendation.
35. As a solo member, I want the verdict surface to use solo-specific behavior, so that group-only receipts and actions do not appear.
36. As a Plan member, I want a no-survivor surface when every option is ruled out, so that I can widen the search and try again.
37. As an initiator, I want reroll behavior preserved, so that I can replace a live verdict within the allowed window and burn count.
38. As a Plan member, I want read-only verdict behavior for closed Plans, so that past results are records rather than active sessions.
39. As an Account member, I want joined Plans to resume into the right state, so that tapping a card never loses my progress.
40. As an Account member, I want Plan history to be searchable or scannable as currently specified, so that old decisions remain useful.
41. As an Account member, I want Plan delete to remove my Created Plan and end active Rooms, so that I can intentionally destroy a Plan.
42. As a joiner, I want "session ended" feedback when an initiator deletes or ends the Room, so that I am not stranded on a stale surface.
43. As an Account member, I want Settings and account delete behavior preserved, so that I can manage or remove my account.
44. As a mobile developer, I want Supabase access behind typed repositories, so that UI tests can use fakes and avoid live network calls.
45. As a mobile developer, I want native boundaries mocked in local tests, so that Apple auth, links, maps, location, push, and share behavior can be exercised without iOS runtime.
46. As a mobile developer, I want the same Supabase project and RLS model to back the Expo app, so that migration changes remain grounded in the real backend.
47. As a mobile developer, I want Supabase contracts simplified only when migrating a flow, so that backend cleanup stays tied to real product need.
48. As a mobile developer, I want Expo EAS/TestFlight to verify iOS-specific runtime behavior, so that local Windows tests do not pretend to cover Apple's runtime.
49. As a release owner, I want a cutover checklist for bundle id, entitlements, links, auth, and TestFlight, so that the Expo app can replace the Swift app safely.
50. As a release owner, I want the legacy Swift app retired only after parity checks pass, so that the migration has a clear finish line.

## Implementation Decisions

- Build a new Expo managed React Native + TypeScript app as the active future mobile client.
- Use a parallel rewrite rather than embedding React Native into the legacy Swift client.
- Keep Expo web as a dev-only preview surface.
- Keep the existing Next.js Web invitee fallback separate.
- Freeze Swift iOS feature work immediately. Critical fixes are allowed, but new product scope goes to Expo.
- Aim for full product behavior parity before public launch.
- Do not require pixel parity with SwiftUI. The Expo app must feel polished and recognizably GetToIt, but exact screenshot matching is not required.
- Treat design-system surfaces and `CONTEXT.md` as product source of truth.
- Treat Swift code and XCTest coverage as reference evidence for edge cases, fixtures, and hidden behavior.
- Use an explicit app-state router/state machine for product routing. File-based routing may wrap app launch and deep-link entry, but core precedence lives in one tested routing model.
- Preserve the current auth model: S00a Sign-in Gate, Sign in with Apple, Account claim before Apple sign-in, and `user_id` preservation when upgrading an Anonymous session.
- Keep direct Supabase access in the client, but isolate it behind typed repositories/services.
- Allow breaking Supabase contract cleanup during migration because there are no public users. Update the web fallback when shared contracts change.
- Avoid speculative backend redesign. Each Supabase migration or RPC change must serve a migrated flow.
- Make the foundation slice first: app shell, design tokens, test harness, typed app-state router, mocked native boundaries, and Supabase repository seams.
- Build parity in vertical slices: golden path first, remaining state parity next, native parity spikes before release swap.
- Native parity spikes must include Apple auth, Universal Links, location/Search area, share sheet, push, and EAS/TestFlight handoff.
- Bare React Native remains an escape hatch only if a specific Expo managed blocker proves unavoidable.

Major modules to build or modify:

- Mobile app shell and runtime configuration.
- Design-token adapter for React Native styles and Expo web preview.
- Explicit app-state router and route reducer.
- Auth repository and auth state model.
- Account claim repository and S00a screen model.
- Plan repository for Plan list, created Plans, joined Plans, decided Plans, and history.
- Setup state model, including Search area and session Parameters.
- Search area native/web abstraction for maps, location, place search, radius, and preview pins.
- Invite-link/deep-link resolver.
- Quiz state model, progress persistence, answer writing, and Q5 candidate loading.
- Candidate-pool and Q5 probe helpers ported into testable TypeScript modules.
- Waiting state model and session-ended handling.
- Verdict repository and screen models for live, solo, read-only, no-survivor, and reroll behavior.
- Settings/account-delete model.
- Supabase typed repository layer and fakes.
- Native boundary adapters for Apple auth, keychain/session storage, links, location, maps, share, push, and app lifecycle.
- Release/cutover configuration for EAS, bundle identity, entitlements, and TestFlight.

## Testing Decisions

Good tests assert external behavior, not implementation detail. Router tests should assert visible route outcomes from state/events. Repository tests should assert data contracts and error behavior. Component tests should assert user-observable text, controls, state changes, and callbacks. Native boundary tests should use fakes to assert the app reacts correctly to permission/auth/link outcomes without requiring iOS runtime.

Standard test stack:

- TypeScript typecheck for all mobile code.
- Vitest for pure domain, router, repository-mapping, and service tests.
- React Native Testing Library for screen/component behavior.
- Service fakes or mock service worker-style adapters for Supabase/network boundaries.
- Playwright only for Expo web smoke/screenshots.
- EAS/dev build/TestFlight for iOS runtime checks that Windows cannot prove.

Modules that need tests:

- App-state router and route reducer.
- Auth state model, S00a render gate, Apple-sign-in handoff, and Account claim behavior.
- Supabase repository mapping for Plans, Rooms, votes, members, verdicts, and account delete.
- Plan list grouping and tap routing.
- Setup state model and launch guards.
- Search area state math and web/native adapter contracts.
- Deep-link resolver.
- Quiz coordinator/state model, Plan back, Plan exit, progress persistence, and Q5 submit behavior.
- Q5 candidate loading and factorial card generation.
- Waiting state, verdict trigger routing, and session-ended handling.
- Verdict surface dispatch, no-survivor behavior, reroll eligibility, and read-only behavior.
- Settings/account-delete behavior.

Prior art:

- The current iOS suite has focused state/coordinator tests for auth, Plan list, Setup, quiz, waiting, verdict, reroll, and Supabase integration.
- The current web stack already uses React/TypeScript, Vitest, and Testing Library-style patterns.
- The design system already uses generated tokens and verification scripts that can inform a React Native token adapter.

## Out of Scope

- Replacing the Next.js Web invitee fallback with Expo web.
- Maintaining active Swift feature development during migration.
- Exact SwiftUI pixel parity.
- Supporting Android as a product launch target.
- Building speculative shared packages before duplication/reuse earns its cost.
- Solving every Supabase/schema cleanup up front.
- Recreating iOS Simulator-level confidence on Windows.
- Choosing Bare React Native unless Expo managed hits a proven blocker.

## Further Notes

ADR 0021 records the architecture decision behind this PRD. The migration should be split into tracer-bullet issues after the foundation shape is scaffolded or immediately if execution needs parallelization.

The biggest known risk is Search area parity: map camera behavior, current location, typed search, radius display, and density preview pins need an early spike. Apple auth, Universal Links, EAS handoff, and push also need real iOS checks because local Windows tests can only cover faked outcomes.

## Closure note

Closed 2026-06-05. All child tracer-bullet issues TB-01 through TB-18 are closed in GitHub, and TB-18 recorded the release swap, Swift retirement, TB-17 residual risks, and founder approval.
