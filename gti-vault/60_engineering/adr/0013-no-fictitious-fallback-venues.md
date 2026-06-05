---
adr: 0013
title: No fictitious fallback venues â€” Q5 no-results mode
status: accepted
date: 2026-05-19
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0013 â€” No fictitious fallback venues â€” Q5 no-results mode

## Status

Accepted â€” 2026-05-19. Implemented by tb-26 (2026-05-19) â€” see Implementation.

## Context

Q5 is the per-member preference probe: the member rates three real,
strict-factorial candidate venues 1â€“5 on excitement
([[../../15_issues/0.1.0/issues/tb-08-q5-real-candidate-wiring|the 0.1.0 PRD module C]]).
The three cards come from the per-member Foursquare fetch â€” N+1 calls,
classified into axis profiles, then run through
`Q5FactorialCardGenerator`, which returns exactly three one-axis-deviation
cards or `nil`.

From the tb-04 era the iOS app shipped a build / testing scaffold:
`QuizDummyCandidates` â€” three hardcoded fictitious restaurants (`Pico's
Taqueria`, `Ren Soba House`, `Bar Pastoral`). Whenever the per-member
fetch produced no factorial-usable pool, the app rendered the dummy
fixture as the Q5 cards. Four distinct paths reached the fixture:

1. The fetched venue union was empty (proxy thin AND MapKit empty).
2. The factorial generator returned `nil` â€” a real but too thin /
   uniform pool.
3. The whole fetch threw.
4. There was no session coordinate to fetch against.

A member hitting any of those four paths was shown three made-up
restaurants and could rate them â€” a fictitious place presented as a real
recommendation. That is a correctness and trust defect, not a cosmetic
one. The web app already degraded cleanly (`PlacesEmptyState`); only iOS
shipped fiction.

## Decision

**The app never surfaces a fictitious venue.** `QuizDummyCandidates` is
deleted from the iOS app target. In its place Q5 gains a **`no-results`
mode** â€” specced in the design system by
[[../../15_issues/0.1.0/issues/sg-05-q5-no-results-mode|sg-05]] and
consumed by iOS in
[[../../15_issues/0.1.0/issues/tb-26-remove-fictitious-fallback-venues|tb-26]].

When the per-member fetch produces no factorial-usable pool â€” any of the
four paths above â€” Q5 renders a centered headline + body block plus a
sun-fill `"Head to the verdict"` CTA, mirroring the verdict-side
`no-survivor` mode. The three rater cards and the `"Drop the verdict"`
CTA are suppressed. The locked copy is:

- **Headline:** `No spots to rate near you.`
- **Body:** `Couldn't line up rateable spots in your radius tonight.
  Your other answers still count â€” the verdict lands without this step.`
- **CTA:** `Head to the verdict`

### Skip-ahead behavior

The no-results CTA runs the **same submit-then-route path** as the
normal Q5 CTA. The member's quiz submits â€” Q1â€“Q4 answers plus an **empty
Q5 ratings array** â€” and they advance to Waiting (group) or the verdict
(solo). The member is never stranded mid-flow. A solo member with no
candidates lands on the existing `no-survivor` verdict; no extra work.

`compute-verdict`'s Q5 reader (`readQ5Ratings` in
`votes-schema.ts`) already tolerates an empty `votes.q5.answer.ratings`
array â€” it returns no ratings, and `buildPreferenceFunction` degrades to
the equal-weight 1/3 prior over the member's stated Q1/Q3/Q4 axes. No
server change was needed; tb-26 added a regression test that pins this.

### The thin-pool carve-out

A member who fetched **real** venues but no strict factorial triple
(path 2) now sees the no-results screen even though real venues exist in
their fetch. This is intentional:

- The Q5 factorial probe is **all-or-nothing** â€” the generator returns
  three cards or `nil`, never one or two. Surfacing a partial /
  non-factorial card set would break the `{droppedAxis, score}` vote
  shape that `compute-verdict`'s per-member re-weight reads.
- Removing the dummy changes only what Q5 **displays**. Those real
  venues still persist to `member_fetches` via `rawFetch` and still feed
  the verdict candidate pool ([[../../15_issues/0.1.0/issues/tb-21-persist-fetch-server-union|TB-21]]).
  A verdict winner may be a venue shown to no member at Q5.

## Why

1. **Trust.** A recommendation app that invents restaurants is broken in
   the way that matters most. The scaffold outlived its purpose the
   moment the real per-member fetch was wired (tb-08 / tb-15 / tb-16).
2. **Honest degradation already exists elsewhere.** The verdict surface
   has `no-survivor`; the web app has `PlacesEmptyState`. The Q5
   `no-results` mode is the same pattern â€” a centered honest message, an
   action-shaped CTA, no filler. It is built entirely from existing
   design-system primitives (C-01 / C-02 / C-03 / C-05) and existing
   tokens â€” no new component, no new token.
