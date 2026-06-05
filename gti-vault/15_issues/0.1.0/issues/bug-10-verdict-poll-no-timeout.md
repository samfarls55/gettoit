---
issue: bug-10
title: Post-Q5 "Lining Up the Verdict" spinner hangs forever â€” the verdict poll has no timeout
status: done
type: AFK
github_issue: 118
created: 2026-05-18
prd: 0.1.0-quiz-redesign-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-10 â€” Verdict poll has no timeout; the resolving spinner hangs forever

## Parent

[[../_index|0.1.0 backlog]] â€” found during the 2026-05-18 verdict diagnosis ([[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]], Defect C).

## What's broken

After Q5 submit a solo session shows the post-Q5 "LINING UP THE VERDICT" resolving surface while it waits for the verdict. If the verdict never lands, the surface spins **forever** â€” there is no upper bound. Its own body copy promises *"no spinners forever, promise."* The code cannot honor that.

This is what made the [[bug-08-verdict-pipeline-integration-unwired|bug-08]] / [[bug-09-verdict-fire-dispatch-guc-noop|bug-09]] failures present to the user as an eternal hang with no feedback, rather than an error they could retry.

## Root cause

The post-Q5 verdict poll loop is unbounded. It leaves the resolving phase only on one of two events: a verdict row appears (â†’ verdict surface), or a fetch call throws (â†’ the failed/retry surface). A server-side verdict-fire failure produces **neither** â€” the verdict-fire dispatch is fire-and-forget (`pg_net`), so a failed or never-invoked engine simply means the verdict row never appears and the read keeps returning "not found yet" without error. The loop therefore spins indefinitely and the failed/retry surface is never reached.

## Desired behavior

The verdict poll should be bounded. After a reasonable wall-clock ceiling with no verdict, the post-Q5 host should transition to its existing failed phase â€” the quiet retry surface â€” instead of spinning forever. The retry control already exists and already re-enters the poll; this issue only adds the give-up transition.

A normal verdict resolves within a few seconds of the engine firing, so the ceiling can be generous (target roughly 60â€“90 seconds of total wait given the existing few-second poll cadence) â€” long enough never to cut off a healthy slow resolve, short enough that a real failure surfaces as a retryable error rather than an infinite hang.

## Agent Brief

**Category:** bug
**Summary:** The post-Q5 verdict poll loop is unbounded; give it a timeout so a verdict that never lands surfaces the existing failed/retry surface instead of an infinite spinner.

**Current behavior:**
After Q5 submit, the post-Q5 router enters a resolving phase that polls for the room's verdict row on a few-second cadence. The poll loop runs unconditionally until a verdict is found or a fetch call throws. When the verdict is never written and no fetch error occurs (the verdict-fire path failed silently server-side), the loop never terminates and the resolving spinner is shown forever.

**Desired behavior:**
The poll loop gives up after a bounded total wait. On give-up, the post-Q5 host transitions to its failed phase (the existing quiet retry surface), exactly as it already does on a thrown fetch error. The retry control re-enters the poll for the session's phase as it does today. A verdict that lands within the bound still resolves normally â€” the bound must be generous enough (â‰ˆ60â€“90s of wall-clock wait) never to truncate a healthy slow resolve.

**Key interfaces:**
- The verdict poller â€” the component that polls the verdict fetch on a cadence until a row lands. It already exposes injected `fetch` and `sleep` seams for testing. It needs a bound (a max attempt count or a max elapsed wall-clock) after which it signals "gave up" rather than looping. Decide whether "gave up" is a thrown sentinel error or a distinct return value; the post-Q5 host must route it to the failed phase, NOT crash or treat it as a verdict.
- The post-Q5 host phase machine â€” its solo (and group) poll path must treat poll-exhaustion as a transition to the failed phase, the same destination as a fetch error.
- The cancellation contract must be preserved: host teardown / view disappearance still unwinds the loop cleanly with no leaked task or timer. A timeout must not fight cancellation.

**Acceptance criteria:**
- [ ] The verdict poll stops after a bounded total wait when no verdict row ever lands, and the post-Q5 host ends in its failed phase.
- [ ] A verdict that lands before the bound still resolves to the verdict surface â€” the bound never truncates a healthy resolve.
- [ ] The failed surface's retry control still re-enters the poll for the session's phase.
- [ ] Host teardown / view teardown still cancels the loop with no leaked task or timer (existing contract unregressed).
- [ ] Unit tests cover poll-exhaustion â†’ failed (via the injected `fetch`/`sleep` seams, no real wall-clock wait) and verdict-found-before-bound â†’ verdict.

**Out of scope:**
- The underlying reasons a verdict never lands â€” the empty candidate pool ([[bug-08-verdict-pipeline-integration-unwired|bug-08]]) and the GUC dispatch no-op ([[bug-09-verdict-fire-dispatch-guc-noop|bug-09]]). This issue only bounds the wait so failures surface as a retryable error.
- Any Realtime / push upgrade to replace polling.
- The group-path S04 Waiting surface behavior beyond routing poll-exhaustion to failed.

## Blocked by

None â€” self-contained iOS change against components that already exist. Independently shippable and valuable even before bug-08 / bug-09: it converts today's silent infinite hang into the existing retry surface.

## Related

- [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] â€” full diagnosis (Defect C)
- [[bug-08-verdict-pipeline-integration-unwired|bug-08]], [[bug-09-verdict-fire-dispatch-guc-noop|bug-09]] â€” the failures this makes visible-and-retryable
- [[tb-19-solo-verdict-route|tb-19]] â€” the post-Q5 router this hardens

## Comments

**2026-05-18 â€” filed.** Found during the verdict-spinner diagnosis. Triaged `ready-for-agent` / AFK â€” self-contained iOS change, clear behavioral contract, testable through the poller's existing injected seams, no external access or design fork.

**2026-05-18 â€” done (PR #122, AFK).** `VerdictPoller` gained a `maxWait` wall-clock ceiling (default 75s, inside the 60â€“90s window). Once the next inter-poll sleep would push total wait past `maxWait`, `run()` throws `VerdictPoller.PollExhausted` â€” a distinct `Error` sentinel. `PostQuizHost.poll()`'s existing generic `catch` already routes any thrown error to `.failed`, so poll-exhaustion reaches the existing quiet retry surface with no host phase-machine change; the group `pollGroup` loop honours the same ceiling. Cancellation is checked before the give-up branch, so host/view teardown still unwinds as `CancellationError` â€” the timeout never fights cancellation. A non-finite `maxWait` (`.infinity`) disables the bound; the three cancellation-isolation tests use it so the bound never races their cancel window. All acceptance criteria covered by unit tests via the injected `fetch`/`sleep` seams (no real wall-clock wait). See [[../../../60_engineering/verdict-path-options-table-never-populated|verdict diagnosis]] Defect C for the resolution note.
