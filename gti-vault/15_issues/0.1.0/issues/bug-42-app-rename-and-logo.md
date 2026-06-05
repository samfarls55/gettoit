---
issue: bug-42
title: App rename and logo before v1
status: needs-triage
type: HITL
github_issue: 314
created: 2026-05-26
grilled: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-42 â€” App rename and logo (HITL placeholder)

## Symptom

Founder may rename the app and/or replace the logo before v1 ships to the App Store. Current state: ASC storefront name is "GetToIt - Do More, Plan Less" (plain "GetToIt" was taken â€” see [[project_asc_app_name]]); home-screen icon still reads "GetToIt". Logo is the current GTI mark.

A rename touches many surfaces: ASC listing, bundle display name, iOS app icon, web favicon + landing page mark, marketing/branding docs, support email domain, in-app copy, push notification copy, Privacy + Terms documents, telemetry namespaces.

## Why HITL

Naming and brand identity are founder-driven. Also high blast radius â€” a botched rename leaks across legal docs, ASC review state, and any cached App Store metadata. Needs a planned cutover, not an AFK refactor.

## What this issue does NOT do pre-grill

- Pick the new name (if any).
- Touch any rename surface yet.
- Commission a new logo.

## Acceptance criteria (placeholder)

- [ ] Founder has decided: rename yes/no. If yes, new name locked.
- [ ] Founder has decided: new logo yes/no. If yes, logo asset finalized.
- [ ] Rename cutover plan written (every surface enumerated; ASC review impact assessed).
- [ ] Cutover executed in a coordinated sweep (likely a single PR or tight sequence).

## Cutover surfaces (non-exhaustive)

- App Store Connect â€” app name, subtitle, screenshots, promotional text
- `ios/project.yml` â€” bundle display name, asset catalog app icon
- `ios/Sources/Assets.xcassets/AppIcon.appiconset/` â€” icon set
- `web/app/layout.tsx`, `web/public/` â€” favicon, OG image, page titles
- `web/app/page.tsx` â€” landing page mark (see [[bug-35-landing-page-pre-launch]])
- `40_marketing_branding/` â€” positioning, voice, brand docs
- `supabase/functions/*` â€” any user-visible copy in emails/templates
- Privacy Policy + Terms documents (currently reference "GetToIt")
- Push notification copy, in-app strings, telemetry event names (if branded)
- `support@gettoit.app` mailbox plan ([[project_support_email_todo]]) â€” domain may change

## References

- [[project_asc_app_name]] (memory) â€” current ASC name + storefront constraint
- [[project_pre_public_launch_milestone]] (memory)
- [[bug-35-landing-page-pre-launch]] â€” landing page rebrand surface
- [[bug-43-marketing-and-messaging]] â€” sibling marketing issue
