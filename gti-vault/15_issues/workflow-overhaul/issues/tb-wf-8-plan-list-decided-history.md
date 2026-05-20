---
issue: tb-WF-8
title: iOS Plan list — Decided + History sections + lifecycle transitions
status: ready-for-agent
type: AFK
feature: workflow-overhaul
github_issue: 177
created: 2026-05-20
---

# tb-WF-8 — iOS Plan list: Decided + History lifecycle

## Parent

[[sg-wf-4-plan-list-surface|sg-WF-4]] — design-system spec for the Plan list surface. Locked decisions in [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]].

Builds on [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] and [[tb-wf-7-plan-list-joiner-resume|tb-WF-7]]. Adds the visible Plan lifecycle end-to-end — verdict-fires → Decided section appears → window closes → History section appears.

## What to build

End-to-end vertical slice that makes the **full lifecycle of a Plan visible on the list**, surfaces verdicts, and supports tapping into Decided/History rows for both Created and Joined cards.

**Journey demoed (initiator side):** User has a Pending Plan → runs the group quiz → verdict fires (auto-fire on quorum-complete OR manual close) → Plan visibly moves to the top of the Decided section, 2-line card with name + verdict place name → user taps the Decided card → lands on `VerdictScreen` with reroll affordance (initiator-only). The reroll window closes 23:59:59 next-calendar-day OR the 3rd burn is used OR the check-in completes → Plan visibly moves to the top of the History section → user taps History card → read-only Verdict.

**Journey demoed (joiner side):** A Joined Plan in any of those three states (decided-active / decided-expired) renders correctly in the right section with the JOINED chip from tb-WF-7. Tap routing per Q8 lights up automatically (router already shipped in tb-WF-7).

### iOS changes

- **Update:** `PlanListScreen.swift`:
  - Render Decided + History sections (previously stubbed to empty in tb-WF-5).
  - 2-line cards in both sections: name (primary) + verdict place name (secondary). Truncate verdict name with ellipsis on long Foursquare names.
  - History section is collapsible (iOS-native disclosure pattern). Default state: expanded on first viewing. Persist collapsed/expanded state per-user.
  - Section ordering per Q7: Decided `verdict_fired_at DESC`, History `expired_at DESC`. Tiebreaker `created_at DESC`.
  - Tap routing for Created cards: Decided → `VerdictScreen` (full, with reroll affordance), History → `VerdictScreen` read-only.
- **Update:** `PlansStore` — implement the Decided + History list queries (previously stubbed in tb-WF-5).

### Backend / lifecycle changes

- **Pending → Decided transition.** Verifies that when a verdict fires (existing `compute_verdict` / `fire_verdict` path), the linked Plan's `status` flips from `pending` to `decided-active` and `verdict_fired_at` is set. tb-WF-1 may already have wired this; this slice adds tests + any missing piece.
- **Decided → History transition.** A Plan transitions to `decided-expired` when **any** of:
  - The reroll window closes (23:59:59 local-TZ next calendar day after `verdict_fired_at`).
  - The 3rd reroll burn is used.
  - The check-in completes (S08).

  At least the window-close transition needs a server-side cron / scheduled function. Implement per the existing v1.1 cron infrastructure. Burn-exhausted and check-in-complete are event-driven and can fire from the existing reroll / check-in code paths.
- **Set `expired_at`** to the moment of transition for sorting purposes.

### Tests

- Snapshot tests for `PlanListScreen` with one Plan in each section (Pending / Decided / History) — full lifecycle visualization.
- Snapshot tests for History collapse: collapsed shows section header only; expanded shows rows.
- Unit tests for the Decided + History list queries: correct ordering, correct filtering by user (Created OR Joined).
- Unit tests for lifecycle transitions:
  - Verdict-fire → Plan moves Pending → Decided with `verdict_fired_at` set.
  - Window close cron → Plan moves Decided → History with `expired_at` set.
  - 3rd burn → Plan moves Decided → History.
  - Check-in complete → Plan moves Decided → History.
- E2E: full lifecycle observable on the list — create Plan, run quiz, see it appear in Decided, advance time / use burns / complete check-in, see it move to History.

### Out of scope

- **Three-dot menu + delete + leave.** tb-WF-9.
- **Push notifications** for "verdict ready" / "reroll window closing" — flagged on the parent doc as a separate decision-needed item.

## Acceptance criteria

- [ ] `PlanListScreen` renders Decided + History sections per the design-system spec; 2-line cards with name + verdict place name.
- [ ] History section is collapsible; expanded/collapsed state persists per user across launches within a session.
- [ ] Sections ordered correctly: Decided `verdict_fired_at DESC`, History `expired_at DESC`.
- [ ] Created tap routing: Decided → `VerdictScreen` (with reroll), History → `VerdictScreen` read-only.
- [ ] Joined tap routing for Decided / History lights up automatically (router from tb-WF-7).
- [ ] Verdict-fire transitions Plan from `pending` to `decided-active`; `verdict_fired_at` is set.
- [ ] Decided → History transition fires on whichever happens first: window close, 3rd burn, check-in complete. `expired_at` is set.
- [ ] Window-close transition is driven by a server-side scheduled function in the user's local-TZ semantic (23:59:59 next calendar day).
- [ ] iOS CI lane is green; `supabase-db` lane is green (for any migration); `supabase-functions` lane is green (for any cron / edge function).

## Blocked by

- [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] — foundation Plan list shell with stub Decided/History queries.
- [[tb-wf-7-plan-list-joiner-resume|tb-WF-7]] — Joined-card tap router. Required because Decided/History rows can be Joined cards too.
