---
issue: bug-06
title: Legacy v1 anonymous session bypasses S00a sign-in gate on launch
github_issue: 63
status: ready-for-human
type: AFK
created: 2026-05-14
prd: v1-prd
---

# bug-06 — Legacy v1 anonymous session bypasses S00a sign-in gate

## Parent

[[../_index|v1.1 backlog]]. Captured 2026-05-14 during founder dogfood: "There is still no sign-up page upon app launch." Diagnosis-shaped, not spec-shaped — the [[sg-03-account-creation-surfaces|sg-03]] surface spec is correct and the [[tb-02-account-creation-wire|tb-02]] iOS wiring landed, but the render guard misses a real-world case the spec implicitly assumed away.

## What's broken

`RootView.swift` renders `SignInScreen` only when `AuthCoordinator.state == .idle`:

```swift
if case .idle = coordinators.auth.state {
    SignInScreen(...)
}
```

`AuthCoordinator.restoreSessionIfPresent()` (post-tb-02) maps a cached anonymous session to `.anonymous(userID:)`, not `.idle`. Any device that ran a pre-v1.1 TestFlight build holds an **Anonymous session** ([[../../../../CONTEXT|CONTEXT.md]]) in Keychain, so on next launch the coordinator lands on `.anonymous` and the **S00a Sign-in Gate** is skipped — the user falls through to LandingScreen with no Apple identity attached.

The sg-03 spec only enumerated three launch scenarios in its "Two-launch boundary" table (fresh install, restored linked-Apple, post-delete reboot). The "legacy anonymous session still in Keychain" case was implicit in "fresh install" but the wiring did not cover it. tb-02 acceptance criteria explicitly tested the deleted-and-reinstall path, which clears Keychain; the always-existed-since-v1 path was never exercised.

## What to build

Widen the S00a render trigger so that an anonymous session also routes through the gate, then on tap link the existing anonymous identity to Apple via `linkApple` (preserving `user_id` and every owned `rooms` / `votes` / `members` / `events` row). After this fix, the iOS post-v1.1 invariant holds: every iOS session on screen is a **Linked-Apple session** ([[../../../../CONTEXT|CONTEXT.md]]) or pre-gate.

End-to-end behavior:

- A legacy v1 anonymous user launches the app and sees the **S00a Sign-in Gate** (current behavior: skipped).
- Tapping "Save my taste profile" runs the Apple flow.
- On success the existing anonymous `user_id` is attached to the Apple identity via `AuthCoordinator.linkApple` — same id, all prior rows preserved.
- Coordinator state becomes `.linkedApple(userID)` and the app routes to S00 Landing as it would for any other returning Apple user.
- Subsequent launches restore the linked-Apple session and skip S00a as today.

A fresh install with no session at all continues to mint a Linked-Apple session via the existing `signInWithApple` path — only the tap-time call differs between the two branches.

## Scope

### iOS

- `RootView` render gate: widen the `SignInScreen` branch to render for `.idle` OR `.anonymous`. After the gate releases, the standard state precedence chain in `RootView` already routes the now-`.linkedApple` user correctly (LandingScreen for an idle session; any deep-link / read-only context still in state falls through).
- `SignInScreen.onSaveTapped`: branch on the coordinator's current state at tap time. `.idle` → existing `auth.signInWithApple(idToken:nonce:)` call. `.anonymous` → `auth.linkApple(idToken:nonce:)`. Both methods already exist in `AuthCoordinator` with the same Apple-credential input shape; the screen needs the conditional dispatch only.
- Unit test (`SignInScreenTests` or equivalent) exercising both branches through the existing `AppleSignInProviding` injection seam, asserting the correct `AuthCoordinator` method is invoked for each starting state.

### Spec

- `design-system/surfaces/00a-signin.md` Two-launch boundary table: add a row for "Legacy v1 anonymous session in Keychain" describing the linkApple upgrade path and prior-data preservation. Cross-link to [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]'s merge invariant ("the userID before and after linkApple is the same").
- `design-system/CHANGELOG.md`: one-line entry under 2026-05-14 referencing this issue.

## Acceptance criteria

- [ ] On a TestFlight build of this fix installed over a device with a v1 anonymous session in Keychain, the app launches into the S00a sign-in surface (current state: lands on S00 Landing or InitiatorScreen). Founder's iPhone is the reproducer.
- [ ] Tapping the S00a CTA on that device completes the Apple flow and routes to S00 Landing with `AuthCoordinator.state == .linkedApple(userID)`.
- [ ] The Linked-Apple `user_id` after sign-in equals the prior Anonymous `user_id` (verified via the `AuthCoordinator.linkApple` invariant — already enforced by `LinkError.userIDChanged` throw if violated).
- [ ] A fresh install with no Keychain entry continues to land on S00a and sign in via `signInWithApple` as today; subsequent launches skip the gate.
- [ ] Unit test covers both `SignInScreen` tap branches (`.idle` → `signInWithApple`, `.anonymous` → `linkApple`) via the existing injectable `AppleSignInProviding` + `AuthCoordinator` seams.
- [ ] `design-system/surfaces/00a-signin.md` Two-launch boundary table includes the legacy-anonymous row.
- [ ] `design-system/CHANGELOG.md` entry exists.
- [ ] `node design-system/scripts/verify.mjs` green.

## Out of scope

- **AuthUpgradeChip (C-22) removal on iOS S04 Waiting.** Per [[../../../../design-system/surfaces/00a-signin|S00a §"Interaction with C-22"]] the chip stays in the spec as a fallback even though no iOS user will be anonymous post-fix. No deletion in this PR.
- **`AuthCoordinator.signInWithApple` defensive throw.** The `SignInError.haveAnonymousSession` guard at the top of the method remains as a safety net for any future caller that reaches it with an anonymous session in hand. Post-fix, `SignInScreen` will never call `signInWithApple` while `.anonymous`, so the throw is unreachable in production but cheap to keep.
- **ADR change.** [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]'s v1.1 supersedence already covers "iOS forced sign-in"; this is a wiring fix, not a policy change.
- **Web fallback.** Anonymous sessions remain the default on web per ADR 0007 §"Web fallback voters stay anonymous indefinitely." No web changes.

## Blocked by

None — can start immediately. The required `AuthCoordinator.linkApple` path was built in v1 for the C-22 chip and is exercised by `AuthCoordinatorLinkAppleTests`; no new auth surface needed.
