---
surface: 05-verdict
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenVerdict.jsx
---

# S05 · Verdict (the hero)

> **Code:** [`../code/screens/ScreenVerdict.jsx`](../code/screens/ScreenVerdict.jsx)
> Three modes: `default` · `cuts` · `committed`.

The screen this whole product exists to deliver. One verdict, where + when + who, with the rule that produced it and the receipts that prove it came from the inputs.

## The five-second test

The **loser** is the rate-limiting reader. They must see, within 5 seconds:

1. The verdict (single option, no negotiation surface)
2. The rule that produced it (one short sentence)
3. Their voice was counted (per-member receipt)
4. A path to ratify (`I'm in`)
5. A correctability path (friction-bearing reroll)

All five land within the choreo's 1.4s reveal. If you add a 6th element, something has to leave.

## Choreographed reveal (canon)

The `VERDICT_CHOREO` constant at the top of the JSX encodes the explicit timing:

| Step | Delay | Element |
|---|---|---|
| 1 | 80ms | Eyebrow `"Tonight, the verdict is"` |
| 2 | 280ms | Hero (stacked place name) |
| 3 | 700ms | Meta line |
| 4 | 820ms | Time badge (pop) |
| 5 | 1020ms | Rule sentence |
| 6 | 1140ms + 80ms each | 4 voice receipts (stagger) |
| 7 | 1380ms | Primary CTA |

Total to interactive: ~1.88s. **Hero + time + rule all land before 1.1s** — that's the load-bearing budget.

## Modes

| Mode | Visible state |
|---|---|
| `default` | Cuts collapsed. CTA reads `"I'm in"`, white fill. Below CTA: `"Start over"`. |
| `cuts` | Cuts drawer expanded with 3 line-through rows + reasons. |
| `committed` | CTA flipped to `"You're in · 3 of 4"`, **sun fill** with ink check prefix. Below: `"Window closes in 47s"`. |

## What this surface defends against

- **Algorithm-as-decider drift.** Rule chip + receipts read in the first 2 seconds. The reader sees that *what they said* produced the verdict — not that the app decided.
- **Equity-celebration drift.** No confetti, no trophies, no "Pico's wins!" The hero is a statement, not a reward.
- **The loser feels excluded.** Receipts include the loser by name. Their voice is on screen as proof.
- **Re-litigation paralysis.** `"Start over"` is tertiary — visible but quiet. Reroll is one tier below and requires a reason.

## Copy register (load-bearing)

- **`"Tonight, the verdict is"`** — definite article. The verdict, not a recommendation.
- **Place name UPPERCASE stacked, one word per line.** Statement of finality.
- **Time-badge audience: `"ALL FOUR OF YOU"`** — communal frame. NOT "Reserved for 4" / "Party of 4".
- **Rule sentence is active voice and names what cut what.** `"Budget cap cut Ren Soba."` The rule is the agent — never the algorithm. NEVER `"We chose Pico's"` / `"The app picked"`.
- **Receipts use lowercase first names + private-anonymized verbs.** `"alex filtered shellfish"` not `"Alex has a shellfish allergy"`. Names are consented; conditions are not.
- **`"I'm in"`** — voluntary. NEVER `"Confirm"` / `"Accept"` / `"OK"`.
- **`"You're in · 3 of 4"`** — N-of-M, no percentage.

## Edge cases

- **Verdict matches a veto.** Shouldn't be possible (EBA culls first), but defensively the surface would show a `"Filter clash"` banner above the hero and offer reroll directly.
- **Tie at regret stage.** Rule sentence becomes `"Pico's and Ren Soba tied; Pico's was closer for {majority}."` Distance becomes the second-order tiebreaker.
- **Only 1 candidate survives.** Eyebrow shifts to `"Only one made it tonight"`. Cuts drawer auto-opens. Otherwise identical.
