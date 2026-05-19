---
issue: bug-12
title: Post-Q5 verdict screen never renders — a double onSubmitted orphans the polling host
status: ready-for-agent
type: AFK
github_issue: 142
created: 2026-05-19
prd: v1.1-quiz-redesign-prd
---

# bug-12 — Verdict screen never renders; a double `onSubmitted` orphans the polling host

## Parent

[[../_index|v1.1 backlog]] — found during the 2026-05-19 verdict-spinner diagnosis (TestFlight build 267 + the temporary `debug_trace` breadcrumb instrumentation from PR #141).

## What's broken

After Q5 submit, the post-Q5 "LINING UP THE VERDICT" resolving spinner spins forever — even though the verdict row lands and the verdict fetch returns it successfully. This is the user-visible "the app still gets stuck at the verdict screen" report. It is **not** the [[bug-10-verdict-poll-no-timeout|bug-10]] hung-fetch hypothesis — the fetch returns fine; the verdict just lands on a host object the screen is no longer rendering.

## Root cause

`QuizScreen` calls its `onSubmitted` callback from **two** places on a single successful Q5 submit:

- the explicit call in `submitFromQ5()` after `coordinator.submit()` returns `.success`, and
- the `.submitted` step case, which renders a `Color.clear` view whose `.task` calls `onSubmitted()`.

Both fire. `onSubmitted` is wired to `RootView.enterPostQuiz`, which builds a **new `PostQuizHost`** and assigns `postQuizHost` on every call:

1. First call — `postQuizHost = host A`; `RootView` renders `PostQuizHostScreen(host: A)` and its `.task` starts polling host A.
2. Second call — `postQuizHost = host B`. SwiftUI keeps `PostQuizHostScreen`'s view identity, so the `.task` does **not** re-run — host B is never polled.
3. Host A's still-running `.task` reaches `.verdict`. Host B stays `.resolving`.
4. The visible screen renders host B → spinner forever. Host A — the one that actually resolved the verdict — is orphaned.

## Evidence

The build-267 breadcrumb trail (`debug_trace` session `836E5EF6`, ordered by `seq`):

- `rootView.enterPostQuiz` fired **twice** — seq 1 and seq 6.
- Exactly **one** `hostScreen.task.start` (seq 2) — the second host never got a task.
- `fetchVerdict` ran to completion: `fetchVerdict.afterVerdictRow found=true method=quorum`, `fetchVerdict.afterOptionFetches option=true cuts=95 votes=1 members=1`, `fetchVerdict.return.view`.
- `poller.returningVerdict` → `host.pollSolo.gotVerdict` → `hostScreen.task.ended` — the whole chain completed in ~3.6s.
- Yet the user's screen kept the spinner — because that chain ran on the orphaned host.

This disproves the handoff's "`fetchVerdict` hangs" theory and retires the proposed per-fetch timeout guardrail — the `VerdictPoller.maxWait` bound works as designed.

## Desired behavior

The post-Q5 verdict screen renders the resolved verdict. Entering the post-Q5 router is idempotent: a duplicate `onSubmitted` for a room already routed must not replace the live polling host.

## Agent Brief

**Category:** bug
**Summary:** A successful Q5 submit delivers `onSubmitted` twice; `RootView` builds a second `PostQuizHost` and the screen ends up bound to a host that is never polled. Make the post-Q5 entry idempotent and collapse `onSubmitted` to a single trigger.

**Current behavior:** `onSubmitted` fires twice per successful submit (the Q5 CTA path and the `.submitted` step's `.task`). `RootView.enterPostQuiz` builds and assigns a fresh `PostQuizHost` each call; SwiftUI does not re-run `PostQuizHostScreen`'s `.task` for the replacement, so the verdict resolves on an orphaned host and the spinner never clears.

**Desired behavior:** The verdict screen renders. `RootView.enterPostQuiz` is idempotent per room — a duplicate entry for a room already held in `postQuizHost` is ignored, never replacing the live host. A genuinely new session (different room) still routes normally.

**Key interfaces:**
- `RootView.enterPostQuiz` — add a per-room idempotency guard: if `postQuizHost` already holds this room, ignore the call. This is the load-bearing fix — replacing a live polling host is the actual defect.
- `QuizScreen.submitFromQ5` / the `.submitted` step case — collapse `onSubmitted` to a single trigger. The `.submitted` step's `.task` already covers the `.failed`-retry path, so the explicit call in `submitFromQ5` is the redundant one to drop.
- `DebugTrace` — this issue also reverts the temporary PR #141 instrumentation (see "Also in this slice").

**Also in this slice — revert the temporary instrumentation:**
- Delete `ios/Sources/App/DebugTrace.swift` and every `DebugTrace.mark(...)` call site (`RootView`, `PostQuizHostScreen`, `PostQuizHost`, `VerdictPoller`, `VerdictStore`).
- Drop the `public.debug_trace` prod table via the Supabase Management API (it was created outside migrations — it is temporary).

**Acceptance criteria:**
- [ ] A successful Q5 submit routes to a single `PostQuizHost`; a duplicate `onSubmitted` for the same room does not replace it.
- [ ] After Q5 submit the post-Q5 router renders `VerdictScreen` once the verdict lands — no infinite resolving spinner.
- [ ] Starting a genuinely new decision (a different room) in the same app launch still routes into a fresh `PostQuizHost`.
- [ ] `DebugTrace.swift` and all `DebugTrace.mark` call sites are removed; `grep -r DebugTrace ios/` is empty.
- [ ] The `public.debug_trace` table is dropped from `gettoit-prod`.
- [ ] iOS build succeeds and the `ios` test lane is green.

**Out of scope:**
- The reasons a verdict might never land — that is [[bug-13-engine-no-survivor-on-empty-pool|bug-13]] / [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]].
- Any Realtime / push upgrade to replace polling.

## Test seam

No clean unit-test seam exists: `RootView` has no test file and `enterPostQuiz` is private; the SwiftUI `.task` double-fire is not deterministically drivable in the existing smoke-test harness. Verification is the CI build → TestFlight → reproduction. The absence of a seam is itself a finding — `RootView` is ~700 lines of untested routing state; a `/improve-codebase-architecture` pass is recommended once v1.1 is working (deferred per the founder).

## Blocked by

None — self-contained iOS change plus one Management-API table drop. Can start immediately.

## Related

- [[bug-10-verdict-poll-no-timeout|bug-10]] — the hung-fetch hypothesis this supersedes
- [[tb-19-solo-verdict-route|tb-19]] — the post-Q5 router this hardens
- [[bug-13-engine-no-survivor-on-empty-pool|bug-13]], [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] — the separate engine-wedge bug found in the same diagnosis
- PR #141 — the temporary `DebugTrace` instrumentation this reverts

## Comments

**2026-05-19 — filed.** Found during the 2026-05-19 verdict-spinner diagnosis against build 267. Triaged `ready-for-agent` / AFK — self-contained, clear behavioral contract, no design fork. Verification is CI + TestFlight reproduction (no unit-test seam — see "Test seam").
