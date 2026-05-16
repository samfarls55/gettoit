---
issue: tb-15
title: Wire the answer-tailored Foursquare fetch into the live quiz
status: ready-for-agent
type: AFK
github_issue: 92
prd: v1.1-quiz-redesign-prd
created: 2026-05-16
---

# tb-15 — Wire the answer-tailored Foursquare fetch into the live quiz

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — modules (D) fetch planner + (F) fetch executor. Closes the live-wiring gap flagged as an adjacency in [[tb-07-per-member-foursquare-fetch|tb-07]].

## What to build

The live quiz still runs the [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]] tracer-bullet bridge: `QuizSessionAssembler` builds the quiz coordinator before the user answers anything, calling `PlacesService` once with an empty filter set and truncating the result to three venues. The real per-member fetch built in tb-07 — `FoursquareFetchPlanner` plus `FoursquareFetchExecutor` — is fully built and unit/boundary-tested but has no live callers.

Wire the real fetch into the running quiz:

- The candidate fetch fires when the member completes Q1-Q4, driven by the quiz step machine — not on the pre-quiz assembler seam.
- The fetch runs the N+1 answer-tailored calls through `FoursquareFetchExecutor`, using the member's real Q1 cuisines, Q2 spend cap, and the session parameters.
- The executor's unioned, deduped venue pool becomes Q5's candidate source.
- The pre-quiz empty-filter fetch is removed; no remaining code path fetches candidates before the member has answered Q1-Q4.

This slice keeps Q5's existing flat presentation (the factorial selection is the next slice). The visible win is that Q5 candidates reflect the member's answers — e.g. the spend cap is respected — and the fetch fires at the right time with the right filters.

## Acceptance criteria

- [ ] Completing Q4 triggers the per-member fetch; no PlacesProxy/Foursquare call fires before Q1-Q4 are answered.
- [ ] The fetch uses `FoursquareFetchExecutor` with the member's real Q1 cuisines + Q2 spend cap + session parameters — never an empty `PlacesFilters()`.
- [ ] Q5 renders venues drawn from the executor's unioned pool; the Q2 spend cap is respected in the rendered set.
- [ ] The bug-03 early-fetch path is removed; no caller fetches candidates with empty filters.
- [ ] Boundary test (recording `PlacesProxyClient`, following the `QuizSessionAssemblerTests` / `FoursquareFetchExecutorTests` pattern): the N+1 calls fire after Q4 with the member's answers forwarded intact, and zero calls fire before Q4.
- [ ] Genuine pool starvation (proxy and MapKit both empty) still falls back to three rateable rows — no stranded flow.

## Blocked by

None — can start immediately. End-to-end verification against live Foursquare data depends on [[tb-14-restore-placesproxy-foursquare-path|TB-14 (v1.1)]]; the boundary tests do not.
