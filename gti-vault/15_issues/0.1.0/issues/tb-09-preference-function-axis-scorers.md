---
issue: tb-09
title: Per-member preference function + cuisine/reputation/vibe axis scorers
status: done
type: AFK
github_issue: 70
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

# tb-09 — Preference function + axis scorers

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] — modules (A) `buildPreferenceFunction` + (E) axis scorers.

## What to build

The per-member preference engine. `buildPreferenceFunction` takes a member's Q1-Q4 answers plus their three Q5 ratings and returns `prefFn(venue) -> score 1-5`. It composes three axis scorers, each satisfying the fixed `venue -> 1-5` interface:

- **Cuisine** — set membership (clean).
- **Reputation** — derived from Foursquare venue metadata per the [[research-01-foursquare-filter-surface|research-01]] mapping.
- **Vibe** — graded distance on the 5-point energy scale.

Internals: stated weights seed equal (1/3 per axis; an explicit "No preference" zeroes that axis); a **soft re-weight** partially blends toward the Q5-revealed weights (blend constant `alpha`, cohort-zero default 0.5); a **hard-contradiction override** fires only on a strict two-condition trigger and demotes a stated preference to no-preference — it never inverts. Scores normalize 1-5; a soft non-match scores ~2, below threshold T, so the satisficing floor has teeth. `match=5`, `soft-non-match~2`, `T=3`, `alpha=0.5` are cohort-zero defaults, tunable post-cohort.

## Acceptance criteria

- [ ] `buildPreferenceFunction` returns a `prefFn` producing 1-5 scores for canned venues from canned Q1-Q5 inputs.
- [ ] Equal-weight init; an explicit "No preference" zeroes that axis; soft re-weight blends toward the Q5-revealed weights.
- [ ] The hard-contradiction override fires only on the strict two-condition trigger and demotes (never inverts); a single odd rating does not flip a stated preference.
- [ ] A soft non-match scores below T so the satisficing floor is meaningful.
- [ ] Cuisine, reputation, and vibe axis scorers each satisfy the fixed `venue -> 1-5` interface.
- [ ] Pure unit tests cover all of the above (PRD module A and E test plans).

## Blocked by

- [[research-01-foursquare-filter-surface|research-01]] — fixes the reputation and vibe metadata mapping.
- [[tb-08-q5-factorial-probe|tb-08]] — needs the Q5 ratings shape as input.

## Comments

**2026-05-15 — done (AFK, branch `afk/tb-09`).** Shipped the pure
per-member preference engine (PRD modules A + E).

- **`PreferenceFunction`** — `build(member:q5Ratings:)` returns a pure
  `prefFn(Q5VenueProfile) -> Double` scoring any axis-profiled venue
  1…5 on the same scale as the satisficing threshold T. No I/O, no
  clock, no randomness, no group state; the returned closure is itself
  a deterministic function of `member` and the Q5 ratings.
- **Three axis scorers** — `CuisineAxisScorer` (clean set membership),
  `ReputationAxisScorer` (categorical exact-match), `VibeAxisScorer`
  (graded linear distance on the 0…4 energy scale). Each satisfies the
  fixed `venue -> 1…5` interface.
- **Weight pipeline** — equal-weight init (1/3 per axis); an explicit
  "No preference" (Q3 chip, or Q1 empty) zeroes that axis and
  redistributes; the soft re-weight partially blends the
  no-preference-adjusted prior toward the Q5-revealed weights
  (`w_final = (1-alpha)*w_prior + alpha*w_revealed`, `alpha` cohort-zero
  0.5); the hard-contradiction override fires only on the strict
  two-condition trigger (both keep-cards strictly below the drop-card
  AND drop-card rated 4-5) and demotes the axis to no-preference —
  never inverts.
- **Cohort-zero constants** — `matchScore=5`, `softNonMatchScore=2`,
  `thresholdT=3`, `alpha=0.5`, all tunable post-cohort per
  0.1.0-quiz-amendments §3. A soft non-match (2) sits below T so the
  satisficing floor has teeth.
- **Decisions / scope.** The `prefFn` consumes `Q5VenueProfile` (the
  already-classified shape tb-08 introduced), not raw `ShapedPlace` —
  the `ShapedPlace -> Q5VenueProfile` classifier needs Foursquare
  response fields (`rating`, `stats`, `date_created`, `attributes`)
  that `ShapedPlace` does not yet carry; that classifier and the live
  `Q5CandidatesLoader -> Q5FactorialCardGenerator` wiring are a
  downstream adjacency (modules D/F/G/J), not in this issue's
  acceptance criteria. The reputation scorer is exact-match (the binary
  factorial lever), not the continuous volume/quality space research-01
  describes — that refinement is a post-cohort tuning item behind the
  same `venue -> 1…5` interface. See the PR Decisions section.
- **Tests.** `ios/Tests/PreferenceFunctionTests.swift` — pure unit
  tests covering all six acceptance criteria: 1…5 score bounds,
  perfect-match=5, soft non-match below T, "No preference" zeroing +
  redistribution, soft re-weight blend (partial, not full
  replacement), the override firing/not-firing strict trigger
  (including the single-odd-rating and drop-below-4 negatives, and the
  multi-pick whole-axis demote), the three axis scorers' fixed
  interface, and determinism. Verified green via the Swift 5.10
  frontend; the `ios` CI lane runs the full `xcodebuild test`.

**Adjacency flagged — the preference engine is built and tested but
not yet wired into the live verdict path.** `PreferenceFunction` is a
pure module; nothing yet builds a `Q5VenueProfile` from a real
`ShapedPlace` (the axis classification), nor caches per-member
`prefFn`s in the running-union pool manager. That classification +
caching is PRD modules D/F/G — tb-10 (running-union pool manager) and
tb-11 (verdict engine rewrite). Recorded so the wiring is not lost.
