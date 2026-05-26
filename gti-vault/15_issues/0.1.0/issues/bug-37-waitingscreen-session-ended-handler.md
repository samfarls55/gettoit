---
issue: bug-37
title: WaitingScreen — session-ended handler on RoomStatus.expired
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26 grill #5
created: 2026-05-26
github_issue: 280
---

# bug-37 — WaitingScreen — session-ended handler on RoomStatus.expired

## Workflow design

**Ownership.** Surface-owned per [[../../60_engineering/adr/0019-surface-owned-session-ended-ownership|ADR-0019]]. `WaitingScreen` watches `waitingStore.status`; on `.expired` shows the "session ended" toast + fires `onSessionEnded?` callback. `PostQuizHostScreen` / `RootView` tear down `postQuizHost` and land the user on PlanList.

**Pattern.** Mirrors the existing `verdictReady` handler in `WaitingScreen.swift:110-113` — one `.onChange(of: waitingStore.status)` modifier next to it.

**Copy.** "Session ended" toast (joiner-facing). Locked by [[../../../../CONTEXT|CONTEXT.md]] `Plan delete` definition; no copywriting needed.

**Foundations.**
- [[../../30_design/interaction-patterns/principles#P-04. Changes in Midstream]] — surface must respond to a server-driven state change the user did not initiate.
- [[../../30_design/interaction-patterns/principles#P-05. Safe Exploration]] — punt to a known surface (PlanList), not a dead screen.

## What to build

1. Add `.onChange(of: waitingStore?.status)` to `WaitingScreen.swift` body (next to the existing `verdictReady` `.onChange` at line 110).
2. On `.expired`:
   - Render an inline "Session ended" toast at the top edge of the surface. If no toast primitive exists yet, ship a minimal one inline (centered text + GTI tokens) — DO NOT block on extracting a reusable snackbar primitive (ADR-0019 explicitly notes the toast primitive is an implementation-time call).
   - Toast auto-dismisses after ~1.5s.
   - Fire `onSessionEnded?` (new optional closure on `WaitingScreen.init`).
3. `PostQuizHostScreen` adds `onSessionEnded` plumbing — on receipt, calls `host.teardown()` and signals `RootView` to clear `postQuizHost`.
4. `RootView` clears `postQuizHost = nil` (lands user on PlanList per existing precedence chain).

## Acceptance criteria

- [ ] `.onChange(of: waitingStore.status)` mounted on `WaitingScreen`.
- [ ] On `.expired`: "Session ended" toast renders for ~1.5s.
- [ ] `onSessionEnded?` callback fires when `.expired` arrives.
- [ ] `PostQuizHostScreen` plumbs the callback through to `RootView`.
- [ ] `RootView` clears `postQuizHost`; user lands on PlanList.
- [ ] No regression on the existing `verdictReady` advance path.
- [ ] Test: fire `WaitingStoreEvent.roomStatusChanged(.expired)` directly; assert callback fires.
- [ ] Snapshot test: WaitingScreen with `status = .expired` shows toast.

## Blocked by

None — ADR-0019 accepted, plumbing exists in WaitingStore.

## Hub anchors

- [[../../60_engineering/adr/0019-surface-owned-session-ended-ownership]]
- [[../../30_design/interaction-patterns/principles#P-04. Changes in Midstream]]
- [[../../../../CONTEXT|CONTEXT.md]] §Plan delete

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. Grill #5 outcome — see [[../_runs/2026-05-26-0958-workflow-review|run report]] grill bucket progress section.

## Comments

- 2026-05-26 — Implemented on `afk/bug-37`. `WaitingScreen` gains `.onChange(of: waitingStore?.status)` next to the existing `verdictReady` handler; on `.expired` it shows the inline "Session ended" toast (Capsule + Glass fill + stroke, top-edge centered, GTI tokens only, no inline px/hex/easing) for 1.5s AND fires the new `onSessionEnded?` callback. `PostQuizHostScreen` plumbs the callback up (falls back to `onEndSession` when not supplied — same idiom as `onLeaveWaiting`). `RootView` wires both `PostQuizHostScreen` mount sites (primary `postQuizHost` and joined-resume `waiting`) to tear the host down and clear their respective precedence slots; the chain falls through to PlanList. Tests cover initiator + invitee fires, non-expired status no-fire guard, locked toast copy, and the host-screen plumbing including the fallback-to-onEndSession path. ADR-0019's "implementation-time" toast primitive decision was resolved as an inline one-line toast (no reusable snackbar extracted yet — surfaces with a second consumer can extract later).
