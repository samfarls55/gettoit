---
issue: bug-38
title: QuizScreen — session-ended handler on RoomStatus.expired
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26 grill #5 (ADR-0019 follow-up)
created: 2026-05-26
github_issue: 281
---

# bug-38 — QuizScreen — session-ended handler on RoomStatus.expired

## Workflow design

**Ownership.** Surface-owned per [[../../60_engineering/adr/0019-surface-owned-session-ended-ownership|ADR-0019]]. Same pattern as bug-37 for WaitingScreen — `QuizScreen` watches the quiz store's room-status projection; on `.expired` shows the "session ended" toast + fires `onSessionEnded?` callback. `RootView` clears `activeQuiz` and the user lands on PlanList.

**Why a separate issue from bug-37.** The two surfaces have different host wiring (`QuizScreen` mounts on RootView directly via `activeQuiz`; `WaitingScreen` mounts inside `PostQuizHostScreen`). The handler shape is identical but the host plumbing differs.

**Foundations.** Same as bug-37 — P-04 Changes in Midstream, P-05 Safe Exploration.

## What to build

1. Verify the quiz store (`QuizContext` / wherever `QuizScreen` reads from) exposes `RoomStatus`. If not, mirror the projection from `WaitingStore`.
2. Add `.onChange(of: <quiz-room-status>)` to `QuizScreen` body.
3. On `.expired`:
   - Render inline "Session ended" toast (reuse whatever toast primitive bug-37 ships; if bug-37 hasn't merged, ship a minimal inline equivalent and refactor when bug-37 lands).
   - Fire `onSessionEnded?` (new optional closure on `QuizScreen.init`).
4. `RootView` plumbs the callback: `activeQuiz = nil` on receipt; user lands on PlanList per existing precedence chain.

## Acceptance criteria

- [ ] `.onChange(of: <quiz-room-status>)` mounted on `QuizScreen`.
- [ ] On `.expired`: "Session ended" toast renders for ~1.5s.
- [ ] `onSessionEnded?` callback fires.
- [ ] `RootView` clears `activeQuiz`; user lands on PlanList.
- [ ] No regression on the existing `onClose` / `onExit` / `onSubmitted` paths.
- [ ] Test: simulate `.expired` arrival; assert callback fires + state clears.
- [ ] Snapshot test: QuizScreen with `.expired` status shows toast.

## Blocked by

Soft dependency on bug-37 — if a toast primitive lands there, reuse it here. Not a hard block; the two can merge in either order.

## Hub anchors

- [[../../60_engineering/adr/0019-surface-owned-session-ended-ownership]]
- [[../../30_design/interaction-patterns/principles#P-04. Changes in Midstream]]
- [[../../../../CONTEXT|CONTEXT.md]] §Plan delete

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. Grill #5 outcome — see [[../_runs/2026-05-26-0958-workflow-review|run report]] grill bucket progress section. Not in the original audit (the audit focused on WaitingScreen specifically); ADR-0019 surfaced QuizScreen as carrying the same ownership gap.

## Comments

- 2026-05-26 — Implemented on `afk/bug-38`, merged as PR #297. `QuizScreen` gains an optional `roomStatusStore: WaitingStore?` parameter and an optional `onSessionEnded: (() -> Void)?` callback on the chrome-aware init; on `.expired` the screen shows an inline "Session ended" toast (Capsule + Glass.fillStrong + Glass.stroke, 1.5s window, locked copy matching bug-37) AND fires the callback. `RootView` wires the callback to `activeQuiz = nil` so the precedence chain falls through to PlanList. `QuizContext` now carries the `WaitingStore` instance — reused as a pure room-status projection rather than introducing a separate `QuizStore` type (per the spec: "mirror the projection from WaitingStore"). The Realtime channel that drives `apply(event:)` is owned by the host (out-of-scope for this slice; same architecture seam as `WaitingScreen.waitingStore`). Toast primitive was inline-mirrored from bug-37 rather than extracted to a shared view — both surfaces share the exact same shape, tokens, copy, and duration; a shared extraction belongs in a separate refactor when the pattern hits its 3rd consumer (per ADR-0019 §Open questions). Tests cover initiator + invitee fires, non-expired status no-fire guard, locked toast copy lock (both standalone and cross-surface against `WaitingScreen.sessionEndedToastLabel`), locked duration cross-surface lock, expired-render smoke, and legacy initializer compile-checks.
