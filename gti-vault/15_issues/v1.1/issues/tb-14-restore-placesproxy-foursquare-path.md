---
issue: tb-14
title: Restore the PlacesProxy Foursquare path — deploy + secrets
status: ready-for-agent
type: AFK
github_issue: 91
prd: v1.1-quiz-redesign-prd
created: 2026-05-16
---

# tb-14 — Restore the PlacesProxy Foursquare path

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]]. Completes the deploy-side half of [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]] — bug-03 wired the `PlacesService` call site, but the `places-proxy` Edge Function it calls never reaches Foursquare in a live session.

## What to build

The live quiz invokes the `places-proxy` Supabase Edge Function on every session, but Foursquare is never reached — every call falls through to the on-device MapKit fallback (confirmed: switching cities changes the Q5 options, i.e. MapKit is doing the work). The Foursquare API key and account are known-good (one historical call logged during v1 development), so this is a deployment/configuration gap, not a credentials problem.

Confirm the current state of the `places-proxy` Edge Function on the Supabase project and bring it live:

- Verify whether `places-proxy` is deployed; deploy it if not.
- Verify the function's server-side secrets are set — `FOURSQUARE_API_KEY` (value is already in the repo `.env`), plus the `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` the handler reads. A missing key makes the handler return `places_proxy_misconfigured`.
- Ensure the `places` cache table exists on the project database (the handler upserts into it; a missing table surfaces as an empty 200 response). Apply pending migrations if needed.

End state: a real quiz session reaches Foursquare and Q5 candidates come from Foursquare data, not the MapKit fallback.

## Acceptance criteria

- [ ] `places-proxy` Edge Function is deployed to the Supabase project.
- [ ] Function secrets are set; a direct invocation with a valid coordinate returns HTTP 200 with a non-empty `places` array and `is_thin: false` — not `places_proxy_misconfigured`.
- [ ] The `places` cache table exists on the project database.
- [ ] An integration test invokes the deployed function with a known coordinate and asserts a Foursquare-sourced response (real `fsq_place_id`s, not `mapkit:`-prefixed synthetic ids).
- [ ] Founder check: the Foursquare developer dashboard shows a non-zero call count after a real session reaches Q5. *(Founder checkbox — not an AFK blocker.)*

## Blocked by

None — can start immediately.
