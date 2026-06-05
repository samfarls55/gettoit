---
issue: tb-06
title: Quiz Q1-Q4 rework â€” four new input surfaces
status: done
type: AFK
github_issue: 67
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-06 â€” Q1-Q4 quiz rework

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] â€” module (J), part 1. Covers the first four of the five decision-shaping questions.

## What to build

Rework `QuizCoordinator`'s Q1-Q4 to the new question semantics, writing each answer to its generic jsonb slot from [[tb-04-votes-jsonb-schema|tb-04]]:

- **Q1 â€” cuisine craving.** Multi-select, capped at 3 selections, with a mutually-exclusive "No preference" toggle (selecting it clears any cuisines; selecting a cuisine clears "No preference"). Selecting a 4th cuisine is prevented.
- **Q2 â€” spend cap.** A hard ceiling on spend.
- **Q3 â€” reputation / discovery.** A chip picker: Popular / Hidden gem / Classic / New / No preference.
- **Q4 â€” vibe energy.** A 5-point scale: Quiet â†’ Chill â†’ Social â†’ Lively â†’ Rowdy.


## Acceptance criteria

- [x] Q1 enforces the 3-cuisine cap and the mutually-exclusive "No preference" option both ways.
- [x] Q2 captures a spend cap, Q3 the reputation chip, Q4 the 5-point vibe energy value.
- [x] All four answers persist to their `Q1`..`Q4` jsonb slots.
- [x] Advancing through Q1-Q4 never stalls.
- [x] No new components were needed â€” Q1/Q3 use C-04, Q4 uses C-08; the `vibe-labels` token + S03 Â§Q1-Q4 + C-04/C-08 specs were updated; `verify.mjs` green.
- [x] Tests cover the cap-3 logic, the "No preference" exclusivity, and answer persistence.

## Blocked by

- [[tb-04-votes-jsonb-schema|tb-04]] â€” answers write to the generic jsonb slots.

## Comments

**2026-05-15 â€” done (AFK, PR #67 / branch `afk/tb-06`).** Reworked the iOS
quiz Q1-Q4 to the 0.1.0 question semantics.

- **QuizCoordinator.** Q1 is now cuisine craving â€” `q1Cuisines: Set<String>`
  capped at 3 (`cuisineCap`) plus a mutually-exclusive `q1NoPreference`
  flag. `toggleCuisine` cap-gates new selections (a 4th pick is a no-op);
  `toggleCuisineNoPreference` clears the cuisine set and vice versa. Q2
  spend cap is unchanged (4-tier `budget_cap`). Q3 is reputation â€”
  `q3Reputation: String` single-select, default `no_preference`. Q4 vibe
  energy is the same 0-4 cardinal index with the new vocabulary.
- **Surfaces.** `QuizQ1Vetoes` â†’ `QuizQ1Cuisine` (capped multi-select
  chips, disabled state at the cap), `QuizQ3Distance` â†’ `QuizQ3Reputation`
  (single-select chip picker reusing the shared `QuizChipFlow`). Q2/Q4
  surfaces kept; Q4 picks up the new vocabulary via the regenerated
  Q4 uses C-08; the Refero MCP search confirmed those primitives cover
  the chip-picker and energy-scale patterns.
- **Wire shape.** `QuizCoordinator.VoteRow` emits the generic `{meta,answer}`
  jsonb envelopes from tb-04. Q1's kind is the new `cuisine_craving`
  (`answer: {cuisines, no_preference}`), Q3's is the new `reputation`
  (`answer: {reputation}`). Q2 keeps `budget_cap`, Q4 keeps `vibe`.
  `QUIETÂ·CHILLÂ·SOCIALÂ·LIVELYÂ·ROWDY` (0.1.0 amendments Â§2); regenerated
  `GTITokens.swift` + `tokens.css`. C-08 renamed Vibe Slider â†’ Vibe Energy
  Scale; C-04 gained a capped-multi-select rule; S03 Â§Q1-Q4 rewritten.
  `verify.mjs` green.
- **Adjacency flagged â€” `votes-schema.ts` not widened.** The iOS write now
  emits the `cuisine_craving` and `reputation` question kinds, which the
  verdict-engine mapping layer's `QUESTION_KINDS` set does not yet know;
  `mapVotesRowToMemberVote` would throw on them. Widening the engine's
  kind taxonomy is module B / [[tb-11-verdict-engine-rewrite|tb-11]]'s
  explicit scope (the PRD sequences it that way), so tb-06 leaves
  `votes-schema.ts` untouched. No CI lane breaks â€” the iOS integration
  tests do not invoke the engine (Edge dispatch is GUC-gated, unset in
  CI) and the `edge` lane's `votes-schema.test.ts` is unaffected by the
  iOS write path. tb-11 must add `cuisine_craving` + `reputation` to
  `QUESTION_KINDS` and the dispatch table before a verdict can fire over
  a 0.1.0-quiz vote on a real device.
- **Verdict-screen readback.** `VerdictStore.VoteRow`'s decoder was made
  tolerant of both the legacy and the new Q1/Q3 answer shapes so it never
  throws on the new wire shape â€” dietary/walk receipts simply stop firing
  from session votes (those moved to the profile / parameters buckets),
  which tb-11 re-sources.
