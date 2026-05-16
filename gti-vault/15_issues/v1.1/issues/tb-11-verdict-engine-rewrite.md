---
issue: tb-11
title: Worst-off-protecting verdict engine rewrite (EBA + satisficing + maximin)
status: ready-for-agent
type: AFK
github_issue: 72
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-11 — Verdict engine rewrite

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (B). Full rewrite of `supabase/functions/_shared/verdict-engine.ts`.

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
