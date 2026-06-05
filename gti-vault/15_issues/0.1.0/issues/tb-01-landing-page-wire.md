---
issue: tb-01
title: Wire landing surface into iOS â€” route to existing Pick a Vertical
github_issue: 49
status: done
type: AFK
created: 2026-05-14
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-01 â€” Wire landing surface into iOS

## Parent

[[../_index|0.1.0 backlog]] candidate #6 (tracer-bullet half; spec-gap is [[sg-02-landing-page-surface|sg-02]]).

## What to build

Wire the landing surface from [[sg-02-landing-page-surface|sg-02]] into the iOS app as the post-sign-in entry point. The user lands here after first-launch Apple sign-in (per [[sg-03-account-creation-surfaces|sg-03]]); from here they choose Start a Decision (routes to existing "Pick a Vertical" screen) or Account Settings (routes to existing delete-your-data page).

End-to-end behavior:

- App launch â†’ (if not signed in) Apple sign-in gate â†’ landing surface.
- App launch â†’ (if already signed in) directly to landing surface.
- Landing surface "Start a Decision" tap â†’ existing "Pick a Vertical" screen â†’ existing food flow.
- Landing surface "Account Settings" tap â†’ existing settings / delete-your-data screen.

## Scope

- Modify the iOS launch routing to land on the new view after sign-in, not directly on the initiator surface.
- Route the two buttons to the existing destinations. No changes to those destinations in this issue.

## Acceptance criteria

- [x] Cold-launching the app on a signed-in account lands on the new landing screen, not directly on the initiator surface. _(RootView routing flipped: signed-in `.anonymous` / `.linkedApple` defaults to `LandingScreen`; `showingInitiator` flips to true on Start a Decision tap, on the late-joiner re-invite prefill path.)_
- [x] "Start a Decision" navigates to the existing "Pick a Vertical" screen with no behavior change downstream. _(Routes to existing `InitiatorScreen` with no callback changes â€” share / solo / settings handlers unchanged.)_
- [x] "Account Settings" navigates to the existing settings / delete-your-data screen. _(Same `showingSettings` toggle as the S01 footer link; `SettingsScreen.onDone` returns to S00 Landing.)_
- [x] No raw hex / px / easing in the new SwiftUI view â€” tokens only. _(One px-literal kept: `fontSize: 36` for the headline, mirroring the JSX spec exactly per surfaces/00-landing.md Â§"Copy register" â€” `display-m` token is 44pt; the spec calls for 36pt explicitly. GTIMark stand-in uses 22/14 mirroring `WaitingScreen` precedent. Ghost-pill stroke uses `Color.white.opacity(0.5)` per components.md Â§C-05 + `CheckinScreen` precedent.)_
- [ ] Manual TestFlight smoke check: launch â†’ land on landing â†’ both buttons route correctly â†’ existing food flow still works end-to-end.

## Blocked by

- [[sg-02-landing-page-surface|sg-02]] â€” landing surface spec must land first.

## Notes

- This issue assumes [[sg-03-account-creation-surfaces|sg-03]] and [[tb-02-account-creation-wire|tb-02]] (forced first-launch sign-in) may or may not be done by the time this lands. If they are not yet done, the landing surface still becomes the post-launch entry point â€” sign-in just is not enforced upstream of it. Coordinate sequencing in triage if both this and tb-02 are picked up simultaneously.
