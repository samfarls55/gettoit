---
issue: tb-23
title: Score every member's preference function over the full union, server-side, into the verdict engine
status: done
type: AFK
github_issue: 121
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-18
---

# tb-23 — Server-side preference scoring over the full pool

## Parent

[[bug-08-verdict-pipeline-integration-unwired|bug-08]] — Option 2 (server-side) locked 2026-05-18. tb-21 gets the candidate pool into `options`; tb-22 ports the preference-function math to TypeScript. This slice is the real fix: it scores every member's preference function over that full pool and feeds the engine.

## What to build

At verdict fire time, score every member against the full candidate pool using their own preference function, and rank on those scores.

End-to-end path:

- For each member of the room, build the ported preference function (tb-22) from that member's quiz answers and Q5 probe ratings.
- Score **every** candidate in the `options` pool (tb-21) with that member's preference function — a score map over the whole union, not just the three Q5 cards.
- Inject those per-member scores into the verdict engine (via its existing `prefFn` / `MemberVote.scores` seam) so the engine ranks the full pool on real preferences.
- This replaces the engine's current live scoring input — `votes.q5.answer.scores`, which carries only the three raw Q5 card ratings. After this slice, the Q5 ratings are the *preference probe* that feeds the prefFn build; they are no longer the candidate scores.

This is the slice that makes the verdict correct: the winner can be a venue **no member saw at Q5**, which is the entire point of the running-union design (bug-08 "Why 'just persist the 3 Q5 venues' is not the fix").

## Acceptance criteria

- [ ] At fire time every member is scored by their own preference function over the **full** `options` pool, not just the three Q5 cards.
- [ ] A completed solo session writes a `verdicts` row and the app reaches S05 Verdict.
- [ ] The verdict winner may be a venue shown to no member at Q5.
- [ ] Group: every member of a 2-or-more-member room is preference-scored over the shared union, and the verdict is computed over that.
- [ ] The engine's live scoring no longer depends on `votes.q5.answer.scores` as the candidate scores — Q5 ratings feed the prefFn build only.
- [ ] Edge-function tests cover preference scoring over a pool larger than the Q5 set (winner is an unseen venue); `ios` lane green if iOS is touched.

## Blocked by

- [[tb-21-persist-fetch-server-union|tb-21]] — needs the candidate pool persisted in `options`.
- [[tb-22-port-preference-function-ts|tb-22]] — needs the preference function available in TypeScript.

Note: full *auto*-fire end-to-end also needs [[bug-09-verdict-fire-dispatch-guc-noop|bug-09]]. Verifiable without it via direct `compute-verdict` invoke.

## Related

- [[bug-08-verdict-pipeline-integration-unwired|bug-08]] — parent; "Fix scope" records the locked Option 2 design
- [[tb-21-persist-fetch-server-union|tb-21]] / [[tb-22-port-preference-function-ts|tb-22]] — the two slices this depends on
- [[../../../60_engineering/verdict-engine|verdict-engine.md]] — the engine's `prefFn` injection seam

## Comments

**2026-05-18 — filed.** Decomposed from [[bug-08-verdict-pipeline-integration-unwired|bug-08]] after the Option 2 fork was decided. Triaged `ready-for-agent` / AFK — clear end-to-end contract; the closing slice that makes the verdict preference-correct.

**2026-05-18 — done (PR #129).** Server-side preference scoring wired into `compute-verdict`. Three slices:

1. **`_shared/venue-classifier.ts`** — a faithful TypeScript port of the Swift `Q5VenueClassifier`. `classifyVenuePool(candidates, now)` turns the full `options` pool into per-venue `Q5VenueProfile`s (cuisine / reputation / vibe). Reputation is pool-relative, so classification is one whole-pool call. tb-22 ported only the *scorer*; this is the missing *classifier* half it explicitly left out of scope.
2. **`mapVotesRowToPreferenceInputs`** in `_shared/votes-schema.ts` — the schema-driven extractor for the soft preference axes: `cuisine_craving` / `reputation` / `vibe` slots → the member's `Q5MemberProfile`, and the `regret` slot's `answer.ratings` → the three `Q5Rating` factorial cards (the preference *probe*).
3. **Handler wiring** — `compute-verdict/handler.ts` classifies the full pool once, builds each member's `prefFn` (`buildPreferenceFunction`) from their `preference_inputs`, and injects `MemberVote.prefFn`. The engine's `scoreFor` reads `prefFn` over the whole union, not the three Q5 cards.

All six acceptance criteria met and covered by `compute-verdict/index-prefn-scoring.test.ts` — AC3 ("winner can be a venue no member saw at Q5") is the load-bearing test. 298 edge-function tests green (+32 from this slice). `deno check` also fixed a pre-existing missing `HardVeto` import in `index.ts`.

**Adjacency flagged (iOS follow-up).** The iOS Q5 write path (`QuizCoordinator.q5Ratings`) still writes a per-venue `[String: Int]` score map, not the canonical `{ droppedAxis, score }` factorial ratings the `regret` slot now expects. The server handler degrades gracefully — an empty `q5Ratings` leaves the prefFn's equal-weight prior intact, so Q1/Q3/Q4 still score — but the Q5 probe's re-weight signal is dark until iOS emits the factorial-rating shape. See [[../../../01_raw/tb-23-ios-q5-ratings-wire-gap|tb-23-ios-q5-ratings-wire-gap]].
