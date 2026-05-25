---
issue: tb-24
title: Wire the iOS Q5 write path to emit factorial {droppedAxis, score} ratings
status: done
type: AFK
github_issue: 130
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-18
---

# tb-24 — Wire the iOS Q5 write path to emit factorial ratings

## Parent

[[tb-23-server-prefn-scoring|tb-23]] adjacency. tb-23 moved verdict scoring server-side and made `compute-verdict` read each member's Q5 preference probe from `votes.q5.answer.ratings` — the canonical 0.1.0 factorial shape, a `[{ droppedAxis, score }]` array. The iOS write path was never in tb-23's scope and still emits the pre-tb-23 per-venue score map, so the Q5 re-weight signal is dark. This slice closes that wire. Compiled from `01_raw/tb-23-ios-q5-ratings-wire-gap.md`.

## What to build

The iOS Q5 surface already renders the factorial cards (`Q5FactorialCardGenerator` — each card carries its `droppedAxis`). Thread that `droppedAxis` into the vote row so `compute-verdict` reads a real per-member weight-hierarchy probe.

- **iOS** — `QuizCoordinator.q5Ratings` is a `[String: Int]` map keyed by venue id. Change the Q5 capture so each of the three factorial-card ratings is tagged with the card's `droppedAxis` (`Q5FactorialCard.Axis`), and the vote write emits `votes.q5.answer.ratings` as the `[{ droppedAxis, score }]` array.
- **Shared TS** — `buildVotesSlotsFromLegacyAnswers` (`supabase/functions/_shared/votes-schema.ts:347`) wraps `answers.q5_scores` (a `Record<string,number>`) into `q5.answer.scores`. Move it to emit `answer.ratings` in the factorial shape, consistent with what `mapVotesRowToPreferenceInputs` / `readQ5Ratings` already read.

The server contract is already merged (tb-23) and accepts the shape — this slice only fills the producer side. Once landed, the Q5 factorial probe feeds the per-member preference re-weight: the verdict learns which axis (cuisine / reputation / vibe) each member weights most, instead of falling back to the equal-weight 1/3 prior.

## Acceptance criteria

- [ ] A completed iOS Q5 writes `votes.q5.answer.ratings` as a `[{ droppedAxis, score }]` array — one entry per factorial card, each tagged with the card's dropped axis.
- [ ] `buildVotesSlotsFromLegacyAnswers` emits the `regret` slot as `answer.ratings` in the factorial shape, not `answer.scores`.
- [ ] `compute-verdict` builds a non-empty `q5Ratings` probe from a real iOS-written vote row; the per-member prefFn re-weight is no longer a no-op.
- [ ] iOS tests cover the new `droppedAxis`-tagged write; edge-function tests cover `buildVotesSlotsFromLegacyAnswers` emitting `answer.ratings`. `ios` lane green.

## Out of scope

- The `compute-verdict` read path — already merged in tb-23.
- Any Q5 surface visual / motion change — the factorial cards already render; only the data write changes. No design-system consult needed.

## Blocked by

Not blocked. tb-23 already merged the server side that consumes this shape.

## Related

- [[tb-23-server-prefn-scoring|tb-23]] — parent; merged the server read path
- [[tb-22-port-preference-function-ts|tb-22]] — the preference function the Q5 probe re-weights
- [[bug-08-verdict-pipeline-integration-unwired|bug-08]] — the verdict-pipeline parent

## Comments

**2026-05-18 — filed.** Triaged from the tb-23 adjacency note (`01_raw/tb-23-ios-q5-ratings-wire-gap.md`, now compiled into this issue). `ready-for-agent` / AFK — well-scoped data-path wiring, server contract already merged, no design decision, no UI redesign. One call left to the executing agent's autonomy: whether `buildVotesSlotsFromLegacyAnswers` keeps a back-compat shim for `answer.scores` or cuts over outright.

**2026-05-18 — done (PR #131).** The iOS Q5 write path now emits `votes.q5.answer.ratings` as the factorial `[{ droppedAxis, score }]` array. `QuizCandidate` carries an optional `droppedAxis`; `Q5FactorialCardGenerator.quizCandidates(from:)` threads each card's axis through; `QuizCoordinator.VoteRow` replaced its per-venue `q5Regret` score map with `q5Ratings: [Q5RatingEntry]`, joined at the write boundary. Shared TS: `buildVotesSlotsFromLegacyAnswers` emits the `regret` slot as `answer.ratings`.

Autonomy call resolved: **cut over outright — no back-compat `answer.scores` shim**. tb-23 moved verdict scoring server-side and the Q5 ratings are now the preference *probe*, not the candidate scores; a parallel `answer.scores` would be a dead second shape inviting drift. `mapVotesRowToMemberVote`'s `regret` reader still reads `answer.scores` for any surviving genuine-legacy / audit rows.

Adjacency fixed in scope: `VerdictStore.VoteRow`'s decoder read `votes.q5.answer.scores` with a non-optional decode and would have thrown on a freshly written factorial-shape row. Made the Q5 slot decode tolerant — `q5Regret` defaults to empty when `scores` is absent (the verdict screen never reads it post-tb-23). No ADR — the decision is local to this slice and documented here and in the PR.
