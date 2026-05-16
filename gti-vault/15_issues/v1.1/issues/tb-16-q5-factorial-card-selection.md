---
issue: tb-16
title: Q5 factorial card selection in the live quiz
status: ready-for-agent
type: AFK
github_issue: 93
prd: v1.1-quiz-redesign-prd
created: 2026-05-16
---

# tb-16 — Q5 factorial card selection in the live quiz

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — modules (C) factorial card generator + (E) axis scorers. Closes the live-wiring gap flagged as an adjacency in [[tb-08-q5-factorial-probe|tb-08]] and [[tb-09-preference-function-axis-scorers|tb-09]].

## What to build

With the answer-tailored venue pool now landing from TB-15, Q5 should present the three strict-factorial probe cards the v1.1 redesign specified — not simply the first three pooled venues. The factorial generator (`Q5FactorialCardGenerator`, tb-08) and the axis scorers / preference function (tb-09) are built and tested but have no live callers.

Wire the factorial pipeline into the running quiz:

- Classify each pooled venue into a `Q5VenueProfile` using the tb-09 axis scorers (cuisine / reputation / vibe).
- Run `Q5FactorialCardGenerator.generate` against the member's stated Q1-Q4 profile and the profiled pool.
- Feed the three resulting factorial cards to the Q5 surface as `QuizCandidate`s carrying real `fsq_place_id`s.

## Acceptance criteria

- [ ] Q5 renders exactly three cards selected by `Q5FactorialCardGenerator` — one cuisine-drop, one reputation-drop, one vibe-drop.
- [ ] Each card deviates from the member's stated profile on exactly one axis; no card is a perfect match.
- [ ] Pooled venues are classified into `Q5VenueProfile`s by the tb-09 axis scorers before the generator runs.
- [ ] On pool starvation (`generate` returns nil), the existing surface-boundary fallback still renders three rateable rows — no placeholder venues invented mid-pool.
- [ ] Q5 ratings persist against real venue ids in the `votes.q5` jsonb slot (wire shape unchanged).
- [ ] Integration test through the live `QuizSessionAssembler` to Q5 path: a canned pool yields three one-axis-deviation cards.

## Blocked by

[[tb-15-wire-answer-tailored-fetch|TB-15 (v1.1)]] — the factorial generator consumes the answer-tailored venue pool that slice delivers.
