---
issue: tb-11
title: Worst-off-protecting verdict engine rewrite (EBA + satisficing + maximin)
status: done
type: AFK
github_issue: 72
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

# tb-11 — Verdict engine rewrite

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] — module (B). Full rewrite of `supabase/functions/_shared/verdict-engine.ts`.

## What to build

Replace the existing EBA-with-relax-cascade `decide()` with the new pipeline. It runs server-side so the verdict is identical for every member:

1. **EBA prune** — drop venues failing any member's hard vetoes: profile dietary / allergies / NEVERS, parameter geo / meal-time, Q2 spend cap.
2. **Per-member scoring** — via the cached `prefFn`s from the pool manager.
3. **Satisficing floor** — keep only venues every member scores at or above threshold T.
4. **Maximin tiebreak** — pick the venue with the highest minimum member score (protects the worst-off member rather than averaging the group).
5. **Final tiebreak** — highest sum, then random.
6. **Empty-floor cascade** — relax T, then widen radius, then a terminal no-spot screen.

The engine consumes inputs through the schema-driven mapping layer from [[tb-04-votes-jsonb-schema|tb-04]], not by hardcoded field names.

## Acceptance criteria

- [ ] `decide()` runs the EBA prune, dropping venues that fail any member's hard vetoes.
- [ ] Per-member scoring via cached `prefFn`s; the satisficing floor keeps only venues every member scores >= T.
- [ ] Maximin tiebreak selects the highest minimum member score — a polarizing higher-sum pick loses to a worst-off-protecting pick.
- [ ] Empty-floor cascade relaxes T, then widens radius, then shows a terminal no-spot screen.
- [ ] Final tiebreak: highest sum, then random.
- [ ] The verdict is identical for every member (runs server-side).
- [ ] Pure unit tests cover EBA prune, the satisficing floor, maximin-over-higher-sum, and the empty-floor cascade.

## Blocked by

- [[tb-04-votes-jsonb-schema|tb-04]] — engine consumes inputs through the mapping layer.
- [[tb-10-running-union-pool-manager|tb-10]] — scoring consumes the pool and cached per-member scores.

## Comments

**2026-05-15 — done (AFK, branch `afk/tb-11`).** Full rewrite of the
server-side verdict engine (`supabase/functions/_shared/verdict-engine.ts`).

- **New pipeline.** `computeVerdict` now runs: EBA prune → per-member
  scoring → satisficing floor → maximin tiebreak → final tiebreak →
  empty-floor cascade. The TB-06 EBA-with-relax-cascade
  (regret-of-omission sum tiebreak, cuisine-veto / vibe-floor relax
  steps) is gone.
- **EBA prune** — three hard-veto channels, none of which relax: Q2
  spend cap (binding cap is the MIN member tier), Q1-era dietary chips,
  and a new generic `hard_vetoes` channel (`{ kind, token }` entries)
  that TB-12 profile allergies / dietary restrictions / cuisine NEVERS
  feed through the schema mapping layer.
- **Maximin** — among satisficing-floor survivors the venue with the
  highest *minimum* member score wins. A polarizing higher-sum pick
  loses to a worst-off-protecting pick — the load-bearing
  anti-defection mechanic.
- **Empty-floor cascade** — relaxes T (cohort-zero 3) down to 1, then
  widens the radius in 805 m steps to the cap, then emits the terminal
  `no_survivor` screen.
- **Mapping-layer adjacency (TB-06 flag) cleared.** `votes-schema.ts`
  `QUESTION_KINDS` gained `cuisine_craving`, `reputation` and
  `profile_veto` — the verdict engine can now map a 0.1.0-quiz vote
  without throwing. Cuisine / reputation / vibe are soft preferences;
  they are carried by the per-member score map, not the EBA prune.
- **Tests.** 21 pure unit tests in `verdict-engine.test.ts` cover EBA
  prune, the satisficing floor, maximin-over-higher-sum, the
  empty-floor cascade, and determinism. The full `edge` lane is green
  (156 `deno test` cases). The three obsolete old-pipeline test files
  (`verdict-engine-relax/-reroll/-solo.test.ts`) were removed — their
  acceptance-level coverage is subsumed by the new suite.

See [[../../../60_engineering/adr/0011-worst-off-protecting-verdict-engine|ADR 0011]]
for the rewrite decision and the rejected alternatives.
