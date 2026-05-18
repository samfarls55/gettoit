---
issue: tb-21
title: Persist each member's raw candidate fetch; server unions it into the options table at fire time
status: ready-for-agent
type: AFK
github_issue: 119
prd: v1.1-quiz-redesign-prd
created: 2026-05-18
---

# tb-21 — Raw per-member fetch flows to `options`; the engine finally sees candidates

## Parent

[[bug-08-verdict-pipeline-integration-unwired|bug-08]] — the verdict candidate-pool integration was never wired; `options` is empty across all 2587 rooms and `compute-verdict` returns `no_candidates` (404). The bug-08 fork was decided 2026-05-18: **Option 2, server-side**. This is the load-bearing slice of that decomposition.

## What to build

The first end-to-end tracer: a member's full Foursquare fetch flows from the iOS quiz all the way to the `options` table, so the verdict engine finally has candidates to rank.

Today `QuizCandidateFetch` fetches the per-member venue union from Foursquare, classifies it, runs the factorial to pick the three Q5 cards — and then **discards the union as a local variable**. Nothing persists it; `options` has no writer anywhere.

End-to-end path:

- **iOS** persists each member's full raw fetched union (every venue, not the three Q5 cards) to a server-readable location at quiz time. The exact storage shape is the implementing agent's call — a new per-`(room, member)` table is the suggested default (payload jsonb = the fetched venue list); a jsonb slot is acceptable if cleaner. Whatever is chosen, the server must be able to read every member's raw fetch for a room.
- **Server**, at verdict fire time, reads every member's persisted raw fetch for the room, assembles the candidate pool as the **running union** of those fetches (first-seen dedup by Foursquare place id), and persists the union as `options` rows for the room. The server is the single owner of the union — no cross-device coordination, no iOS writes to `options`.
- **Result:** `compute-verdict` reads a populated `options` table and returns a verdict instead of `no_candidates`. The engine ranks the full fetched pool, not the three Q5 cards.

Scoring quality is deliberately out of scope here — until tb-23 lands, the engine still scores members from the existing `votes.q5.answer.scores` probe ratings, so the verdict is computable but not yet preference-correct. This slice's job is purely: candidates exist, a `verdicts` row lands.

## Acceptance criteria

- [ ] A completed quiz persists that member's **full raw Foursquare fetch** (every fetched venue, not just the three Q5 cards) to a server-readable location.
- [ ] At verdict fire time the server assembles the candidate pool as the running union of every member's persisted fetch, deduped by Foursquare place id, and writes `options` rows for the room.
- [ ] `options` is populated for a room before its verdict computes; a direct `compute-verdict` invoke on a completed room returns a verdict, **not** `{"error":"no_candidates"}`.
- [ ] Group: a 2-or-more-member room's `options` pool is the union across **all** members' fetches (the server-side union has no solo/group special case).
- [ ] The persisted pool is the full fetched union — a verdict winner may be a venue shown to no member at Q5 (preference-correct scoring lands in tb-23).
- [ ] iOS build succeeds and the `ios` test lane is green; `compute-verdict` edge-function tests green.

## Blocked by

None — can start immediately.

Note: full *auto*-fire end-to-end also needs [[bug-09-verdict-fire-dispatch-guc-noop|bug-09]] (the fire dispatch no-ops on unset GUCs). This slice stays verifiable without bug-09 by invoking `compute-verdict` directly against a completed room, as the 2026-05-18 diagnosis did.

## Related

- [[bug-08-verdict-pipeline-integration-unwired|bug-08]] — parent; "Fix scope" records the locked Option 2 design
- [[tb-22-port-preference-function-ts|tb-22]] — the prefFn port (parallel slice)
- [[tb-23-server-prefn-scoring|tb-23]] — server-side prefFn scoring over this union (blocked by this slice)
- [[tb-07-per-member-foursquare-fetch|tb-07]], [[tb-10-running-union-pool-manager|tb-10]] — the fetch + the (Swift) pool manager this supersedes server-side
- [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] — full diagnosis

## Comments

**2026-05-18 — filed.** Decomposed from [[bug-08-verdict-pipeline-integration-unwired|bug-08]] after the architecture fork was decided (Option 2, server-side). Triaged `ready-for-agent` / AFK — clear end-to-end contract, verifiable via direct `compute-verdict` invoke.
