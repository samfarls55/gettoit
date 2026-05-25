---
issue: tb-20
title: Group session shows S04 Waiting and advances to S05
status: done
type: AFK
github_issue: 107
prd: 0.1.0-prd
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

Out of scope: a Realtime channel (the poll is the deliberate 0.1.0 mechanism — adjacency on bug-07); the ratify→S06 / reroll CTAs.

## Acceptance criteria

- [ ] Submitting Q5 in a group session (member count ≥ 2, or invite shared) routes to the S04 Waiting surface — not S00 Landing, not straight to S05.
- [ ] The Waiting avatar row reflects peers joining and answering within one poll cycle.
- [ ] The Waiting surface advances to the S05 verdict within a few seconds of the engine firing.
- [ ] The snapshot read returns members, answered-set, and room status in a single round-trip and is covered by unit tests.
- [ ] Unit tests cover the group routing decision and the waiting-to-verdict advance.
- [ ] iOS build succeeds and the `ios` test lane is green.

## Blocked by

- [[tb-19-solo-verdict-route|tb-19]] ([#106](https://github.com/samfarls55/gettoit/issues/106)) — the post-quiz host, `RootView` wiring, and verdict poll this slice extends.

## Comments

**2026-05-18 — done (PR [#111](https://github.com/samfarls55/gettoit/pull/111), merged).**

Shipped the group path on the post-Q5 router:

- New `SessionSnapshotStore` reads the room snapshot — members (id+role), the answered user-id set from `votes`, and room status — in a **single PostgREST round-trip** via an embedded-resource query (`rooms?select=status,members(user_id,role),votes(user_id)`). Both `members.room_id` and `votes.room_id` carry FKs to `rooms.id`, so PostgREST resolves the embeds without a relationship hint. Replaces the three-parallel-select shape the web fallback's `SessionRoom` uses.
- `PostQuizHost` gained a `waiting` phase. The entry phase is the routing decision (`SoloPath` via `context.isSolo`): solo → `resolving`, group → `waiting` with a fresh `WaitingStore`. The group poll re-bootstraps that store from a fresh snapshot every cadence tick (`bootstrap` is documented idempotent), then advances to `verdict` when the verdict row lands.
- `PostQuizHostScreen` renders the existing locked S04 `WaitingScreen` for the `.waiting` phase — no new design-system tokens or components.

Decisions of note:
- The host owns the verdict routing, not `WaitingScreen` — the host advances only on an actual `verdicts` row, never on a snapshot's `verdict_ready` status alone (avoids racing ahead of the committed row). `WaitingScreen.onAdvanceToVerdict` is wired to a no-op.
- An unknown `rooms.status` string degrades to `.open` rather than dropping the whole snapshot.

Verified: `ios` lane green (unit + integration), `design-system/scripts/verify.mjs` green. Out-of-scope items (Realtime channel, ratify→S06 / reroll CTAs) untouched — adjacency on bug-07.
