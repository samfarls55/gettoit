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
