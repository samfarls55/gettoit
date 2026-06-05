---
issue: tb-WF-7
title: iOS Plan list â€” Joiner journey (JOINED chip + resume-from-state)
status: done
type: AFK
feature: 0.1.0
github_issue: 176
created: 2026-05-20
closed: 2026-05-20
pr: 184
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-WF-7 â€” iOS Plan list: Joiner journey

## Parent


Builds on [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]]. Adds the joiner-side journey end-to-end.

## What to build

End-to-end vertical slice that enables an Account-member joiner to see Plans they've joined on their list, identify them at a glance, and tap to resume wherever they are in the flow.

**Journey demoed:** User A creates a Group Plan on iOS and drops the invite link. User B (also an Account member with iOS) opens the link â†’ joins â†’ starts the quiz â†’ backgrounds the app at Q3 â†’ re-opens the app some time later â†’ lands on their Plan list â†’ sees the joined Plan rendered with a `JOINED` eyebrow chip â†’ taps it â†’ resumes the quiz at Q3 (their last-answered question, NOT Q1). Across other joiner states: tapping a Joined card whose Plan is now decided-active routes to read-only Verdict (joiner can't reroll â€” initiator-only per parent Q9); tapping a decided-expired Joined card routes to read-only History.

### iOS changes

- **Update:** `PlanListScreen.swift` â€” render the `JOINED` eyebrow chip top-leading on every Joined card. Use existing C-11 Eyebrow typography (Inter 700 / 11 / tracking 0.18em UPPERCASE). Color: `var(--sun)` per CSS token â†’ iOS `Color(gtiSun)` mapping. Created cards continue to render no chip.
- **Add:** Joined-card tap router. Routing table per Q8:

  | Joiner state | Destination |
  |---|---|
  | Pending, joiner hasn't opened quiz | `QuizScreen` starting at Q1 |
  | Pending, mid-quiz | `QuizScreen` at last-answered question |
  | Pending, joiner finished quiz | `WaitingScreen` |
  | Decided-active | `VerdictScreen` read-only (no reroll) |
  | Decided-expired | `VerdictScreen` read-only history |

- **Update:** `RootView.swift` â€” extend the post-tap routing logic to dispatch Joined-card taps through the resume-from-state table above.

### Backend / data changes

- **Add:** `PlansStore` extension method to query Joined Plans (Plans where the user is a non-owner room member). Returns Plans with per-joiner quiz progress in one batched read â€” list-render must not require an N+1 lookup per card.
- **Add (or expose if already present):** per-joiner quiz progress field. The 0.1.0 quiz state machine already persists answers per member; this slice exposes the `last_answered_question` (or equivalent) on the list query result. If the schema already supports it via the existing `votes` / `quiz_state` tables, just surface it through the store. If not, add the minimal field needed.

### Edge cases to handle

- **Exited joiner.** Per [[../../../CONTEXT|CONTEXT.md]] â†’ `Plan exit`, an Exit drops the joiner from the room. The Plan should not appear on their Joined list. Filter accordingly in the list query.
- **Plan deleted mid-quiz by initiator.** Per `Plan delete`, joiners get a "session ended" toast and are punted. The Plan disappears from their list on next render. This slice does NOT need to wire the realtime push; it just needs to ensure the list query filters dead rooms.
- **Decided-active Plan where joiner never voted.** Verdict still fired (initiator manually closed voting per 0.1.0 PRD). Tap routes to read-only Verdict â€” joiner sees the verdict without their vote being counted.

### Tests

- Snapshot tests for Pending Joined card (with JOINED chip) vs Pending Created card (no chip).
- Unit tests for the per-joiner quiz progress query: returns correct `last_answered_question` per (plan, joiner) pair, batched.
- Interaction tests for the resume router: each of the 5 states routes to the correct destination.
- E2E: User B joins a Plan via deep link, starts quiz, backgrounds at Q3, reopens app, sees JOINED chip, taps, lands on QuizScreen at Q3 with their previous answers preserved.

### Out of scope

- **Decided + History sections rendering / state transitions.** Joined cards for decided Plans are routable per the table above, but those cards only exist *if* tb-WF-8 has shipped the Decided/History sections. Until tb-WF-8 ships, this slice's "Decided-active / Decided-expired" rows simply don't render (sections are empty). The router code path lands now and lights up automatically when tb-WF-8 ships.
- **Three-dot menu with `Leave plan` action.** tb-WF-9.

## Acceptance criteria

- [ ] Joined cards render the `JOINED` eyebrow chip in `var(--sun)`, top-leading above the name. Created cards do not render a chip.
- [ ] `PlansStore` exposes a Joined-Plans query with per-joiner quiz progress in a single batched read.
- [ ] Joined-card tap router dispatches to the correct destination for each of the 5 states in the table above.
- [ ] Per-joiner quiz progress is preserved: resuming mid-quiz lands the joiner on their last-answered question with prior answers intact.
- [ ] Exited joiners do not see their exited Plans on the list.
- [ ] iOS CI lane is green.

## Blocked by

- [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] â€” foundation Plan list shell. Provides `PlanListScreen` to add the chip + router to.

## Comments

**2026-05-20 â€” merged (PR #184).** All six acceptance criteria green:

1. JOINED chip renders in `GTIColor.sun` top-leading on every Joined card (Created cards still render no chip).
2. `PlansStore.joinedPlansForList(userID:)` ships as a single-RPC batched read returning per-joiner `last_answered_question_index` + `has_voted` inline.
3. `PlanListScreen.routeFor(joinedRow:)` pure helper dispatches all 5 Â§Q8 states via the new `JoinedTapDestination` enum; `RootView.handleJoinedTap` consumes it and mounts the right surface.
4. Per-joiner quiz progress is preserved end-to-end: `QuizCoordinator(initialProgress:)` hydrates step + Q1..Q4 answers; `advance()` fires the optional `MemberProgressWriter` after every Q1..Q4 -> next-Q step. The wire shape (`{ last_index, answers: { q1, q2, q3, q4 } }`) lives on `members.quiz_progress`, persisted via the `members_progress_upsert` RPC.
5. Exited joiners are excluded server-side: the `joined_plans_for_user` RPC joins through `members` whose `user_id = auth.uid()` â€” no membership row â†’ no row in the result set.
6. iOS CI lane green in 2m52s.

Step indexing is 1-based â€” `last_index = N` means "the joiner is currently on QN" (not "answered up to QN, next is Q(N+1)"). That matches the surface Â§Q8 wording "resumes the quiz at Q3 (their last-answered question, NOT Q1)."

Known limitations (documented in PR Decisions):
- Resume into Q5 lands the user on Q5 but the Q5 candidate set is empty until the next Q4 -> Q5 advance â€” the resumed coordinator uses the legacy `candidates:` init without a `candidateFetch`. A follow-up could thread the assembler into the resume host.
