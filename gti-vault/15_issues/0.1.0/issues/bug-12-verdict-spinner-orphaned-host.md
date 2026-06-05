---
issue: bug-12
title: Post-Q5 verdict screen never renders â€” a double onSubmitted orphans the polling host
status: done
type: AFK
github_issue: 142
created: 2026-05-19
prd: 0.1.0-quiz-redesign-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-12 â€” Verdict screen never renders; a double `onSubmitted` orphans the polling host

## Parent

[[../_index|0.1.0 backlog]] â€” found during the 2026-05-19 verdict-spinner diagnosis (TestFlight build 267 + the temporary `debug_trace` breadcrumb instrumentation from PR #141).

## What's broken

After Q5 submit, the post-Q5 "LINING UP THE VERDICT" resolving spinner spins forever â€” even though the verdict row lands and the verdict fetch returns it successfully. This is the user-visible "the app still gets stuck at the verdict screen" report. It is **not** the [[bug-10-verdict-poll-no-timeout|bug-10]] hung-fetch hypothesis â€” the fetch returns fine; the verdict just lands on a host object the screen is no longer rendering.

## Root cause

`QuizScreen` calls its `onSubmitted` callback from **two** places on a single successful Q5 submit:

- the explicit call in `submitFromQ5()` after `coordinator.submit()` returns `.success`, and
- the `.submitted` step case, which renders a `Color.clear` view whose `.task` calls `onSubmitted()`.

Both fire. `onSubmitted` is wired to `RootView.enterPostQuiz`, which builds a **new `PostQuizHost`** and assigns `postQuizHost` on every call:

1. First call â€” `postQuizHost = host A`; `RootView` renders `PostQuizHostScreen(host: A)` and its `.task` starts polling host A.
2. Second call â€” `postQuizHost = host B`. SwiftUI keeps `PostQuizHostScreen`'s view identity, so the `.task` does **not** re-run â€” host B is never polled.
3. Host A's still-running `.task` reaches `.verdict`. Host B stays `.resolving`.
4. The visible screen renders host B â†’ spinner forever. Host A â€” the one that actually resolved the verdict â€” is orphaned.

## Evidence

The build-267 breadcrumb trail (`debug_trace` session `836E5EF6`, ordered by `seq`):

- `rootView.enterPostQuiz` fired **twice** â€” seq 1 and seq 6.
- Exactly **one** `hostScreen.task.start` (seq 2) â€” the second host never got a task.
- `fetchVerdict` ran to completion: `fetchVerdict.afterVerdictRow found=true method=quorum`, `fetchVerdict.afterOptionFetches option=true cuts=95 votes=1 members=1`, `fetchVerdict.return.view`.
- `poller.returningVerdict` â†’ `host.pollSolo.gotVerdict` â†’ `hostScreen.task.ended` â€” the whole chain completed in ~3.6s.
- Yet the user's screen kept the spinner â€” because that chain ran on the orphaned host.

This disproves the handoff's "`fetchVerdict` hangs" theory and retires the proposed per-fetch timeout guardrail â€” the `VerdictPoller.maxWait` bound works as designed.

## Desired behavior

The post-Q5 verdict screen renders the resolved verdict. Entering the post-Q5 router is idempotent: a duplicate `onSubmitted` for a room already routed must not replace the live polling host.

## Agent Brief

**Category:** bug
**Summary:** A successful Q5 submit delivers `onSubmitted` twice; `RootView` builds a second `PostQuizHost` and the screen ends up bound to a host that is never polled. Make the post-Q5 entry idempotent and collapse `onSubmitted` to a single trigger.

**Current behavior:** `onSubmitted` fires twice per successful submit (the Q5 CTA path and the `.submitted` step's `.task`). `RootView.enterPostQuiz` builds and assigns a fresh `PostQuizHost` each call; SwiftUI does not re-run `PostQuizHostScreen`'s `.task` for the replacement, so the verdict resolves on an orphaned host and the spinner never clears.

**Desired behavior:** The verdict screen renders. `RootView.enterPostQuiz` is idempotent per room â€” a duplicate entry for a room already held in `postQuizHost` is ignored, never replacing the live host. A genuinely new session (different room) still routes normally.

**Key interfaces:**
- `RootView.enterPostQuiz` â€” add a per-room idempotency guard: if `postQuizHost` already holds this room, ignore the call. This is the load-bearing fix â€” replacing a live polling host is the actual defect.
- `QuizScreen.submitFromQ5` / the `.submitted` step case â€” collapse `onSubmitted` to a single trigger. The `.submitted` step's `.task` already covers the `.failed`-retry path, so the explicit call in `submitFromQ5` is the redundant one to drop.
- `DebugTrace` â€” this issue also reverts the temporary PR #141 instrumentation (see "Also in this slice").

**Also in this slice â€” revert the temporary instrumentation:**
- Delete `ios/Sources/App/DebugTrace.swift` and every `DebugTrace.mark(...)` call site (`RootView`, `PostQuizHostScreen`, `PostQuizHost`, `VerdictPoller`, `VerdictStore`).
- Drop the `public.debug_trace` prod table via the Supabase Management API (it was created outside migrations â€” it is temporary).

**Acceptance criteria:**
- [ ] A successful Q5 submit routes to a single `PostQuizHost`; a duplicate `onSubmitted` for the same room does not replace it.
- [ ] After Q5 submit the post-Q5 router renders `VerdictScreen` once the verdict lands â€” no infinite resolving spinner.
- [ ] Starting a genuinely new decision (a different room) in the same app launch still routes into a fresh `PostQuizHost`.
- [ ] `DebugTrace.swift` and all `DebugTrace.mark` call sites are removed; `grep -r DebugTrace ios/` is empty.
- [ ] The `public.debug_trace` table is dropped from `gettoit-prod`.
- [ ] iOS build succeeds and the `ios` test lane is green.

**Out of scope:**
- The reasons a verdict might never land â€” that is [[bug-13-engine-no-survivor-on-empty-pool|bug-13]] / [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]].
- Any Realtime / push upgrade to replace polling.

## Test seam

No clean unit-test seam exists: `RootView` has no test file and `enterPostQuiz` is private; the SwiftUI `.task` double-fire is not deterministically drivable in the existing smoke-test harness. Verification is the CI build â†’ TestFlight â†’ reproduction. The absence of a seam is itself a finding â€” `RootView` is ~700 lines of untested routing state; a `/improve-codebase-architecture` pass is recommended once 0.1.0 is working (deferred per the founder).

## Blocked by

None â€” self-contained iOS change plus one Management-API table drop. Can start immediately.

## Related

- [[bug-10-verdict-poll-no-timeout|bug-10]] â€” the hung-fetch hypothesis this supersedes
- [[tb-19-solo-verdict-route|tb-19]] â€” the post-Q5 router this hardens
- [[bug-13-engine-no-survivor-on-empty-pool|bug-13]], [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] â€” the separate engine-wedge bug found in the same diagnosis
- PR #141 â€” the temporary `DebugTrace` instrumentation this reverts

## Comments

**2026-05-19 â€” filed.** Found during the 2026-05-19 verdict-spinner diagnosis against build 267. Triaged `ready-for-agent` / AFK â€” self-contained, clear behavioral contract, no design fork. Verification is CI + TestFlight reproduction (no unit-test seam â€” see "Test seam").

**2026-05-19 â€” done (PR #147).** Idempotency guard landed as a new pure helper `PostQuizRouter.shouldEnterPostQuiz` (mirrors `SoloPath` â€” keeps the load-bearing rule deterministically testable despite `RootView` having no test seam). `RootView.enterPostQuiz` consults it on `postQuizHost?.context.roomID`: a duplicate `onSubmitted` for a room already routed is a no-op; a genuinely new room still routes. `onSubmitted` collapsed to a single trigger by dropping the explicit call in `QuizScreen.submitFromQ5` â€” the `.submitted` step's `.task` is the sole trigger and also covers the `.failed`-retry path. Temporary PR #141 instrumentation reverted: `DebugTrace.swift` and every `DebugTrace.mark` call site deleted (`grep -r DebugTrace ios/` empty); the `public.debug_trace` prod table dropped from `gettoit-prod` via the Supabase Management API (`drop table ... cascade`, also clearing the diagnosis-scoped RLS insert policy). New `PostQuizRouterTests` (3 cases) and the `ios` CI test lane both green. End-to-end verification remains the CI build â†’ TestFlight reproduction per "Test seam".
