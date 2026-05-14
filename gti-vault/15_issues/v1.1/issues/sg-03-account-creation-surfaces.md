---
issue: sg-03
title: Account creation — forced first-launch Apple sign-in gate + invitee waiting-screen download CTA
github_issue: 47
status: done
type: AFK
created: 2026-05-14
closed: 2026-05-14
prd: v1-prd
---

# sg-03 — Account creation surfaces

## Parent

[[../_index|v1.1 backlog]] candidate #7.

## Why

v1 only supports anonymous accounts with an optional Apple sign-in upgrade ([[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]). For v1.1 the user wants two surface-level changes:

1. **Forced Apple sign-in on first launch.** Anyone who opens the iOS app on a fresh install must complete Sign in with Apple before the app is usable. iPhone-only assumption holds; no other auth method is offered.
2. **Waiting-screen download CTA for anonymous web invitees.** A non-installer who tapped an invite link, answered the quiz on the web fallback, and is on the waiting screen sees a "Download the app" CTA. Tapping it opens the App Store; on a subsequent app install they hit the forced sign-in gate from (1) and become a real account.

The cuisine likes/dislikes profile editor is **deferred** to the pre-public-launch milestone (see [[../_index#v1.1 → pre-public-launch milestone handoff]] and [[../../../50_product/questions-profile-vs-session-split|the profile/session decision]]). This issue scopes only to (1) and (2) above.

## Scope

### 1. First-launch Apple sign-in gate

- **New onboarding surface** in `design-system/surfaces/` — propose `00a-signin.md` or similar (precedes [[sg-02-landing-page-surface|sg-02]] landing). Describes:
  - Single "Sign in with Apple" affordance, no skip / continue-as-guest path.
  - Visual treatment using existing tokens; no new components expected.
  - Behavior: shown on every fresh install until sign-in completes. Subsequent launches with an existing session skip this surface.
- **New JSX** at `design-system/code/screens/ScreenSignIn.jsx` (or rename / fold into an existing onboarding surface if one already approximates this shape).
- Confirm interaction with [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] — this surface effectively closes the "anonymous default" half of that ADR for iOS-launched sessions while keeping anonymous as the implicit default for invite-link arrivals on web. Document the boundary in the surface doc.

### 2. Waiting-screen "Download the app" CTA (web)

- **Edit existing waiting-surface spec** in `design-system/surfaces/` (the waiting / quorum surface — likely S04 per [[../../../10_prds/v1-prd|v1 PRD]]). Add:
  - A "Download the app" CTA visible only when the consuming surface is the web fallback AND the current user is anonymously authenticated.
  - Tap behavior: open App Store iOS download link.
- **Update `design-system/code/screens/ScreenWaiting.jsx`** (or equivalent) with the conditional CTA. Mark the iOS path: CTA suppressed (user already has the app).

### Token / component check

- No new tokens expected.
- App Store CTA likely reuses the existing primary CTA button component. If a download-specific affordance with an SF Symbol prefix is wanted, propose as an open question, do not auto-add.

## Acceptance criteria

- [x] Sign-in surface spec exists and describes the forced first-launch gate, with reference to [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]. — `design-system/surfaces/00a-signin.md`
- [x] Waiting-surface spec updated for the web-only "Download the app" CTA. — `design-system/surfaces/04-waiting.md` §"Download the app" CTA (web fallback, anonymous-only)
- [x] Corresponding JSX exists in `design-system/code/screens/`. — `ScreenSignIn.jsx` (new); `ScreenWaiting.jsx` updated with the conditional web-anonymous CTA branch
- [x] `node design-system/scripts/verify.mjs` green. — 5/5 gates pass (drift-check CSS + Swift, orphan-hex sweep JSX + web, surface↔jsx pairing 10 docs / 15 screens)
- [x] `design-system/CHANGELOG.md` entry referencing this issue. — three lines added under 2026-05-14, referencing sg-03

## Open questions

- Does first-launch sign-in obsolete the existing `AuthUpgradeChip` flow (currently shown to anonymous users mid-session)? On iOS yes — they sign in before any session starts. On web no — anonymous invitees still upgrade by installing the app. Document the iOS/web asymmetry in the surface doc.

## Blocked by

None — can start immediately. [[tb-02-account-creation-wire|tb-02]] is blocked on this issue.
