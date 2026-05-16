---
issue: tb-10
title: Running-union candidate pool manager
status: ready-for-agent
type: AFK
github_issue: 71
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-10 — Running-union pool manager

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (G).

## What to build

A server-side pool manager that holds the group candidate pool as the **running union** of every member's Foursquare fetch — never an intersection (the engine is built to take a broad set and narrow it). As the union grows with each member's fetch, the manager triggers `prefFn` re-scoring of the new venues for every already-completed member, so no member's scores go stale, and caches per-member scores for the verdict engine to consume.

## Acceptance criteria

- [ ] The group pool is the running union of all members' fetches, deduped by venue id.
- [ ] Adding a member's fetch re-scores the new venues for every already-completed member via their cached `prefFn`.
- [ ] Per-member scores are cached and readable by the verdict engine.
- [ ] Verified indirectly through the verdict-engine tests (tb-11) and a manual multi-member session run — no dedicated test suite required per the PRD.

## Blocked by

- [[tb-07-per-member-foursquare-fetch|tb-07]] — the pool unions per-member fetches.
- [[tb-09-preference-function-axis-scorers|tb-09]] — re-scoring needs each member's cached `prefFn`.
