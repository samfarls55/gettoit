---
issue: tb-22
title: Port the preference function (PRD modules A/E) from Swift to TypeScript
status: done
type: AFK
github_issue: 120
prd: v1.1-quiz-redesign-prd
created: 2026-05-18
---

# tb-22 — Port the preference function to TypeScript

## Parent

[[bug-08-verdict-pipeline-integration-unwired|bug-08]] — Option 2 (server-side) was locked 2026-05-18: the union + preference-scoring runs server-side at verdict fire time. The verdict path is TypeScript; the preference-function math currently exists only in Swift. This slice ports that math.

## What to build

Port the Swift `PreferenceFunction` module (PRD modules A + E — the per-member preference engine) into a shared TypeScript module the `compute-verdict` edge function can consume.

What to port:

- The three axis scorers — **cuisine** (set membership), **reputation** (binary exact-match), **vibe** (graded by distance on the 0..4 scale).
- The `build` entry point: takes a member's quiz answers and their Q5 probe ratings and returns a pure `(venue) -> score` function.
- The cohort-zero constants: `matchScore = 5.0`, `softNonMatchScore = 2.0`, `thresholdT = 3.0`, `alpha = 0.5` (soft re-weight blend).
- The existing Swift test vectors — ported alongside so the TS module is proven to produce identical scores.

This is a deliberate **horizontal slice**: a pure-logic port verified by its ported test vectors, with no live integration. The wiring into the verdict path is tb-23. It is filed separately so it runs in parallel with tb-21 and so the Swift→TS translation gets its own focused review (does the math survive the port) independent of the integration review.

Scope note: only PRD modules A/E port. Module G — the incremental Swift `RunningUnionPoolManager` — is **not** ported. Server-side the "running union" is a fire-time set-union (handled in tb-21), not an incremental per-member-fetch manager.

## Acceptance criteria

- [ ] A shared TypeScript preference-function module exposes the three axis scorers (cuisine, reputation, vibe) and a `build` entry that compiles a member's quiz answers + Q5 ratings into a pure venue-scoring function.
- [ ] The cohort-zero constants match the Swift module exactly (`matchScore` 5.0, `softNonMatchScore` 2.0, `thresholdT` 3.0, `alpha` 0.5).
- [ ] The Swift module's test vectors are ported; the TS module reproduces the Swift scores exactly on every vector.
- [ ] The ported test suite is green in the edge-function test lane.
- [ ] No change to the live verdict path — `compute-verdict` behavior is unchanged by this slice (integration is tb-23).

## Blocked by

None — can start immediately, in parallel with [[tb-21-persist-fetch-server-union|tb-21]].

## Related

- [[bug-08-verdict-pipeline-integration-unwired|bug-08]] — parent; "Fix scope" records the locked Option 2 design
- [[tb-09-preference-function-axis-scorers|tb-09]] — the Swift `PreferenceFunction` being ported
- [[tb-23-server-prefn-scoring|tb-23]] — wires this ported module into the verdict path
- [[../../../60_engineering/verdict-engine|verdict-engine.md]] — the engine's `prefFn` injection seam

## Comments

**2026-05-18 — filed.** Decomposed from [[bug-08-verdict-pipeline-integration-unwired|bug-08]] after the Option 2 fork was decided. Triaged `ready-for-agent` / AFK — pure-logic port, verifiable on its own via ported test vectors. The one horizontal slice in the bug-08 decomposition; kept separate (vs merged into tb-23) for parallelism and a focused port-vs-wiring review split.

**2026-05-18 — done (PR #126).** Ported to `supabase/functions/_shared/preference-function.ts` — the three axis scorers (`scoreCuisineAxis` / `scoreReputationAxis` / `scoreVibeAxis`) and `buildPreferenceFunction`, with the cohort-zero constants byte-identical to the Swift module (`MATCH_SCORE` 5.0, `SOFT_NON_MATCH_SCORE` 2.0, `THRESHOLD_T` 3.0, `ALPHA` 0.5). The Swift test suite is ported in full and the suite adds an explicit exact-score vector table (`SCORE_VECTORS`) — fully-specified `(member, q5Ratings, venue) -> expected` rows with the Swift arithmetic pinned to `1e-9` — proving the port reproduces the Swift scores exactly. 22 tests green in the edge lane; full `supabase/functions/` suite still 238 passed / 0 failed (no `compute-verdict` regression). The module is self-contained — its own `Q5VenueProfile` / `Q5MemberProfile` / `Q5Rating` types — so it stays reviewable in isolation; joining it to `verdict-engine.ts`'s `prefFn` seam is tb-23. Module G (the incremental Swift `RunningUnionPoolManager`) deliberately not ported.
