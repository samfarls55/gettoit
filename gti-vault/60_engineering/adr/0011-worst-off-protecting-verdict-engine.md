---
adr: 0011
title: verdict engine — worst-off-protecting (EBA + satisficing floor + maximin)
status: accepted
date: 2026-05-15
supersedes: null
superseded_by: null
---

# 0011 — Worst-off-protecting verdict engine

## Status

Accepted — 2026-05-15. Implemented by issue [[../../15_issues/0.1.0/issues/tb-11-verdict-engine-rewrite|tb-11]].

## Context

The 0.1.0 verdict engine (`supabase/functions/_shared/verdict-engine.ts`,
shipped by 0.1.0 TB-06) ran EBA pruning followed by a **regret-of-omission
sum** tiebreaker — the survivor with the highest summed Q5 regret score
across members won. The 0.1.0 quiz redesign PRD
([[../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]],
module B) calls for a full rewrite, for a concrete reason stated in the
problem statement: **a sum (utilitarian) aggregation lets a polarizing
pick win the group even though one member quietly hates it.** That
member follows along and carries resentment — the exact post-decision
defection GetToIt exists to prevent (the Kim 2023 backfire mechanism,
[[../../50_product/framework-comparison]]).

The engine also still consumed quiz answers by hardcoded field name,
which the TB-04 generic-jsonb schema ([[0010-generic-jsonb-votes-schema|ADR 0010]])
made obsolete.

## Decision

Replace the engine pipeline with the worst-off-protecting flow from
[[../../50_product/0.1.0-quiz-amendments]] §4:

1. **EBA prune** — drop venues failing *any* member's hard vetoes. Three
   veto channels, none of which relax: the Q2 spend cap (binding cap is
   the MIN member tier), the Q1-era dietary chips, and a new generic
   `hard_vetoes` channel — `{ kind, token }` entries that TB-12 profile
   allergies / dietary restrictions / cuisine NEVERS feed through the
   schema mapping layer.
2. **Per-member scoring** — each member's preference function scores
   every surviving venue 1..5. The engine reads the score either from an
   injected `prefFn` (the live path — the running-union pool manager's
   cached function) or from a static per-candidate `scores` map (the Q5
   probe's cached ratings; also the test / replay path).
3. **Satisficing floor** — keep only venues every member scores at or
   above the acceptability threshold T (cohort-zero default 3,
   inclusive).
4. **Maximin tiebreak** — among floor survivors, pick the venue with the
   highest *minimum* member score. This protects the worst-off member
   rather than averaging the group.
5. **Final tiebreak** — equal minimums break on the higher group sum,
   then on an injected (deterministic-in-test) random.
6. **Empty-floor cascade** — when no venue clears the floor: relax T
   downward to 1, then widen the search radius in 805 m steps to the
   cap, then emit a terminal `no_survivor` screen. Hard-veto cuts never
   recover.

The engine consumes its input through the TB-04 schema mapping layer
(`votes-schema.ts`), never by hardcoded field name. It runs server-side
(the `compute-verdict` Edge Function) so the verdict is byte-identical
for every member, and it is purely deterministic — the one source of
randomness is injected.

## Consequences

- **A polarizing higher-sum pick loses to a worst-off-protecting pick.**
  This is the load-bearing anti-defection property; it is pinned by a
  dedicated unit test.
- **The relax cascade changed shape.** 0.1.0's cuisine-veto / vibe-floor
  relax steps are gone — cuisine, reputation and vibe are now soft
  *scoring* axes (carried by `prefFn` / the score map), not in-engine
  hard or semi-hard filters. The cascade's only levers are the
  satisficing threshold and the radius. The `RELAX_STEPS` vocabulary is
  now `["threshold", "radius_widen"]`.
- **`votes-schema.ts` kind taxonomy widened.** `QUESTION_KINDS` gained
  `cuisine_craving`, `reputation` and `profile_veto`. This clears the
  adjacency TB-06 flagged: the engine can now map a 0.1.0-quiz vote
  without throwing. Cuisine / reputation / vibe map to empty patches —
  they are soft, carried by the score map.
- **A `dist`-reason reroll no longer prunes via a `walk_minutes`
  override.** Walk-minutes left the quiz for the parameters bucket; a
  `dist` reroll's effect is now carried through the radius gate and the
  re-fetched, re-scored candidate pool. The `rooms.walk_minutes_override`
  column is retained for schema stability but the engine no longer
  applies it.
- **Three obsolete engine test files were removed**
  (`verdict-engine-relax/-reroll/-solo.test.ts`) — they tested the
  removed pipeline. The new `verdict-engine.test.ts` (21 cases) subsumes
  their acceptance-level coverage.

## Rejected alternatives

- **Pure sum / utilitarian aggregation** (the 0.1.0 mechanism) — rejected:
  it is exactly the polarizing-pick defection risk the rewrite exists to
  remove.
- **Geometric centroid / facility-location 1-median** — rejected: also
  utilitarian, and it assumes a shared, uniformly-weighted metric space
  that per-member axis weighting, categorical axes, and hard-veto cliffs
  all violate ([[../../50_product/0.1.0-quiz-amendments]] §4).
- **Keeping the cuisine-veto / vibe-floor relax steps** — rejected: in
  the 0.1.0 model cuisine, reputation and vibe are soft scoring axes
  inside each member's `prefFn`; re-implementing them as a second,
  in-engine semi-hard filter would double-count the signal and
  reintroduce hardcoded-axis coupling.
