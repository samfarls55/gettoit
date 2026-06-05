---
issue: sg-03
title: Account creation â€” forced first-launch Apple sign-in gate + invitee waiting-screen download CTA
github_issue: 47
status: done
type: AFK
created: 2026-05-14
closed: 2026-05-14
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# sg-03 â€” Account creation surfaces

## Parent

[[../_index|0.1.0 backlog]] candidate #7.

## Why

0.1.0 only supports anonymous accounts with an optional Apple sign-in upgrade ([[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]). For 0.1.0 the user wants two surface-level changes:

1. **Forced Apple sign-in on first launch.** Anyone who opens the iOS app on a fresh install must complete Sign in with Apple before the app is usable. iPhone-only assumption holds; no other auth method is offered.
2. **Waiting-screen download CTA for anonymous web invitees.** A non-installer who tapped an invite link, answered the quiz on the web fallback, and is on the waiting screen sees a "Download the app" CTA. Tapping it opens the App Store; on a subsequent app install they hit the forced sign-in gate from (1) and become a real account.

The cuisine likes/dislikes profile editor is **deferred** to the pre-public-launch milestone (see [[../_index#0.1.0 â†’ pre-public-launch milestone handoff]] and [[../../../50_product/questions-profile-vs-session-split|the profile/session decision]]). This issue scopes only to (1) and (2) above.

## Scope

### 1. First-launch Apple sign-in gate

  - Single "Sign in with Apple" affordance, no skip / continue-as-guest path.
  - Visual treatment using existing tokens; no new components expected.
  - Behavior: shown on every fresh install until sign-in completes. Subsequent launches with an existing session skip this surface.
- Confirm interaction with [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] â€” this surface effectively closes the "anonymous default" half of that ADR for iOS-launched sessions while keeping anonymous as the implicit default for invite-link arrivals on web. Document the boundary in the surface doc.

### 2. Waiting-screen "Download the app" CTA (web)

  - A "Download the app" CTA visible only when the consuming surface is the web fallback AND the current user is anonymously authenticated.
  - Tap behavior: open App Store iOS download link.

### Token / component check

- No new tokens expected.
- App Store CTA likely reuses the existing primary CTA button component. If a download-specific affordance with an SF Symbol prefix is wanted, propose as an open question, do not auto-add.

## Acceptance criteria


## Open questions

- Does first-launch sign-in obsolete the existing `AuthUpgradeChip` flow (currently shown to anonymous users mid-session)? On iOS yes â€” they sign in before any session starts. On web no â€” anonymous invitees still upgrade by installing the app. Document the iOS/web asymmetry in the surface doc.

## Blocked by

None â€” can start immediately. [[tb-02-account-creation-wire|tb-02]] is blocked on this issue.
