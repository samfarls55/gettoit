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
- `Ask me later` exists because users at 6:43 PM the next day might not be ready to answer truthfully. Forcing a binary at that moment corrupts the metric. Snooze is **cheaper than a wrong answer**.

## Why "We skipped" gets a reason follow-up

The metric is `% of verdicts followed through on`, but the **diagnostic signal** is *why people skipped*. `Wallet/time` and `Group bailed` are recoverable; `Mood shifted` and `Place was packed` are operational problems. The reason taxonomy maps to product improvement work.

The reason is **stored but not visible to the group.** Different from reroll — reroll is during-session and communal; check-in is post-hoc and individual.

## What this surface defends against

- **Survey-induced abandonment.** No multi-question form, no 1–5 rating, no comments field. One tap.
- **Coercion.** Snooze is first-class. No "skip" button that hides the question — the user explicitly chooses to defer.
- **Algorithm framing.** Footer line names "metric" out loud and tells the user it matters. The system is being honest about what it's measuring.
- **Notification fatigue.** One check-in per verdict, then silence until the next session.

## Copy register

- **`"Did you go?"`** — present-tense, plural-pronoun-implied. Not "Did your group attend?" (formal) or "Outcome?" (transactional).
- **`"We went / We skipped"`** — first-person plural. The user is reporting on the group's behavior, not their own.
- **`"And it was great"` / `"Something came up"`** — implicature. Sub-copy guesses at the user's narrative and is right ~80% of the time, making the tap feel known.
- **`"Your follow-through is the only metric that matters."`** — telling the user the truth. Builds trust over sessions.
- **`"One tap, then we're gone for the day."`** — sets expectations. The check-in won't nag.

## Edge cases

- **User says "We went" but secretly didn't.** Out of scope for v1. The product trusts the user.
- **3+ days no response.** Auto-snooze; mark verdict as "no signal" — does not count toward or against the metric.
- **User skipped because the verdict was bad.** Reason feeds the user's preference model — future sessions adjust EBA thresholds.
