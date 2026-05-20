---

issue: sg-WF-6
title: Reroll window deadline mechanism — needs minor grill
status: needs-triage
type: HITL
feature: workflow-overhaul
github_issue: 159
created: 2026-05-19
---

# sg-WF-6 — Reroll window deadline mechanism

## Parent

[[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] §Q9 — the Plan reroll window. The *what* is locked: the window closes at `23:59:59` in the user's local timezone on the calendar day *after* the verdict fires; the v1 friction model (max 3 burns, reason-as-constraint, initiator-only — see `design-system/surfaces/07-reroll.md`) is preserved intact; the time window is an *outer* bound that closes the Plan to `decided-expired` if not already closed by the third burn or by check-in.

What is **not** yet decided (this issue grills it before promotion):

- **Server-side enforcement mechanism.** Postgres trigger watching `plans.reroll_window_closes_at`? Cron job sweeping `plans WHERE status = 'decided-active' AND reroll_window_closes_at < now()`? Edge function invoked on Plan state transitions? Reuse of the existing `app_config` / `dispatch_compute_verdict` infrastructure?
- **Client-side reflection.** Does iOS subscribe to the state transition via Realtime, or does it poll on app foreground? When the user has the verdict screen open and the window closes, does the screen need to live-update from `decided-active` to `decided-expired` (hiding the reroll affordance), or is a stale view acceptable until next app open?
- **Timezone handling.** The `plans.reroll_window_closes_at` column is canonically defined in the user's local TZ at the time of verdict-fire. Stored as `timestamptz` (UTC) computed at write-time? Or stored as a date + the TZ name? Server-side: how does the trigger / cron know whether the window has closed for a user whose device TZ has changed since the verdict?
- **Interaction with S07's existing 3-burn cap.** S07's `Edge cases` section says "After this, tonight is committed" on the 3rd reroll. Confirm: a Plan whose 3-burn budget is exhausted *also* immediately transitions to `decided-expired`, even if the window is still open? Or does the 3-burn ceiling only freeze further reroll attempts, with `decided-active` only ending on window close?
- **Check-in interaction.** [[../../../design-system/surfaces/08-checkin.md|S08 Check-in]] fires 12-24h after the verdict. If the user completes check-in while the window is still open, does the Plan transition early to `decided-expired`? The decisions doc says yes (`whichever happens first — window close, third burn used, or check-in completed`); confirm and lock the trigger.

## Acceptance criteria (after grill)

- [ ] A grill session resolves the open items above and updates [[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] (or a sibling decision doc) with the locked enforcement mechanism + client-side reflection rule.
- [ ] This issue is re-triaged to `ready-for-agent` / `AFK` once the grill outcomes are inlined.
- [ ] After re-triage: `design-system/surfaces/07-reroll.md` carries an additive amendment section documenting the outer time bound and the three-way close trigger (window / burns / check-in).
- [ ] Server-side enforcement (trigger / cron / edge-fn) is documented in `gti-vault/60_engineering/` or alongside the Plan lifecycle ADR if one is filed.
- [ ] Schema change for `plans.reroll_window_closes_at` is captured in the tracer-bullet that lands the Plans table (`tb-WF-1` or its successor).
- [ ] `verify.mjs` is green if any design-system files were touched.

## Blocked by

None to start the grill. A follow-up `/grill-with-docs` session is the prerequisite to AFK promotion.
