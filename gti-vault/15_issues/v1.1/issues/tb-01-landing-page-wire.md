---
issue: tb-01
title: Wire landing surface into iOS — route to existing Pick a Vertical
github_issue: 49
status: ready-for-agent
type: AFK
created: 2026-05-14
prd: v1-prd
---

# tb-01 — Wire landing surface into iOS

## Parent

[[../_index|v1.1 backlog]] candidate #6 (tracer-bullet half; spec-gap is [[sg-02-landing-page-surface|sg-02]]).

## What to build

Wire the landing surface from [[sg-02-landing-page-surface|sg-02]] into the iOS app as the post-sign-in entry point. The user lands here after first-launch Apple sign-in (per [[sg-03-account-creation-surfaces|sg-03]]); from here they choose Start a Decision (routes to existing "Pick a Vertical" screen) or Account Settings (routes to existing delete-your-data page).

End-to-end behavior:

- App launch → (if not signed in) Apple sign-in gate → landing surface.
- App launch → (if already signed in) directly to landing surface.
- Landing surface "Start a Decision" tap → existing "Pick a Vertical" screen → existing food flow.
- Landing surface "Account Settings" tap → existing settings / delete-your-data screen.

## Scope

- Add a new SwiftUI view consuming the `ScreenLanding` JSX spec from [[sg-02-landing-page-surface|sg-02]] verbatim. Tokens via the iOS token consumer (whatever shape `design-system/` exposes once a Swift generator lands — until then, manual token consumption that matches the JSX).
- Modify the iOS launch routing to land on the new view after sign-in, not directly on the initiator surface.
- Route the two buttons to the existing destinations. No changes to those destinations in this issue.

## Acceptance criteria

- [ ] Cold-launching the app on a signed-in account lands on the new landing screen, not directly on the initiator surface.
- [ ] "Start a Decision" navigates to the existing "Pick a Vertical" screen with no behavior change downstream.
- [ ] "Account Settings" navigates to the existing settings / delete-your-data screen.
- [ ] No raw hex / px / easing in the new SwiftUI view — tokens only.
- [ ] Manual TestFlight smoke check: launch → land on landing → both buttons route correctly → existing food flow still works end-to-end.

## Blocked by

- [[sg-02-landing-page-surface|sg-02]] — landing surface spec must land first.

## Notes

- This issue assumes [[sg-03-account-creation-surfaces|sg-03]] and [[tb-02-account-creation-wire|tb-02]] (forced first-launch sign-in) may or may not be done by the time this lands. If they are not yet done, the landing surface still becomes the post-launch entry point — sign-in just is not enforced upstream of it. Coordinate sequencing in triage if both this and tb-02 are picked up simultaneously.
