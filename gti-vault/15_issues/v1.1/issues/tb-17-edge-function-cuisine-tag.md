---
issue: tb-17
title: Edge Function honors the cuisine advisory tag
status: ready-for-agent
type: AFK
github_issue: 94
prd: v1.1-quiz-redesign-prd
created: 2026-05-16
---

# tb-17 — Edge Function honors the cuisine advisory tag

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]]. Closes the server-side adjacency flagged in [[tb-07-per-member-foursquare-fetch|tb-07]] — the iOS request body carries a `cuisine` tag the Edge Function does not yet consume.

## What to build

The iOS per-cuisine fetch calls already carry a `cuisine` tag on the request body (a `QuizCuisine` id, e.g. `mexican`), but the `places-proxy` Edge Function ignores the key. As a result the N per-cuisine calls return the same results as the mandatory general call — the N+1 fan-out currently buys nothing.

Make the Edge Function honour the tag:

- Map each `QuizCuisine` id to a Foursquare category id, server-side, alongside the existing `DIETARY_CHIP_MAP` in the shared Foursquare module.
- When a request carries a `cuisine` tag, apply that category to the Foursquare query for that call.
- The mandatory general call (no `cuisine` tag) stays un-category-scoped — it supplies the non-craved breadth the Q5 factorial needs. Cuisine therefore never strict-filters the *fetch as a whole* (research-01 §3.2), even though each individual per-cuisine call is category-scoped.
- An unknown or absent `cuisine` value degrades gracefully to the general query — no error.

The cuisine-to-category id mapping needs real Foursquare taxonomy ids; research-01 did not pin them and the iOS client deliberately left them un-hardcoded. The implementing agent is authorized to source the category ids from current Foursquare documentation and commit the mapping.

## Acceptance criteria

- [ ] Each `QuizCuisine` id maps to a Foursquare category id, server-side.
- [ ] A request carrying a `cuisine` tag applies the mapped category to the Foursquare query for that call.
- [ ] The mandatory general call (no `cuisine` tag) remains un-category-scoped.
- [ ] An unknown / absent `cuisine` value degrades gracefully to the general query — no error; decode stays tolerant of the missing key.
- [ ] Deno tests in the `places-proxy` test harness cover the cuisine-to-category mapping and the general-call-unaffected case.

## Blocked by

None — server-side, verifiable via the function's deno test harness. Observable end-to-end only once [[tb-15-wire-answer-tailored-fetch|TB-15 (v1.1)]] ships the live N+1 fetch.
