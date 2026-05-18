---
issue: tb-20
title: Group session shows S04 Waiting and advances to S05
status: ready-for-agent
type: AFK
github_issue: 107
prd: v1-prd
created: 2026-05-18
---

# tb-20 — Group session shows S04 Waiting and advances to S05

## Parent

[[bug-07-post-q5-router-unwired|bug-07]] — post-Q5 router. This slice adds the group path's S04 Waiting surface on top of the router skeleton from [[tb-19-solo-verdict-route|tb-19]].

## What to build

A multi-member session — or one where the initiator shared an invite — shows the S04 Waiting surface after Q5 submit, then advances to S05 when the verdict fires.

- A new session-snapshot read returns the room snapshot in one PostgREST round-trip: members (id + role), the set of user-ids that have answered (from `votes`), and the room status. Mirrors the boot fetch the web fallback's session room already does.
- The post-quiz host (from tb-19) gains a waiting phase: for a non-solo session it bootstraps a `WaitingStore` from the snapshot and renders `WaitingScreen`.
- The host re-runs the snapshot on a few-second cadence and re-bootstraps the `WaitingStore` (documented idempotent), so the avatar row reflects peers joining and answering at a few-seconds granularity.
- The same poll detects the verdict landing and advances to S05 — reusing tb-19's verdict fetch and `VerdictScreen` render.

Out of scope: a Realtime channel (the poll is the deliberate v1 mechanism — adjacency on bug-07); the ratify→S06 / reroll CTAs.

## Acceptance criteria

- [ ] Submitting Q5 in a group session (member count ≥ 2, or invite shared) routes to the S04 Waiting surface — not S00 Landing, not straight to S05.
- [ ] The Waiting avatar row reflects peers joining and answering within one poll cycle.
- [ ] The Waiting surface advances to the S05 verdict within a few seconds of the engine firing.
- [ ] The snapshot read returns members, answered-set, and room status in a single round-trip and is covered by unit tests.
- [ ] Unit tests cover the group routing decision and the waiting-to-verdict advance.
- [ ] iOS build succeeds and the `ios` test lane is green.

## Blocked by

- [[tb-19-solo-verdict-route|tb-19]] ([#106](https://github.com/samfarls55/gettoit/issues/106)) — the post-quiz host, `RootView` wiring, and verdict poll this slice extends.
