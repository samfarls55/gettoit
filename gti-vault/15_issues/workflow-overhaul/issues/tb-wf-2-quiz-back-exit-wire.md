---

issue: tb-WF-2
title: Wire Quiz Back + Exit chrome on iOS
status: done
type: AFK
feature: workflow-overhaul
github_issue: 161
created: 2026-05-19
---

# tb-WF-2 — Wire Quiz Back + Exit chrome on iOS

## Parent

[[sg-wf-2-quiz-back-exit-chrome|sg-WF-2]] — the design-system spec for the two in-quiz nav verbs. This issue is the iOS port: render the chrome, wire the back-step navigation, and wire the exit/leave member-drop with confirmation.

## What to build

End-to-end behavior delivered: a participant on any quiz screen (Q1–Q5) can tap `Back` (Q2–Q5 only) to go to the previous question with their prior answer preserved and re-editable, OR tap `Exit` (initiator) / `Leave` (joiner) to confirm-and-leave the active room. The room continues for the remaining participants; for a solo session, exiting abandons the room and the Plan (once Plans exist post-tb-WF-4) returns to `pending`.

### iOS changes

- **Add the chrome.** Update the existing `QuizQuestionHeader` (or equivalent) to render the two affordances per sg-WF-2's placement + treatment + label rules. Use a single shared chrome row consumed by Q1–Q5; render Back conditionally based on `currentQuestion > 1`.
- **Back behavior.** Wire to the existing `QuizCoordinator` (or whatever drives Q→Q transition today). On Back tap:
  - Decrement the active question index.
  - Restore the prior answer to the input control (chip group, slider, picker, etc.) so it's pre-selected and re-editable.
  - No room mutation; no server call.
- **Exit / Leave behavior.** Open a confirmation sheet/alert using SwiftUI's `.confirmationDialog` or a native alert; copy variants per the spec (initiator / joiner / solo). On confirm:
  - Discard the in-flight quiz answers locally.
  - Server call: drop the user's `members` row from the active room (`DELETE FROM members WHERE room_id = $1 AND user_id = auth.uid()`). RLS already permits self-delete.
  - For solo sessions: also abandon the room (mark `rooms.status = 'expired'` or similar — the agent has autonomy on the exact semantics, but the room must not be reachable as `open` for anyone else).
  - Navigate to the Plan list surface (or, while Plans don't yet exist visibly, to S00 Landing — the agent has autonomy on the post-exit destination per the project state at the time of landing).
- **Role detection.** Initiator vs joiner derived from `room.creator_id == auth.uid()`. Solo detected via existing `SoloPath.shouldSkipWaiting`.

### Tests

- Unit test: Back tap on Q3 decrements to Q2 and restores the prior answer. Back on Q1 is unreachable (the affordance is not rendered).
- Unit test: Exit confirm fires the member-drop call exactly once; cancel does not fire it.
- Unit test: Initiator-exit on a non-solo room does NOT mark the room expired (others continue); initiator-exit on a solo room DOES.
- Snapshot tests for the chrome on Q1 (no Back) vs Q3 (Back rendered).
- Boundary assertion: post-confirm exit always lands the user on the same destination (Plan list / S00) — no flaky path that dead-ends.

### Out of scope

- Multi-member coordination of the exit (the remaining participants don't need to be notified beyond what the existing realtime layer already does).
- Plan list as the post-exit destination — until tb-WF-4 lands, exits punt to S00 Landing.
- Delete verb (sg-WF-4's responsibility).

## Acceptance criteria

- [ ] Q1 through Q5 in the iOS app render the `Back` (Q2–Q5) + `Exit`/`Leave` chrome per sg-WF-2.
- [ ] Back from Q3 → Q2 with the Q2 answer pre-selected and re-editable; no server call.
- [ ] Q1 does **not** render a Back affordance.
- [ ] Exit confirmation copy matches the spec (initiator / joiner / solo variants) verbatim.
- [ ] Exit confirm drops the user's `members` row; solo-exit also expires the room.
- [ ] Joiner Exit (a.k.a. `Leave`) does NOT mark the room expired.
- [ ] After Exit/Leave, the user lands on the Plan list (or S00 Landing if Plans aren't yet user-visible at the time of this issue landing).
- [ ] Unit tests cover the back-step, the exit-confirm fire-once, the initiator-vs-joiner room-expire branch, and the snapshot tests for chrome rendering.
- [ ] `ios` CI lane is green.

## Blocked by

- [[sg-wf-2-quiz-back-exit-chrome|sg-WF-2]] — the design-system spec must land first.

## Comments

- **2026-05-20** — AFK agent closed on `afk/tb-wf-2` (PR [#170](https://github.com/samfarls55/gettoit/pull/170)). Wired `QuizChromeView` above the C-02 TopBar (Back top-leading on Q2-Q5, Exit/Leave top-trailing on Q1-Q5), suppressed the TopBar's `×` (chrome owns the exit verb), added `QuizCoordinator.back()` (prior answers survive via existing `@Observable` state), and built `MemberLeaveStore` to fire the `members` DELETE-self + (solo initiator) `rooms.status = 'expired'` round-trip. Locked confirmation copy pinned by `QuizChromeCopyTests`. Post-exit destination is S00 Landing — `QuizChromePostExitDestination.current = .landing` until tb-WF-4 lands the visible Plan list surface; `QuizChromePostExitTests` catches a future flip. The issue spec said "RLS already permits self-delete," but `members` shipped with SELECT + INSERT policies only; added `members_delete_self` migration (`20260520000000000_members_self_delete.sql`) scoped to `user_id = auth.uid()`. iOS CI lane green; design-system gates green.
