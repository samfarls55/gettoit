---
issue: tb-16
title: Q5 factorial card selection in the live quiz
status: done
type: AFK
github_issue: 93
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-16
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-16 â€” Q5 factorial card selection in the live quiz

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] â€” modules (C) factorial card generator + (E) axis scorers. Closes the live-wiring gap flagged as an adjacency in [[tb-08-q5-factorial-probe|tb-08]] and [[tb-09-preference-function-axis-scorers|tb-09]].

## What to build

With the answer-tailored venue pool now landing from TB-15, Q5 should present the three strict-factorial probe cards the 0.1.0 redesign specified â€” not simply the first three pooled venues. The factorial generator (`Q5FactorialCardGenerator`, tb-08) and the axis scorers / preference function (tb-09) are built and tested but have no live callers.

Wire the factorial pipeline into the running quiz:

- Classify each pooled venue into a `Q5VenueProfile` using the tb-09 axis scorers (cuisine / reputation / vibe).
- Run `Q5FactorialCardGenerator.generate` against the member's stated Q1-Q4 profile and the profiled pool.
- Feed the three resulting factorial cards to the Q5 surface as `QuizCandidate`s carrying real `fsq_place_id`s.

## Acceptance criteria

- [ ] Q5 renders exactly three cards selected by `Q5FactorialCardGenerator` â€” one cuisine-drop, one reputation-drop, one vibe-drop.
- [ ] Each card deviates from the member's stated profile on exactly one axis; no card is a perfect match.
- [ ] Pooled venues are classified into `Q5VenueProfile`s by the tb-09 axis scorers before the generator runs.
- [ ] On pool starvation (`generate` returns nil), the existing surface-boundary fallback still renders three rateable rows â€” no placeholder venues invented mid-pool.
- [ ] Q5 ratings persist against real venue ids in the `votes.q5` jsonb slot (wire shape unchanged).
- [ ] Integration test through the live `QuizSessionAssembler` to Q5 path: a canned pool yields three one-axis-deviation cards.

## Blocked by

[[tb-15-wire-answer-tailored-fetch|TB-15 (0.1.0)]] â€” the factorial generator consumes the answer-tailored venue pool that slice delivers.

## Comments

**2026-05-16 â€” done (AFK, branch `afk/tb-16`).** Wired the 0.1.0 Q5
factorial probe into the live quiz. TB-15 shipped Q5 with a *flat*
presentation â€” the raw fetched pool shaped first-3 into the Q5 rows.
TB-16 routes the pool through the strict factorial instead.

- **`Q5VenueClassifier`** (new, `ios/Sources/App/Q5VenueClassifier.swift`)
  â€” the `ShapedPlace -> Q5VenueProfile` axis classification tb-09
  explicitly deferred. Cuisine from `categories[]` keyword match; vibe
  from a category-archetype baseline table (research Â§5) with a bounded
  one-step `priceTier` tie-break; reputation pool-relatively bucketed
  over `rating` / `totalRatings` / `dateCreated` (research Â§4 â€” the
  volume terciles are computed within the fetched pool, not against a
  global constant). Pure, deterministic, no group state.
- **`FoursquareQuizCandidateFetch` rewired** â€” `fetchCandidates` now
  classifies the unioned pool, runs `Q5FactorialCardGenerator.generate`
  against the member's stated Q1-Q4 `Q5MemberProfile`, and shapes the
  three factorial cards (one cuisine-drop / one reputation-drop / one
  vibe-drop, never a perfect match) into the `[QuizCandidate]` list Q5
  renders, each carrying a real `fsq_place_id`.
- **`QuizCandidateFetch` protocol widened** â€” the per-member fetch now
  forwards the full Q1-Q4 answer set (`QuizFetchAnswers`), not just
  Q1+Q2; the factorial needs Q3 reputation + Q4 vibe to build the
  member's profile. The coordinator forwards them on the Q4 -> Q5
  transition.
- **Pool-starvation fallback preserved** â€” an empty union, or a union
  too thin / too uniform for the factorial to furnish three
  one-axis-deviation cards (`generate` returns `nil`), surfaces as the
  dummy fixture at the `FoursquareQuizCandidateFetch` boundary. Q5
  still renders three rateable rows; no placeholder venue is invented
  mid-pool (the bug-03 hard rule).
- **`ShapedPlace` extended** â€” three optional reputation fields
  (`rating`, `totalRatings`, `dateCreated`) added to the iOS struct
  and the Edge Function `ShapedPlace` / shaper / `fields` request, all
  additive and nullable. Without them every venue would classify to one
  reputation bucket and a member who states a Q3 preference would
  always hit the fallback. See the PR Decisions section.
- **Tests.** `Q5VenueClassifierTests` (cuisine / vibe / pool-relative
  reputation), `FactorialCardSelectionTests` (the pool -> factorial
  seam â€” three cards, one-axis deviation, real ids, starvation
  fallback), updated `QuizSessionAssemblerTests` (the live
  `QuizSessionAssembler` -> proxy -> factorial integration path with a
  canned varied pool), `QuizCandidateFetchTests` (Q3/Q4 forwarding).
  The Edge Function reputation projection is covered in
  `supabase/functions/_shared/foursquare.test.ts`; that suite runs
  green locally (207 passed). The `ios` CI lane runs the full
  `xcodebuild test`.
