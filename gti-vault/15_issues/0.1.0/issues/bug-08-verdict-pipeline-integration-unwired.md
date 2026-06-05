---
issue: bug-08
title: Verdict never computes â€” the candidate-pool + preference-scoring integration (PRD modules A/E/G) was never wired into a live session
status: done
type: HITL
github_issue: 116
created: 2026-05-18
prd: 0.1.0-quiz-redesign-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-08 â€” Verdict pipeline integration unwired; the engine has no candidates

## Parent

[[../_index|0.1.0 backlog]] â€” root cause found during the 2026-05-18 verdict diagnosis ([[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]]). Confirms and supersedes the [[../verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]] needs-triage note (filed 2026-05-16, "needs its own diagnosis before an issue is filed" â€” this is that diagnosis). Same build-but-don't-integrate family as [[bug-07-post-q5-router-unwired|bug-07]].

## What's broken

A completed quiz never produces a verdict. After Q5 submit the room flips to `firing` but no `verdicts` row is ever written, so the post-Q5 surface waits forever (see [[bug-10-verdict-poll-no-timeout|bug-10]] for the resulting spinner). Invoking the `compute-verdict` engine directly returns `{"error":"no_candidates"}` (HTTP 404).

## Root cause

The verdict engine ranks a **candidate pool**. By design (0.1.0 quiz-redesign PRD modules F/G) that pool is the **running union of every member's Foursquare fetch** â€” a broad set, dozens of venues. The three cards shown at Q5 are NOT the candidate set: they are a deliberately-imperfect *preference probe* whose only job is to elicit each member's preference function. The verdict winner is normally a venue no member saw at Q5.

The entire integration that assembles and persists that pool was never built:

- **`RunningUnionPoolManager` (tb-10) and `PreferenceFunction` (tb-09) have zero live callers.** Both ship as pure, unit-tested modules under `ios/Sources/App/`; grep-confirmed they are referenced only by their own test files. Nothing constructs a `RunningUnionPoolManager` per session.
- **tb-10 explicitly punted the wiring** and it was never picked up. tb-10's own adjacency note: *"the pool manager is built and tested but not yet wired into a live session â€¦ That wiring is tb-11 (verdict engine rewrite) and tb-13 (verdict firing on Q5-complete)."* Both tb-11 and tb-13 closed without doing it.
- **The `options` table has no writer anywhere** â€” not iOS, not an Edge Function, not SQL. The TB-05 migration that creates `options` states its intended writer is *"Edge Function on room create"*; that function was never built. Repo-wide, `options` is referenced only by *readers* (`VerdictStore`, `compute-verdict`).
- **The live quiz fetches the pool, then discards it.** `QuizCandidateFetch` fetches the per-member venue union, classifies it, runs the factorial to pick three Q5 cards â€” and drops the union as a local variable. It is never unioned across members, never scored by a `prefFn`, never persisted.
- **The engine is therefore starved on both inputs.** `compute-verdict` reads candidates from the empty `options` table, and reads per-member `scores` from the `votes.q5.answer.scores` slot â€” which carries only the **three raw Q5 card ratings**, not a `prefFn`-scored map over the full pool. The engine's live `prefFn` injection path is never exercised.

The verdict engine logic itself (tb-11, `verdict-engine.ts`), the firing predicate (tb-13), the preference-function math (tb-09) and the per-member fetch (tb-07) are all shipped and unit-tested. The defect is purely the missing integration seam between them.

### Why "just persist the 3 Q5 venues" is not the fix

A tempting shortcut â€” persist the three `votes.q5.scores` venues into `options` â€” would make the engine rank only the three factorial cards. Those cards are *engineered to be imperfect* (each drops one preference axis; "never a perfect match"). A verdict over them is "best of three things we deliberately compromised." That is the exact degenerate outcome the running-union design exists to prevent. The fix must restore the real pool.

## Live evidence (production project `rlnevdqebmzbxpntghzb`, 2026-05-18)

- `options` table: **0 rows across 2587 rooms**. `verdicts` table: **0 rows, ever**. The verdict path has never completed once.
- Reporter's solo test room: 1 member, 1 votes row (q5 slot correct, `question_kind=regret`, `scores` = 3 venue ids), room stuck in `status='firing'`, 0 option rows, 0 verdict rows.
- `compute-verdict` invoked directly on that room â†’ `{"error":"no_candidates"}`, HTTP 404.

## Fix scope â€” DECIDED 2026-05-18: Option 2, server-side

