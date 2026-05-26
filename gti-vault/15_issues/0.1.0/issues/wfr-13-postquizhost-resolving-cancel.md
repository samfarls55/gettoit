---
issue: wfr-13
title: Add Cancel affordance to PostQuizHost resolving phase
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 254
---

# wfr-13 — PostQuizHostScreen resolving spinner has no Escape Hatch

## What to build

While the post-Q5 router polls `verdicts`, the user is trapped on a spinner. Add a "Cancel" or "Back to plan" affordance (top-trailing) that fires `host.teardown()` + clears `postQuizHost`.

## Acceptance criteria

- [ ] Cancel affordance visible during `.resolving` phase.
- [ ] Tap returns to PlanList without firing the verdict.
- [ ] Snapshot test covers the resolving phase with chrome.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/principles#P-01. Safe Exploration]]
- [[../../30_design/interaction-patterns/surfaces#Do]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #13.

## Comments

- 2026-05-26 — Closed via PR #286. `PostQuizHostScreen.resolvingSurface` gains a top-trailing `Cancel` text-verb chrome row mirroring the QuizChrome / LockedScreen (wfr-12) text-only chrome idiom — eyebrow-token treatment (Inter 700 / 11 / 0.18em / UPPERCASE / white 0.78), 44pt min hit row. Wired to the existing `onEndSession` closure — the `RootView` call site already implements that as `host.teardown() + postQuizHost = nil`, so the precedence chain falls through to PlanList. No confirmation: Q5 is already submitted (nothing to discard) and the *Escape Hatch* anti-pattern guidance explicitly rules out confirm-to-cancel. New static `PostQuizHostScreen.resolvingCancelLabel = "Cancel"` constant + `simulateResolvingCancelTapForTesting()` test seam mirror the LockedScreen (wfr-12) idiom. Tests cover the label constant, the closure invocation, a post-condition assertion that the host stays in `.resolving` (no verdict fires on the cancel path), and a render-smoke pass.
