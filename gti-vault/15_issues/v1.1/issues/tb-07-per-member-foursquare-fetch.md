---
issue: tb-07
title: Per-member real Foursquare fetch + Q1-Q4 completion trigger
status: ready-for-agent
type: AFK
github_issue: 68
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-07 — Per-member real Foursquare fetch

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — modules (D) fetch planner + (F) fetch executor. The real, at-scale closure of [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]]'s silent no-call failure mode.

## What to build

When a member completes Q1-Q4, fire a Foursquare fetch tailored to their answers:

- **Fetch planner (pure).** Input: the member's Q1 cuisines + Q2 price, plus the shared parameters and profile. Output: **N+1** call specs — one category-filtered call per craved cuisine (N = 1-3) plus one mandatory general call. Hard filters (parameter geo / meal-time, transport radius, Q2 price) are applied. Cuisine and reputation do **not** strict-filter the fetch — the Q5 factorial needs that variety; the general call supplies non-craved breadth.
- **Fetch executor (I/O).** Executes the N+1 specs in parallel, unions and dedupes results by venue id.
- **Trigger.** Completion of Q1-Q4 fires the fetch — this replaces the bug-03 failure mode where Foursquare was called once, early, with empty filters before any answer existed.

## Acceptance criteria

- [ ] Completing Q1-Q4 fires a Foursquare fetch with a nonzero call count.
- [ ] The fetch is N+1 calls — one category-filtered call per craved cuisine (N=1-3) plus one general call.
- [ ] Hard filters (geo, meal-time, radius, price) are applied; cuisine and reputation are not strict fetch filters.
- [ ] Results union and dedupe by venue id.
- [ ] The planner has pure unit tests: call count, per-cuisine category filters, the mandatory general call, hard filters applied.
- [ ] A recording-proxy boundary test asserts the N+1 calls actually fire with the correct count for the happy path and the planner specs forward intact — the explicit bug-03 regression guard. Follow the `QuizSessionAssemblerTests.swift` `PlacesProxyClient` pattern.

## Blocked by

- [[research-01-foursquare-filter-surface|research-01]] — fetch filter surface must be fixed first.
- [[tb-04-votes-jsonb-schema|tb-04]] — reads answers from the jsonb slots.
- [[tb-06-quiz-q1-q4-rework|tb-06]] — needs the real Q1 cuisines and Q2 price.
