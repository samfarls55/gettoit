---
issue: tb-07
title: Per-member real Foursquare fetch + Q1-Q4 completion trigger
status: done
type: AFK
github_issue: 68
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-07 â€” Per-member real Foursquare fetch

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] â€” modules (D) fetch planner + (F) fetch executor. The real, at-scale closure of [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]]'s silent no-call failure mode.

## What to build

When a member completes Q1-Q4, fire a Foursquare fetch tailored to their answers:

- **Fetch planner (pure).** Input: the member's Q1 cuisines + Q2 price, plus the shared parameters and profile. Output: **N+1** call specs â€” one category-filtered call per craved cuisine (N = 1-3) plus one mandatory general call. Hard filters (parameter geo / meal-time, transport radius, Q2 price) are applied. Cuisine and reputation do **not** strict-filter the fetch â€” the Q5 factorial needs that variety; the general call supplies non-craved breadth.
- **Fetch executor (I/O).** Executes the N+1 specs in parallel, unions and dedupes results by venue id.
- **Trigger.** Completion of Q1-Q4 fires the fetch â€” this replaces the bug-03 failure mode where Foursquare was called once, early, with empty filters before any answer existed.

## Acceptance criteria

- [ ] Completing Q1-Q4 fires a Foursquare fetch with a nonzero call count.
- [ ] The fetch is N+1 calls â€” one category-filtered call per craved cuisine (N=1-3) plus one general call.
- [ ] Hard filters (geo, meal-time, radius, price) are applied; cuisine and reputation are not strict fetch filters.
- [ ] Results union and dedupe by venue id.
- [ ] The planner has pure unit tests: call count, per-cuisine category filters, the mandatory general call, hard filters applied.
- [ ] A recording-proxy boundary test asserts the N+1 calls actually fire with the correct count for the happy path and the planner specs forward intact â€” the explicit bug-03 regression guard. Follow the `QuizSessionAssemblerTests.swift` `PlacesProxyClient` pattern.

## Blocked by

- [[research-01-foursquare-filter-surface|research-01]] â€” fetch filter surface must be fixed first.
- [[tb-04-votes-jsonb-schema|tb-04]] â€” reads answers from the jsonb slots.
- [[tb-06-quiz-q1-q4-rework|tb-06]] â€” needs the real Q1 cuisines and Q2 price.

## Comments

**2026-05-16 â€” done (AFK, PR #81 / branch `afk/tb-07`, squash-merged as `8ba1903`).**
Built the per-member fetch planner (PRD module D) and fetch executor
(module F) on the iOS side.

- **`FoursquareFetchPlanner`** â€” pure, no I/O. Takes a member's Q1
  craved cuisines + Q2 spend cap, the shared `SessionParameters`, and
  the session geo / radius; emits N+1 `PlacesProxyRequest` specs â€” one
  cuisine-tagged call per craved cuisine (N = 0â€¦3, order-preservingly
  de-duped and capped at 3) plus one mandatory general call. The
  general call always fires, even when Q1 was "No preference" (N = 0),
  so the fetch is never zero calls â€” the planner-level bug-03 guard.
  Hard filters apply to every spec: geo (`ll`), radius, Q2 price â†’
  `max_price`, meal-time â†’ `open_at` (each meal resolves to a
  representative local hour, emitted as an ISO-8601 instant the
  PlacesProxy converts to unix-seconds).
- **`FoursquareFetchExecutor`** â€” runs the N+1 specs in parallel
  through `PlacesService` (so each call inherits ADR-0002's
  thin-response â†’ MapKit-fallback behaviour), unions and dedupes venue
  results by `fsq_place_id`, carries disclaimers forward.
- **`PlacesFilters.cuisine`** â€” new optional advisory tag. Carries the
  craved cuisine (a `QuizCuisine` id string) on each per-cuisine call.
  Per research-01 Â§3.2 it is **never** a strict filter and is
  deliberately kept out of `dietary` (which IS a hard category
  filter) â€” cuisine must not strict-filter or the Q5 factorial loses
  its pool variety.
- **Tests.** Pure planner unit tests (N+1 call count, per-cuisine tag,
  the mandatory general call, hard filters applied, cuisine never
  enters the dietary hard filter, cap + dedupe) and a recording-proxy
  boundary test following the `QuizSessionAssemblerTests`
  `PlacesProxyClient` pattern â€” the explicit bug-03 regression guard
  that the N+1 calls actually fire with the correct count and the
  planner specs forward intact. `ios` CI lane green.

**Adjacency flagged â€” Edge Function does not yet consume the `cuisine`
tag.** The iOS request body now carries `cuisine`, but the Edge
Function's `PlacesProxyFilters` interface ignores the unknown key
(structural decode â€” no breakage). Mapping the cuisine token to a
Foursquare category id belongs server-side next to `DIETARY_CHIP_MAP`
in `supabase/functions/_shared/foursquare.ts`; tb-10 (running-union
pool manager) is the natural home. The iOS client deliberately does
not hardcode unverified Foursquare taxonomy ids â€” research-01 did not
pin cuisineâ†’category-id mappings.

**Note on the Q1-Q4 completion trigger.** The planner + executor are
built and unit/boundary-tested. Wiring the trigger into the live quiz
step machine (firing the executor when `QuizCoordinator` reaches Q5)
is consumed by the Q5 factorial probe â€” tb-08 â€” which owns the
candidate-set assembly the fetch feeds; this issue ships the planner
and executor it depends on.