3. **The flow must never stall.** The forward CTA preserves the
   no-back-arrow quiz invariant: a member with no candidates still
   submits their other four answers and reaches a verdict.
4. **The verdict pool is untouched.** The all-or-nothing factorial and
   the `rawFetch` persistence path mean the no-results screen is purely
   a display decision. The verdict engine still sees every real venue.

## Considered options

- **Render one or two cards when the factorial is short** â€” rejected.
  The factorial is all-or-nothing by design; a partial card set has no
  well-formed `{droppedAxis, score}` shape, and a member rating a
  non-factorial set produces a probe reading the verdict re-weight
  cannot interpret.
- **Keep a fixture, but move it behind a debug flag** â€” rejected. A
  shipped binary that *can* render fiction is one config mistake away
  from doing so. The only safe state is zero fictitious venues in the
  app target.
- **Skip Q5 silently (no screen)** â€” rejected. A surface that vanishes
  with no explanation reads as a bug. The honest message also tells the
  member their other answers still count, which is true and reassuring.

## Consequences

### Positive

- The shipped iOS app target contains zero hardcoded fictitious venues.
- A member with no factorial-usable pool gets an honest message and a
  working path to their verdict, never a made-up restaurant.
- The Q5 candidates state and the candidate-fetch source are now
  honestly named (`.noResults`, not `.fallbackDummy`); the no-coordinate
  fetch double is `NoResultsQuizCandidateFetch`, not
  `DummyQuizCandidateFetch`.

### Negative / accepted tradeoffs

- A member whose fetch returned real-but-thin venues sees the no-results
  screen and rates nothing â€” their verdict for that session uses the
  equal-weight prior rather than a revealed Q5 weight hierarchy.
  Accepted: a thin factorial cannot produce a valid probe anyway, and
  the prior is a deliberate, neutral fallback.
- Test code still needs a small candidate fixture to drive the
  coordinator's legacy `candidates:` init. That fixture
  (`QuizCandidateFixtures`) moved into the **test target** â€” it is
  fictitious test data that never reaches a production code path.

## Implementation

Built by tb-26 (2026-05-19):

- `ios/Sources/App/QuizCoordinator.swift` â€” `QuizDummyCandidates`
  deleted; the legacy `candidates:` init now defaults to an empty list;
  the `Q5CandidatesState.fallbackDummy` case renamed to `.noResults`.
- `ios/Sources/App/QuizCandidateFetch.swift` â€” the result `Source`
  `.fallbackDummy` case renamed to `.noResults`; all four no-results
  paths return an empty candidate list (preserving the real `rawFetch`
  where it exists); `DummyQuizCandidateFetch` renamed to
  `NoResultsQuizCandidateFetch`.
- `ios/Sources/App/QuizSessionAssembler.swift` â€” `CandidateSource`
  `.fallbackDummy` renamed to `.noResults`; the no-coordinate path wires
  `NoResultsQuizCandidateFetch`.
- `ios/Sources/App/QuizQ5NoResults.swift` â€” new view: the Q5
  `no-results` screen, matching sg-05's spec and locked copy, built from
  existing primitives and tokens.
- `ios/Sources/App/QuizScreen.swift` â€” Q5 routes to `QuizQ5NoResults`
  when the candidates state is `.noResults`; its CTA runs the same
  `submitFromQ5` path.
- `ios/Tests/QuizCandidateFixtures.swift` â€” new test-target fixture
  replacing the deleted app-target dummy.
- `supabase/functions/_shared/votes-preference-inputs.test.ts` â€” a
  regression test pinning that an empty `votes.q5.answer.ratings` array
  maps to no Q5 ratings and degrades the preference function to the
  equal-weight prior. No `compute-verdict` production change was needed.

## References

- [[../../15_issues/0.1.0/issues/sg-05-q5-no-results-mode|sg-05]] â€” the
  Q5 `no-results` mode design-system surface spec.
- [[../../15_issues/0.1.0/issues/tb-26-remove-fictitious-fallback-venues|TB-26]]
  â€” the iOS consumption of sg-05; this ADR records its decision.
- [[0010-generic-jsonb-votes-schema|ADR 0010]] â€” the generic `votes`
  jsonb schema whose Q5 reader tolerates an empty ratings array.
- [[0011-worst-off-protecting-verdict-engine|ADR 0011]] â€” the verdict
  engine; its `no-survivor` mode is the structural precedent for the Q5
  `no-results` mode.
- [[../../15_issues/0.1.0/issues/tb-21-persist-fetch-server-union|TB-21]]
  â€” the `member_fetches` / `rawFetch` path that keeps the verdict
  candidate pool unaffected by the dummy removal.
