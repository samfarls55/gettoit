---
title: iOS Q5 write path emits per-venue scores, not factorial ratings — TB-23 adjacency
status: raw
created: 2026-05-18
source: tb-23 AFK execution
flag: compile
---

# iOS Q5 write path emits per-venue scores, not factorial ratings

## What

[[../15_issues/v1.1/issues/tb-23-server-prefn-scoring|TB-23]] moved the verdict's
live scoring server-side: at fire time `compute-verdict` builds each member's
`prefFn` from their stated Q1/Q3/Q4 profile plus their three Q5 factorial card
ratings (the *preference probe*), and scores the full candidate pool with it.

The server reads the Q5 probe from the `votes.q5` slot's `answer.ratings` —
the canonical v1.1 shape, an array of `{ droppedAxis, score }` factorial-card
ratings, one per axis (cuisine / reputation / vibe).

The **iOS Q5 write path does not yet emit that shape.**
`QuizCoordinator.q5Ratings` is a `[String: Int]` map keyed by *venue id* — a
per-candidate score map (the pre-TB-23 model where the three Q5 cards WERE the
candidate scores). `buildVotesSlotsFromLegacyAnswers` in
`_shared/votes-schema.ts` likewise still wraps a `q5_scores` per-venue map into
the `regret` slot's `answer.scores`, not `answer.ratings`.

## Impact — graceful, not a break

The TB-23 server handler degrades gracefully:

- `mapVotesRowToPreferenceInputs` reads `answer.ratings`; when it is absent it
  yields an empty `q5Ratings` array.
- `buildPreferenceFunction` tolerates an empty probe — with no Q5 ratings the
  marginal-value re-weight is a no-op and the equal-weight 1/3 prior survives.
- So a member still gets a real `prefFn` scored off their Q1/Q3/Q4 profile;
  only the Q5 *re-weight* signal (which axis the member cares about most) is
  dark.

The verdict is still preference-correct on stated position; it just cannot yet
learn the per-member weight hierarchy the Q5 factorial was designed to reveal.

## Follow-up

A small iOS slice: have the Q5 surface capture each rating tagged with the
card's `droppedAxis` (the `Q5FactorialCard.Axis` is already on the card), and
write `votes.q5.answer.ratings` as the `{ droppedAxis, score }` array. The Q5
factorial card generator already carries `droppedAxis` per card, so the data is
present on-device — it just is not threaded into the vote row.

Recommend filing as a v1.1 tracer-bullet (depends on nothing — TB-23's server
side already accepts the shape).
