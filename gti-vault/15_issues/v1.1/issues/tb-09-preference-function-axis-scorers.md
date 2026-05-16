---
issue: tb-09
title: Per-member preference function + cuisine/reputation/vibe axis scorers
status: ready-for-agent
type: AFK
github_issue: 70
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-09 — Preference function + axis scorers

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — modules (A) `buildPreferenceFunction` + (E) axis scorers.

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
