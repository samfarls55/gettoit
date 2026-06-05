---
issue: tb-10
title: Running-union candidate pool manager
status: done
type: AFK
github_issue: 71
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-10 â€” Running-union pool manager

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] â€” module (G).

## What to build

A server-side pool manager that holds the group candidate pool as the **running union** of every member's Foursquare fetch â€” never an intersection (the engine is built to take a broad set and narrow it). As the union grows with each member's fetch, the manager triggers `prefFn` re-scoring of the new venues for every already-completed member, so no member's scores go stale, and caches per-member scores for the verdict engine to consume.

## Acceptance criteria

- [ ] The group pool is the running union of all members' fetches, deduped by venue id.
- [ ] Adding a member's fetch re-scores the new venues for every already-completed member via their cached `prefFn`.
- [ ] Per-member scores are cached and readable by the verdict engine.
- [ ] Verified indirectly through the verdict-engine tests (tb-11) and a manual multi-member session run â€” no dedicated test suite required per the PRD.

## Blocked by

- [[tb-07-per-member-foursquare-fetch|tb-07]] â€” the pool unions per-member fetches.
- [[tb-09-preference-function-axis-scorers|tb-09]] â€” re-scoring needs each member's cached `prefFn`.

## Comments

**Closed 2026-05-15 â€” merged via [PR #85](https://github.com/samfarls55/gettoit/pull/85).**

`RunningUnionPoolManager` (`ios/Sources/App/RunningUnionPoolManager.swift`)
ships as a pure `final class` â€” the server-side seam between the tb-07
fetch executor and the tb-11 verdict engine. `addMemberFetch` unions a
member's deduped fetch into the pool (first-seen profile wins on a
duplicate id), caches their pure `prefFn` (replacing any prior one so a
re-completed quiz overwrites rather than stacks), then refreshes every
member's score cache against the full union â€” the joining member scores
the whole existing union and every already-completed member re-scores
the newly-added venues. The verdict engine reads per-member scores via
`scores(for:)` and the member roster via `completedMemberIds`.

**Decisions.** Full re-score on every fetch rather than a delta-scoped
re-score (scoring is sub-millisecond and `prefFn` is pure â€” amendments
Â§5 â€” so a full pass is the cheapest *correct* option and covers the
re-completed-quiz case for free). Not `Sendable` â€” a session's quiz
flow is single-threaded on the owning actor. An empty-fetch member
still registers as completed and still scores the rest of the union
(defensive against the documented pool-starvation edge case).

**Tests.** `ios/Tests/RunningUnionPoolManagerTests.swift` â€” 13 tests
covering the three acceptance criteria: running union + dedupe (incl.
disjoint-never-intersects, first-seen-profile-wins), re-scoring new
venues for earlier members on every later fetch, and the cached
per-member `scores(for:)` surface. Verified green on the `ios` CI lane
(`xcodebuild test`); logic also exercised end-to-end via an isolated
Swift 5.10 SwiftPM harness on the Linux dev box (the iOS target itself
needs UIKit/Supabase/CoreLocation and cannot build there).

**Adjacency â€” the pool manager is built and tested but not yet wired
into a live session.** Nothing yet constructs a `RunningUnionPoolManager`
per session, feeds it the tb-07 fetch executor's output profiled into
`Q5PoolVenue`s, or hands its `scores(for:)` cache to the verdict
engine. That wiring is tb-11 (verdict engine rewrite) and tb-13
(verdict firing on Q5-complete). Recorded so it is not lost.
