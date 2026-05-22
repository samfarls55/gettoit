---
surface: 08-checkin
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenCheckin.jsx
---

# S08 · Next-Day Check-In

> **Code:** [`../code/screens/ScreenCheckin.jsx`](../code/screens/ScreenCheckin.jsx)

The surface that feeds the north-star metric (% of verdicts followed through on). Fires 12–24h after the verdict as a push notification — designed to be tappable in 2 seconds from a lock-screen tap.

## Three options (not yes/no)

- `We went` and `We skipped` are the two outcomes the metric needs.
- `I'd rather not say` exists because users at 6:43 PM the next day might not be ready to answer truthfully. Forcing a binary at that moment corrupts the metric — an honest opt-out is **cheaper than a wrong answer**.
- The opt-out is **terminal, not a snooze.** Tapping it commits the `snoozed` outcome and closes the check-in for that verdict — the verdict is left blank and metric-excluded; the user is not re-prompted. The copy must not promise a re-ask (see [[bug-16-checkin-snooze-terminal-row]] — the `check_ins` `(room_id, user_id)` primary key makes any first write one-way, so a deferral the system honored would need a re-prompt scheduler that does not exist).

## Why "We skipped" gets a reason follow-up

The metric is `% of verdicts followed through on`, but the **diagnostic signal** is *why people skipped*. `Wallet/time` and `Group bailed` are recoverable; `Mood shifted` and `Place was packed` are operational problems. The reason taxonomy maps to product improvement work.

The reason is **stored but not visible to the group.** Different from reroll — reroll is during-session and communal; check-in is post-hoc and individual.

## What this surface defends against

- **Survey-induced abandonment.** No multi-question form, no 1–5 rating, no comments field. One tap.
- **Coercion.** An opt-out (`I'd rather not say`) is first-class — the user can decline to answer without being forced into a binary. The verdict is then left blank, not deferred.
- **Algorithm framing.** Footer line names "metric" out loud and tells the user it matters. The system is being honest about what it's measuring.
- **Notification fatigue.** One check-in per verdict, then silence until the next session.

## Copy register

- **`"Did you go?"`** — present-tense, plural-pronoun-implied. Not "Did your group attend?" (formal) or "Outcome?" (transactional).
- **`"We went / We skipped"`** — first-person plural. The user is reporting on the group's behavior, not their own.
- **`"I'd rather not say"`** / **`"We'll leave it blank"`** — an honest decline, not a deferral. The register is deliberately closed-ended: no "later", no "ask me again". It commits the `snoozed` outcome and ends the check-in (see [[bug-16-checkin-snooze-terminal-row]]).
- **`"And it was great"` / `"Something came up"`** — implicature. Sub-copy guesses at the user's narrative and is right ~80% of the time, making the tap feel known.
- **`"Your follow-through is the only metric that matters."`** — telling the user the truth. Builds trust over sessions.
- **`"One tap, then we're gone for the day."`** — sets expectations. The check-in won't nag.

## Edge cases

- **User says "We went" but secretly didn't.** Out of scope for v1. The product trusts the user.
- **No response at all.** The no-signal sweeper marks a verdict with no `check_ins` row as "no signal" — does not count toward or against the metric. (A user who tapped `I'd rather not say` already has a `snoozed` row, so the sweeper skips them; both `snoozed` and `no_signal` are metric-excluded.)
- **User skipped because the verdict was bad.** Reason feeds the user's preference model — future sessions adjust EBA thresholds.
