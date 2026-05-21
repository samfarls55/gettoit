---
surface: 07-reroll
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenReroll.jsx
---

# S07 · Reroll Sheet

> **Code:** [`../code/screens/ScreenReroll.jsx`](../code/screens/ScreenReroll.jsx)

The system's friction surface. Capped at 3 per session, requires a stated reason that becomes a new constraint, and the reason is **visible to the group**.

## Why friction is the feature

> Reroll is meant to be costly so paralysis can't sneak back as a slot-machine.

If reroll were a free retry, the system would degenerate into "spin until someone gets what they want." The reason taxonomy + 3-per-session cap + group-visible accountability turn reroll into a **stated revision of the group's constraints**, not a re-roll of the dice.

## Reason taxonomy

| Id | Label | Becomes constraint |
|---|---|---|
| `cost` | Too pricey | Tightens budget cap by one tier |
| `dist` | Too far | Reduces walk range to ≤previous − 5min |
| `mood` | Mood shifted | Re-prompts vibe Q only |
| `diet` | Diet missed | Adds new EBA veto (prompts for which) |
| `avail` | Not open | Removes hours-open candidates from current set |

These are **mechanical** — the system actually applies them. The reason isn't decorative.

## What this surface defends against

- **Slot-machine reroll.** The 2-col grid + named reason + the "burns" verb all foreground that this is a constrained operation, not a retry.
- **Hidden costs.** `"2 LEFT"` stamp is prominent; `"burns 1 of 3"` is in the primary CTA label. The user can't reroll by accident.
- **Anonymous re-litigation.** The reason — *and the optional detail line* — feed the next rule chip. Other group members see why the night shifted.

## Copy register

- **`"What changed?"`** — assumes something material changed. NOT "Why are you rerolling?" (defensive) or "Reason" (formal).
- **`"Your reason becomes a new constraint. The group sees it."`** — discloses both the mechanical cost and the social cost up front.
- **`"Pick the one that's actually true."`** — gentle gatekeeping. Trusts the user; signals that lying corrupts the next verdict.
- **`"Reroll · burns 1 of 3"`** — the verb "burns" makes the cost vivid. NOT "Use a reroll" (sterile).
- **`"Cancel · keep Pico's"`** — the alternative is named, not a sterile "Cancel."

## Edge cases

- **3rd (last) reroll.** Stamp changes to `"1 LEFT"`. CTA: `"Reroll · last one"`. Extra body line: `"After this, tonight is committed."`
- **No rerolls left.** This surface is not reachable — surface 06's footer reads "No rerolls left" instead.
- **Group veto of reroll** (v2 mechanic). v1 ships with initiator-only reroll.

## Amendment — reroll window (workflow-overhaul, sg-WF-6)

> Additive. The S07 friction model above — the 3-burn cap, reason-as-constraint, initiator-only reroll — is unchanged. This section documents the **outer time bound** that sits around the burn budget once a Plan reaches its verdict.

When the workflow-overhaul promoted the session into a durable **Plan**, the reroll budget gained a companion: a **reroll window** with a wall-clock deadline. A verdict is correctable *for a bounded interval*, not indefinitely.

- **Outer time bound.** Independent of how many of the 3 burns remain, the reroll window **closes at the end of the next calendar day** — `23:59:59` on the day *after* the verdict fired, measured in the Plan's **search-area timezone** (not the device timezone). A verdict that fires Friday evening is rerollable through end of Saturday, search-area time; come Sunday the window is closed even if no burn was ever spent.
- **Three-way close.** A Plan leaves the reroll-eligible state on whichever of three events lands first:
  1. **Window closes** — the calendar-day deadline above passes.
  2. **3rd burn** — the reroll budget is exhausted (the existing cap).
  3. **Check-in** — any member files a check-in of any outcome (the meal happened; a reroll is moot).
- **Verdict-screen affordance once the window has closed.** A Plan whose window has closed is `decided-expired`; tapping it from the S00 Plan list opens the **read-only verdict screen**, which renders **no reroll tertiary at all** — the affordance is absent, not disabled. This is distinct from the cap-exhausted edge case already documented above (*No rerolls left*): cap-exhaustion is a still-`decided-active` Plan whose surface 06 footer reads `"No rerolls left"`; a closed window is a terminal `decided-expired` Plan that never surfaces the reroll path. The two reach the user through different screens.

The enforcement is server-authoritative and time-exact: a reroll attempted past the deadline is rejected by the backend even if a stale client still shows the affordance. The decision record is [ADR 0016](../../gti-vault/60_engineering/adr/0016-plan-reroll-window-enforcement.md); the deadline and three-way-close mechanics are not a design-system concern beyond the affordance-presence rule stated here.
