---
issue: bug-07
title: Quiz submit dead-ends to the landing screen â€” post-Q5 router (S04/S05) never wired into RootView
status: done
type: HITL
github_issue: 109
created: 2026-05-18
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-07 â€” Post-Q5 router unwired; quiz submit dead-ends to S00 Landing

## Parent

[[../_index|0.1.0 backlog]] â€” defect surfaced during dogfooding 2026-05-18. Same build-but-don't-integrate family as [[../verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]].

## What's broken

On iOS, completing Q5 and submitting the quiz takes the user back to the S00 Landing screen. The session never reaches S04 Waiting or S05 Verdict â€” the process never finishes. (The web fallback is unaffected; `SessionRoom.tsx` routes to its waiting surface correctly.)

## Root cause

`RootView.swift` mounts `QuizScreen` with `onSubmitted: { activeQuiz = nil }`. After a successful Q5 submit that closure only clears `activeQuiz`; nothing else is set, so the view-precedence chain falls straight through to `LandingScreen` (S00).

The deeper cause: the **post-Q5 router was never built**. The S04â†’S05 surfaces and stores exist and are unit-tested, but nothing constructs them in production:

- `WaitingStore`, `VerdictStore`, `WaitingScreen` â€” **zero construction sites** in `ios/Sources/` (grep-confirmed).
- `VerdictScreen` is mounted in exactly one place â€” the read-only late-joiner branch (TB-11). Never for a normal participant.
- iOS has **no Realtime channel code anywhere**. The web `SessionRoom.tsx` subscribes to the room channel; iOS never did.

Server side is fine: per [[tb-13-verdict-firing-q5-complete|tb-13]] the verdict auto-fires when all members complete Q5 (solo fires on the single vote). Once the iOS client inserts the `votes` row the verdict computes server-side â€” the client just never detects it.

## Fix scope (decided 2026-05-18)

Wire the post-Q5 router with a **polling** verdict-ready signal, not Realtime:

- After Q5 submit, route into S04 Waiting (or skip it for the solo path via `SoloPath.shouldSkipWaiting`).
- A ~3s poll loop re-bootstraps `WaitingStore` (members / answered / status) and probes `VerdictStore.fetchVerdict`; on a non-nil verdict, route to S05.
- Realtime is **out of scope** â€” a few-seconds delay after the final answer is acceptable. Decided against building an iOS Realtime subsystem inside a bugfix (new failure modes: socket auth, reconnect, backgrounding). `WaitingStore.bootstrap(...)` is already documented idempotent, so a poll-driven re-seed fits the existing seam; a later Realtime upgrade swaps the poll loop for `apply(event:)` without touching the surfaces.

Out of scope (track separately): S06 Locked, S07 Reroll, S08 Check-in routing; the Realtime upgrade.

## Acceptance criteria

- [ ] On a real iOS device, completing Q5 and submitting routes to S04 Waiting (group) or directly to S05 Verdict (solo), never to S00 Landing.
- [ ] A solo session (initiator alone, no invite shared) skips S04 and lands on the S05 solo variant.
- [ ] A group session shows S04 Waiting and advances to S05 within a few seconds of the verdict firing.
- [ ] The poll loop stops on verdict-ready and on view teardown â€” no leaked timer.
- [ ] Tests cover the poller (verdict-found stops the loop) and the solo-skip branch.

## Blocked by

None â€” all consumed surfaces/stores already exist.

## Adjacencies

- Realtime upgrade for live S04 peer updates â€” separate follow-up.
- S06/S07/S08 routing still unwired â€” separate follow-up; same unwired-surface pattern as this issue and [[../verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]].

## Comments

**2026-05-18 â€” filed.** Surfaced during dogfooding; root-caused in-session. Polling-vs-Realtime fork resolved with the user in favour of polling (Option B).

**2026-05-18 â€” decomposed.** Broken into two AFK tracer-bullet slices via `/to-issues`: [[tb-19-solo-verdict-route|tb-19]] (solo path â€” post-Q5 router skeleton) and [[tb-20-group-waiting-route|tb-20]] (group path â€” S04 Waiting surface).

**2026-05-18 â€” closed.** Closed early (ahead of the original "closes when both slices merge" plan) so the open backlog is AFK-only and `/execute-issues` sees a clean ready-for-agent set. The defect itself is still live on-device until tb-19 and tb-20 merge â€” those two issues now carry the fix, the polling design, and the on-device acceptance criteria. Treat tb-19/tb-20 as the tracking record for the remaining work; this note is the historical root-cause record only.
