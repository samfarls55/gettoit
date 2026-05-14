---
issue: tb-02
title: Wire forced first-launch Apple sign-in (iOS) + waiting-screen download CTA (web)
github_issue: 50
status: ready-for-agent
type: AFK
created: 2026-05-14
prd: v1-prd
---

# tb-02 — Wire account creation surfaces

## Parent

[[../_index|v1.1 backlog]] candidate #7 (tracer-bullet half; spec-gap is [[sg-03-account-creation-surfaces|sg-03]]).

## What to build

Two deliverables, one on iOS, one on web. Both consume specs from [[sg-03-account-creation-surfaces|sg-03]].

### iOS — forced first-launch sign-in

A fresh install lands on the new sign-in surface. Sign in with Apple is mandatory; there is no skip. On successful sign-in the app proceeds to the landing surface ([[tb-01-landing-page-wire|tb-01]]) or directly to the initiator if landing has not yet shipped. Subsequent launches with a stored session bypass the sign-in surface.

### Web — invitee waiting-screen download CTA

An anonymous web invitee on the waiting surface sees a "Download the app" CTA. Tap opens the App Store iOS download link in the system browser. iOS users on the same waiting surface do not see the CTA.

## Scope

### iOS

- Replace the existing anonymous-default launch path with the forced sign-in gate. Reuse the Apple sign-in plumbing from [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] / `AuthUpgradeChip` work — same `ASAuthorizationAppleIDProvider` flow, called eagerly at launch instead of via mid-session chip.
- Persist the Apple credential and use it on subsequent launches to skip the sign-in surface.
- Remove or hide the now-redundant `AuthUpgradeChip` mid-session — anonymous users no longer exist on iOS post-sign-in. (Confirm this matches [[sg-03-account-creation-surfaces|sg-03]] resolution of the iOS/web asymmetry; do not silently delete if spec retains it.)

### Web

- In the web waiting surface, render the "Download the app" CTA conditionally on:
  - `auth.user?.is_anonymous === true` (anonymous web invitee, not a returning authed user)
  - Web platform (suppress on iOS).
- CTA opens the App Store URL (use the GetToIt App Store URL once available; for v1.1 a placeholder URL is acceptable if Apple ingest is still pending — flag in a follow-up).

## Acceptance criteria

- [ ] On a fresh iOS install (deleted app + reinstall), launching the app lands on the sign-in surface; no other surface is reachable without completing sign-in.
- [ ] After sign-in, subsequent launches skip the sign-in surface and land on the existing post-sign-in destination.
- [ ] Existing v1 quiz / verdict / reroll flows continue to work end-to-end on iOS for signed-in users.
- [ ] On web, an anonymous invitee on the waiting surface sees the "Download the app" CTA; tapping it opens the App Store URL.
- [ ] On web for a signed-in user on the waiting surface (rare in v1.1 since web Apple sign-in is not offered per [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]], but possible if state ever changes), the CTA is suppressed.
- [ ] No inline hex / token bypass in either codebase. `verify.mjs` green for `web/`.
- [ ] Manual TestFlight + web smoke check covering both flows.

## Blocked by

- [[sg-03-account-creation-surfaces|sg-03]] — surface specs must land first.

## Notes

- Coordinate sequencing with [[tb-01-landing-page-wire|tb-01]]: if both land before each other, the post-sign-in destination is whatever the launch routing currently points at. Either tb-01 or tb-02 can land first; the other should update the post-sign-in destination at merge time.
- The App Store URL for the published app may be placeholder until first ingest completes (see [[../../../60_engineering/adr|engineering ADRs]] and the TestFlight CI work). Flag as a hardcoded constant that needs swapping at GA.
