---
issue: tb-21
title: Persist each member's raw candidate fetch; server unions it into the options table at fire time
status: done
type: AFK
github_issue: 119
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-18
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-21 â€” Raw per-member fetch flows to `options`; the engine finally sees candidates

## Parent

[[bug-08-verdict-pipeline-integration-unwired|bug-08]] â€” the verdict candidate-pool integration was never wired; `options` is empty across all 2587 rooms and `compute-verdict` returns `no_candidates` (404). The bug-08 fork was decided 2026-05-18: **Option 2, server-side**. This is the load-bearing slice of that decomposition.

## What to build

The first end-to-end tracer: a member's full Foursquare fetch flows from the iOS quiz all the way to the `options` table, so the verdict engine finally has candidates to rank.

Today `QuizCandidateFetch` fetches the per-member venue union from Foursquare, classifies it, runs the factorial to pick the three Q5 cards â€” and then **discards the union as a local variable**. Nothing persists it; `options` has no writer anywhere.

End-to-end path:

- **iOS** persists each member's full raw fetched union (every venue, not the three Q5 cards) to a server-readable location at quiz time. The exact storage shape is the implementing agent's call â€” a new per-`(room, member)` table is the suggested default (payload jsonb = the fetched venue list); a jsonb slot is acceptable if cleaner. Whatever is chosen, the server must be able to read every member's raw fetch for a room.
- **Server**, at verdict fire time, reads every member's persisted raw fetch for the room, assembles the candidate pool as the **running union** of those fetches (first-seen dedup by Foursquare place id), and persists the union as `options` rows for the room. The server is the single owner of the union â€” no cross-device coordination, no iOS writes to `options`.
- **Result:** `compute-verdict` reads a populated `options` table and returns a verdict instead of `no_candidates`. The engine ranks the full fetched pool, not the three Q5 cards.

Scoring quality is deliberately out of scope here â€” until tb-23 lands, the engine still scores members from the existing `votes.q5.answer.scores` probe ratings, so the verdict is computable but not yet preference-correct. This slice's job is purely: candidates exist, a `verdicts` row lands.

## Acceptance criteria

- [ ] A completed quiz persists that member's **full raw Foursquare fetch** (every fetched venue, not just the three Q5 cards) to a server-readable location.
- [ ] At verdict fire time the server assembles the candidate pool as the running union of every member's persisted fetch, deduped by Foursquare place id, and writes `options` rows for the room.
- [ ] `options` is populated for a room before its verdict computes; a direct `compute-verdict` invoke on a completed room returns a verdict, **not** `{"error":"no_candidates"}`.
- [ ] Group: a 2-or-more-member room's `options` pool is the union across **all** members' fetches (the server-side union has no solo/group special case).
- [ ] The persisted pool is the full fetched union â€” a verdict winner may be a venue shown to no member at Q5 (preference-correct scoring lands in tb-23).
- [ ] iOS build succeeds and the `ios` test lane is green; `compute-verdict` edge-function tests green.

## Blocked by

None â€” can start immediately.

Note: full *auto*-fire end-to-end also needs [[bug-09-verdict-fire-dispatch-guc-noop|bug-09]] (the fire dispatch no-ops on unset GUCs). This slice stays verifiable without bug-09 by invoking `compute-verdict` directly against a completed room, as the 2026-05-18 diagnosis did.

## Related

- [[bug-08-verdict-pipeline-integration-unwired|bug-08]] â€” parent; "Fix scope" records the locked Option 2 design
- [[tb-22-port-preference-function-ts|tb-22]] â€” the prefFn port (parallel slice)
- [[tb-23-server-prefn-scoring|tb-23]] â€” server-side prefFn scoring over this union (blocked by this slice)
- [[tb-07-per-member-foursquare-fetch|tb-07]], [[tb-10-running-union-pool-manager|tb-10]] â€” the fetch + the (Swift) pool manager this supersedes server-side
- [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] â€” full diagnosis

## Comments

**2026-05-18 â€” filed.** Decomposed from [[bug-08-verdict-pipeline-integration-unwired|bug-08]] after the architecture fork was decided (Option 2, server-side). Triaged `ready-for-agent` / AFK â€” clear end-to-end contract, verifiable via direct `compute-verdict` invoke.

**2026-05-18 â€” done (PR #119 branch `afk/tb-21`).** Shipped server-side per the bug-08 Option 2 decision.

- **Storage:** new per-`(room, member)` table `member_fetches(room_id, user_id, payload jsonb, fetched_at)` â€” `payload` is the full raw fetched venue union (every venue, not the three Q5 cards). Dedicated table over a `votes` jsonb slot â€” the fetch resolves before the Q5 vote and the union is large; RLS mirrors `votes` but admits UPDATE so a re-run quiz overwrites the stale fetch.
- **iOS:** `QuizCandidateFetchResult` gained `rawFetch: [ShapedPlace]` (the union previously discarded as a local var); `QuizCoordinator` persists it via a new `MemberFetchWriter` / `MemberFetchSupabaseWriter` (upsert) when the per-member fetch resolves. Best-effort â€” a write failure never strands Q5.
- **Server:** pure `_shared/member-fetch-union.ts` (`unionMemberFetches`) â€” running union, first-seen dedup by `fsq_place_id`, no solo/group special case. `compute-verdict` unions every `member_fetches` row into `options` when `options` is empty, then re-reads â€” idempotent across re-invokes; iOS never writes `options`.
- **Verified:** full `deno test` edge suite green (231 + new union/handler tests). iOS lane verified in CI (no local Xcode in the AFK environment). Architecture recorded in [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] Â§"Defect A â€” resolution".
- Scoring quality stays out of scope â€” the engine still scores from `votes.q5.answer.scores` until [[tb-23-server-prefn-scoring|tb-23]].