The architecture fork is resolved. **Option 2 (server-side) is locked.** The union
+ preference-scoring (PRD modules A/E/G) is ported to TypeScript and runs at fire
time in the verdict path; iOS writes only raw per-member fetch results and raw Q5
ratings.

**Why Option 2 over Option 1 (iOS-side):** the candidate pool is a *running union
across members* â€” shared multi-device state. iOS-side would make every member's
device do read-modify-write on a shared `options` set (N devices racing) and would
leave early-fetching members' `prefFn` score maps scored against a stale, smaller
pool. Server-side gives the union a single natural owner: the server reads every
member's fetch, unions once, scores all members against the *final* pool once â€”
race-free and order-independent. It also keeps the whole ranking pipeline in one
language next to `verdict-engine.ts`, and matches `RunningUnionPoolManager`'s own
header, which calls itself a "server-side candidate-pool manager." The cost â€” a
one-time Swiftâ†’TS port of tb-09/tb-10 â€” is bounded because both are pure,
unit-tested modules whose test vectors port with them.

**Resolved sub-decisions (per the locked option):**

- **Who writes `options` and when** â€” the server, at verdict fire time. A
  fire-time step (in the `compute-verdict` path or a new Edge Function) reads all
  members' raw fetches, assembles the running union, and persists it to `options`
  before ranking. iOS never writes `options`.
- **How per-member full-pool scores reach the engine** â€” computed server-side at
  fire time. The server applies the ported `prefFn` over the final union for each
  member. iOS no longer needs to supply a full-pool score map; `votes.q5` keeps
  only the raw Q5 card ratings (the preference probe).
- **How the group path unions across members** â€” server-side union over every
  member's persisted raw fetch; no cross-device coordination.

Now decompose into tracer-bullet slices via `/to-issues` (pattern: bug-07 â†’
tb-19/tb-20). Next tb number is **tb-21**.

## Acceptance criteria (high-level â€” sharpen per slice after the fork is decided)

- [ ] A completed solo session writes a `verdicts` row and the app reaches S05 Verdict.
- [ ] The engine ranks the **full fetched candidate pool**, not the three Q5 cards; the winning venue may be one the user never saw at Q5.
- [ ] A group session's candidate pool is the running union of every member's fetch.
- [ ] Per-member scores supplied to the engine are `prefFn`-derived over the whole pool, not the raw Q5 card ratings.
- [ ] `options` rows exist for a room by the time its verdict fires.

## Blocked by

Nothing technically. This blocks the entire verdict feature â€” it is the load-bearing defect of the three 2026-05-18 verdict bugs. [[bug-09-verdict-fire-dispatch-guc-noop|bug-09]] (dispatch never fires the engine) and [[bug-10-verdict-poll-no-timeout|bug-10]] (spinner hangs) must also land for the path to work end-to-end; fixing this one alone is necessary but not sufficient.

## Related

- [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] â€” full diagnosis
- [[../verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]] â€” the 2026-05-16 note this resolves
- [[tb-09-preference-function-axis-scorers|tb-09]], [[tb-10-running-union-pool-manager|tb-10]], [[tb-11-verdict-engine-rewrite|tb-11]], [[tb-13-verdict-firing-q5-complete|tb-13]]
- [[../../../60_engineering/verdict-engine|verdict-engine.md]]

## Comments

**2026-05-18 â€” filed.** Surfaced during the verdict-spinner diagnosis. Root cause confirmed against the live DB (0 options / 0 verdicts ever; direct engine invoke returns `no_candidates`). Triaged `ready-for-human`: the fix carries an architecture fork (iOS-side vs server-side union+scoring) that is a design decision, and the work is multi-slice â€” it needs the fork resolved, then decomposition via `/to-issues`. Not an AFK-ready slice as filed.

**2026-05-18 â€” fork decided.** Option 2 (server-side) locked. See "Fix scope" above for rationale and resolved sub-decisions. Now decomposing into tb-21+ tracer-bullet slices via `/to-issues`; this issue becomes the parent/tracking issue for those slices.

**2026-05-18 â€” closed (decomposed).** Decomposed via `/to-issues` into three AFK tracer-bullet slices â€” [[tb-21-persist-fetch-server-union|tb-21]] (GitHub #119, persist raw fetch + server-side union into `options`), [[tb-22-port-preference-function-ts|tb-22]] (#120, port the preference function Swiftâ†’TS), [[tb-23-server-prefn-scoring|tb-23]] (#121, server-side prefFn scoring over the full union). The fix is tracked there. Closed as decomposed â€” same pattern as [[bug-07-post-q5-router-unwired|bug-07]]. This issue remains the canonical diagnosis + design-decision record.
