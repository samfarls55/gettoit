---
issue: tb-19
title: Solo session reaches the verdict — wire the post-Q5 router skeleton
status: done
type: AFK
github_issue: 106
prd: 0.1.0-prd
created: 2026-05-18
---

# tb-19 — Solo session reaches the verdict

## Parent

[[bug-07-post-q5-router-unwired|bug-07]] — quiz submit dead-ends to the S00 Landing screen because the post-Q5 router was never wired. This slice stands up the router skeleton on the simplest end-to-end path.

## What to build

After a solo participant submits Q5, the app routes end-to-end to the S05 Verdict surface instead of falling back to S00 Landing.

A "solo session" is the lone initiator who never shared an invite — `SoloPath.shouldSkipWaiting(memberCount:invitedShared:)` is the canonical detector and already exists and is tested.

End-to-end path:

- `RootView` captures a post-quiz session context (room, user, initiator flag, invited-shared flag) when the quiz reports a successful submit, instead of just clearing the active quiz.
- A new post-quiz host owns the session lifecycle as a phase machine: resolving → verdict, plus a failure state.
- On a solo session the host skips S04 Waiting entirely.
- The host polls the `verdicts` table via `VerdictStore.fetchVerdict` on a few-second cadence until a row lands, then renders `VerdictScreen` in `.solo` mode. The verdict auto-fires server-side on the lone Q5-complete vote — see [[tb-13-verdict-firing-q5-complete|tb-13]].
- The poll loop stops on verdict-found and on host teardown — no leaked task.
- Ending the session returns to S00 Landing (now the correct destination, not a dead-end).

Out of scope: the S04 Waiting surface (tb-20), the ratify→S06 / reroll CTAs (adjacency on bug-07), any Realtime channel.

## Acceptance criteria

- [ ] Submitting Q5 in a solo session routes to the S05 verdict in `.solo` mode, never to S00 Landing.
- [ ] The verdict appears within a few seconds of the engine firing.
- [ ] The verdict poll loop stops once the verdict is found and on host teardown — no leaked timer/task.
- [ ] A group session no longer dead-ends on S00 Landing — it holds on a neutral resolving surface and still reaches S05 when the verdict fires (the full S04 Waiting surface is tb-20).
- [ ] Unit tests cover the verdict poller (verdict-found stops the loop) and the solo-skip routing decision.
- [ ] iOS build succeeds and the `ios` test lane is green.

## Blocked by

None — can start immediately. `SoloPath`, `VerdictStore`, and `VerdictScreen` already exist.

## Comments

**2026-05-18 — closed (AFK, PR #106-branch).** The post-Q5 router skeleton landed on `afk/tb-19`:

- `PostQuizSessionContext` — value type capturing `(roomID, userID, isInitiator, invitedShared)` at Q5 submit. `isSolo` delegates to `SoloPath.shouldSkipWaiting` (memberCount fixed at 1 — the lone initiator is the only `members` row by construction at submit time).
- `VerdictPoller` — a `Sendable` struct that polls `VerdictStore.fetchVerdict` every 3 s until a row lands. Both the fetch and the inter-poll sleep are injected closures, so the loop is unit-tested deterministically with no live client and no wall-clock waits. Stops on verdict-found and rethrows `CancellationError` on host teardown.
- `PostQuizHost` — `@MainActor @Observable` phase machine: `resolving → verdict` / `resolving → failed`. Owns the poll-task lifecycle; `teardown()` cancels the in-flight task (no leaked task). `start()` runs the poll inline for the SwiftUI `.task` driver (auto-cancelled on view teardown).
- `PostQuizHostScreen` — renders the three phases. The resolving surface is a neutral hold (waiting-gradient + spinner), explicitly not S00 Landing. `VerdictScreen` renders in whatever mode `VerdictStore` resolved (`.solo` for a solo session).
- `RootView` — `onSubmitted` now builds the host and routes to `PostQuizHostScreen` instead of clearing `activeQuiz` (which dead-ended on S00 — bug-07). New precedence slot `activeQuiz → postQuizHost → readOnlyView → …`. Ending the session returns to S00 Landing.

Verdict-ready detection is by polling, not Realtime — a Realtime channel on `verdicts` is a later slice, per bug-07 §Fix scope. The full S04 Waiting surface (avatar row, countdown, nudge) is tb-20; a group session holds on the same neutral resolving surface for now and still reaches S05.

Tests: `VerdictPollerTests`, `PostQuizHostTests`, `PostQuizHostScreenTests` — cover verdict-found stopping the loop, teardown stopping the loop, the solo-skip routing decision, and the phase machine. Design-system `verify.mjs` green (token-only consumption, no spec change).
