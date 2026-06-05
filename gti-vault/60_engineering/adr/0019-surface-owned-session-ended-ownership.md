---
adr: 0019
title: Surface-owned session-ended ownership for Realtime room-status transitions
status: accepted
date: 2026-05-26
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0019 â€” Surface-owned session-ended ownership for Realtime room-status transitions

## Status

Accepted â€” 2026-05-26. Outcome of the `/workflow-review` grill on `WaitingScreen.swift` finding #5 (audit report `gti-vault/15_issues/_runs/2026-05-26-0958-workflow-review.md`). Establishes the ownership pattern for "the room I'm in just got nuked from outside" transitions across all Realtime-channel-backed surfaces (WaitingScreen now, QuizScreen next, future late-joiner surfaces by extension). Unblocks audit finding #17 (WaitingScreen initiator-Leave affordance).

## Context

CONTEXT.md `Plan delete` locks the joiner-side framing: "joiners get a 'session ended' toast and are punted." The copy + UX is settled. The architectural question is *who owns the transition*.

The plumbing already exists:

- `PlanDeleteCoordinator.swift:21-30` runs `rooms.status = 'expired'` **before** the `DELETE plan` SQL, so the Realtime channel fires `roomStatusChanged(.expired)` while joiners are still subscribed.
- `WaitingStore.swift` has `RoomStatus.expired` (line 49), `WaitingStoreEvent.roomStatusChanged(RoomStatus)` (line 74), and assigns `status = newStatus` on receipt (line 165). The store **knows** when the room expires.

The gap is consumption: `WaitingScreen.swift:110-113` only listens for `verdictReady`, not for `status == .expired`. The wait surface sits forever when the room goes away.

Same gap exists on `QuizScreen` â€” if the creator deletes mid-quiz, the joiner's quiz screen doesn't react. Same `RoomStatus.expired` projection, same missing `.onChange`.

The decision is whose responsibility this transition is: the screen, the store, or the RootView precedence chain.

## Decision

**The screen that displays a Realtime-channel session owns the session-ended transition for that session.** Specifically:

- The screen subscribes to its store's `status` via `.onChange(of: store.status)` (or equivalent for a different store type).
- On `.expired`, the screen renders the inline "session ended" toast AND fires an `onSessionEnded?` callback up to the host (`PostQuizHostScreen` / `RootView`).
- The host tears down the precedence-chain state that anchored the screen (`activeQuiz = nil`, `postQuizHost = nil`, etc.) so the user lands on `PlanListScreen`.

Stores stay **passive projections of server state** â€” they do not own navigation. They expose state changes; the surface that renders the state interprets them.

Hosts (`PostQuizHostScreen`, `RootView`) own the precedence-chain teardown, not the toast itself. Toast lives where the user's eyes are.

## Considered alternatives

### Coordinator-owned (store / new `WaitingCoordinator` fires the callback directly)

`WaitingStore` gets `onSessionEnded: @escaping () -> Void` injected at construction. The store calls it the moment `.expired` arrives, regardless of which surface is mounted.

Rejected because:

- Forces the store from a pure projection into a navigation-owner â€” couples server-state observation to UI lifecycle.
- The same coordinator-owned logic would have to exist on `QuizStore` / a hypothetical `QuizCoordinator` for the mid-quiz case, doubling the navigation closures the host has to inject and remember to clear.
- Coordinator-owned doesn't actually centralize the work â€” each store still needs its own `onSessionEnded`. The "centralization" is illusory.
- Toast UX is a per-surface concern; the coordinator would have to either render the toast itself (UI in a non-UI layer) or signal the surface to do it (back to surface-owned).

### RootView-owned (global `sessionEnded` precedence step)

A new `@State sessionEnded: SessionEndedReason?` on RootView, observed by a thin subscriber, overrides the precedence chain to render a top-level `SessionEndedToastScreen` that auto-dismisses to PlanList.

Rejected because:

- The toast lives one mental level removed from the wait context â€” visually janky (mid-wait screen vanishes, replaced by a different surface, replaced by PlanList).
- Novel surface type (`SessionEndedToastScreen`) for one transition; the existing precedence chain has no surface that exists *only to announce a thing happened*.
- Requires global subscription wiring at RootView that has to know about every Realtime channel the user could be inside â€” couples RootView to room-state plumbing it currently delegates.
- Forces every future Realtime-channel surface to register/de-register with the RootView subscriber.

### Status quo (do nothing)

Joiner sits on WaitingScreen forever after creator deletes. Background app refresh eventually picks up `rooms.status = 'expired'` via the snapshot poll; but if the user is foregrounded, the screen is stuck. Tested manually 2026-05-26 â€” silent dead state, no toast, no punt.

Rejected because:

- Direct contradiction of CONTEXT.md `Plan delete`: "joiners get a 'session ended' toast and are punted."
- Audit finding #5 explicitly flags this as a Foundation/Pattern violation against [[gti-vault/30_design/interaction-patterns/principles#P-04. Changes in Midstream]] (the room state changed mid-flow with no surface response).

## Consequences

### Immediate (v1.1)

- `WaitingScreen` adds `.onChange(of: waitingStore.status)` mirroring the existing `verdictReady` pattern on line 110. On `.expired`: show toast + fire `onSessionEnded?`. Host clears `postQuizHost`. (audit finding #5 â†’ AFK issue.)
- `QuizScreen` gets the same treatment for `QuizStore` (or whichever store carries `RoomStatus` for the quiz path). Host clears `activeQuiz`. (new follow-up issue.)
- Audit finding #17 (WaitingScreen initiator-Leave chrome glyph) unblocks: the Leave-button flow can reuse the same `onSessionEnded` callback shape â€” the initiator's Leave fires `MemberLeaveStore.ExpireRoom`, the channel echoes `roomStatusChanged(.expired)` back, and the same surface-owned handler punts the initiator too. One path, two callers.

### Architectural

- Pattern extends to any future surface that mounts inside a Realtime channel: `LockedScreen`, late-joiner read-only landings, post-launch group-quiz observers. Each surface watches its own store's `status` and surfaces its own toast + callback.
- Stores remain pure projections of server state â€” easier to test (just fire events; assert state); easier to reason about (no hidden navigation closures).
- The "session ended" copy + behavior lives in one design doc (`surfaces.md` punted-surface section, to be added when the pattern hits its 2nd consumer) rather than one architectural doc.

### Cost

- One `.onChange` per surface that mounts inside a Realtime session. Trivial. Lines added scale linearly with surface count, but so does the alternative.
- If we ever need a *global* "you've been signed out / your auth session died" hook, that's a different concern (auth state, not room state) and would route through `AuthCoordinator`, not this pattern. Documented here so a future contributor doesn't reach for surface-owned for the wrong problem.

## Open questions

- Toast primitive: WaitingScreen currently has no toast affordance. The first AFK issue (WaitingScreen session-ended handler) needs to either reuse an existing snackbar primitive or accept a one-line inline toast at the screen's top edge. Resolved at implementation time, not in this ADR.
- "Session ended" copy is locked by CONTEXT.md; no design re-work needed.

## Status of related findings

- **Finding #5** (this grill) â€” closed via this ADR + WaitingScreen AFK issue.
- **Finding #17** (WaitingScreen initiator Leave) â€” unblocked; reuses the same `onSessionEnded` callback shape.
- **QuizScreen mid-quiz expire** â€” new follow-up issue spawned (not in the original audit; surfaced by this ADR's scope decision).
