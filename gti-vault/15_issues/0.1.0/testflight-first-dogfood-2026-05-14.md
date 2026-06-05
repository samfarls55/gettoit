---
title: TestFlight first-dogfood notes
date: 2026-05-14
context: First install of GetToIt on real iPhone via TestFlight (build 0.1.0). Raw observations dumped after a Go-Solo flow run-through. Awaits triage â†’ issues.
status: raw
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TestFlight first-dogfood â€” 2026-05-14

First time the app ran on a real device. Below is unfiltered first-impression
feedback. Each bullet is a candidate issue for `15_issues/`; the wording is
close-to-verbatim so we don't lose the original intent during triage.

## Visual / contrast

- **Home-page contrast is low.** Yellow and white don't go well together on
  the surface. Need to revisit the on-gradient text colors against the
  initiator gradient, or rethink the yellowâ†’white pairing on the home
  surface specifically.

## Missing surfaces / flows

- **Landing page.** The app needs a proper landing surface â€” what users see
  before they enter a session. Today it drops straight into the initiator.
- **Account creation flow.** No surface for sign-up today. Sign in with
  full "create account" path isn't built out.

## Geography / location

- **Geography awareness.** App needs to understand where the user is. Most
  food / place decisions are location-bounded â€” without this, recommendations
  can't be real. Likely overlaps with the existing `PlacesService` /
  `MapKitPlacesFallback` work in `ios/Sources/App/`, but the surface that
  *asks for* location permission and explains why doesn't exist yet.

## Motion

- **Question transitions feel slow.** Concrete repro: tap **Go Solo**,
  select an answer â€” the UI advances to the next question instantly, but
  the background gradient lags ~1s behind. Should be a seamless single
  transition where UI + background animate together.
    between the foreground card transition and the gradient interpolation.

## Question content

- **Last question shows generic options, not real options.** The final
  question (Q5 Regret?) still presents placeholder / generic choices
  rather than real candidate venues. Should be sourced from
  `PlacesService` results filtered by the answers so far.

- **Questions need rework.** Allergies (and similar fixed personal-trait
  data) should be **user-profile settings** stored at account level â€” not
  re-asked every session. The in-session questions should narrow toward
  *mood / situational context* (what are you in the mood for right now?)
  rather than re-collect static data.

- **Anonymous-user fallback.** When the user is **not** logged in (e.g.
  arrived via a text-message invite link), add a **6th question** at the
  start of the flow asking for allergies + similar constraints, since
  there's no profile to read from. Logged-in users skip this question
  entirely because the data is on their account.

## Landing-page UX

- **Distance + time sliders are unclear.** Intent isn't obvious. What unit?
  What does "0" mean? Are they filters, preferences, hard constraints?
  Either rework the labels / context, remove them from the landing page, or
  move them into the questions flow where they have more context.

## Sharing / invite link

- **Invite link is plain text in iMessage.** When sent via SMS / iMessage,
  the link comes through as raw text â€” no icon, no preview. Apple's
  AASA + universal-links mechanism is supposed to surface a rich preview
  card with an icon. Either the AASA file isn't being read or the
  universal-link metadata isn't set up.
  - Cross-ref: TB-00 published the AASA at
    `https://gettoit.app/.well-known/apple-app-site-association`;
    TB-02 plumbs the iOS side via `associated-domains` entitlement.
    Should verify both ends are correct and that Open Graph / iMessage
    rich-preview metadata is set on the destination page.

- **Invite link â†’ 404.** Tapping the invite link 404s. Doesn't open the
  app, doesn't open the web fallback. Almost certainly related to the
  point above â€” the destination URL either doesn't exist or the AASA â†’
  app handoff is broken. **Likely the highest-priority bug here** because
  it breaks the entire invite flow end-to-end.

## Triage notes (for whoever processes this)

- Several of these (landing page, account flow, geography permission)
  are missing-surface gaps â€” they're spec-level decisions that have to
- The 404 + plain-text link are real bugs against shipped functionality
  and should jump the queue.
- The motion lag is a localized fix in the relevant `CHOREO` constants.
- The questions rework is a product decision â€” talk to product / read
  `50_product/` before deciding on the split between
  in-session vs profile-level data.
- This file is raw; let `to-issues` or a `compile` pass split these into
  individual `15_issues/` notes with proper severity, status, and
  cross-refs.
