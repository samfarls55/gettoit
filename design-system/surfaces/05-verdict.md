---
surface: 05-verdict
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenVerdict.jsx
---

# S05 · Verdict (the hero)

> **Code:** [`../code/screens/ScreenVerdict.jsx`](../code/screens/ScreenVerdict.jsx)
> Five modes: `default` · `cuts` · `committed` · `read-only` · `no-survivor`.

The screen this whole product exists to deliver. One verdict, where + when + who, with the rule that produced it and the receipts that prove it came from the inputs.

## The five-second test

The **loser** is the rate-limiting reader. They must see, within 5 seconds:

1. The verdict (single option, no negotiation surface)
2. The rule that produced it (one short sentence)
3. Their voice was counted (per-member receipt)
4. A path to ratify (`I'm in`)
5. A correctability path (friction-bearing reroll)

All five land within the choreo's 1.4s reveal. If you add a 6th element, something has to leave.

The test applies in full to `default`, `cuts`, `committed`. It applies in **limited form** to `read-only` (steps 1–3 only — there is no ratification or reroll path for a late-joiner). It does **not apply** to `no-survivor` — there is no verdict to ratify; the rule chip becomes the load-bearing message.

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

In `read-only` mode the sequence is the same except the CTA fade-up at 1380ms lands on the re-invite CTA (`"Start a new decision"`) instead of `"I'm in"`. In `no-survivor` mode the reveal compresses — there's no time badge or receipts to choreograph, so the elements collapse to: eyebrow (80ms) → hero (280ms) → meta line (700ms) → rule chip (1020ms) → CTA (1380ms). See `motion.md`.

## Modes

| Mode | Visible state |
|---|---|
| `default` | Cuts collapsed. CTA reads `"I'm in"`, white fill. Below CTA: `"Start over"`. |
| `cuts` | Cuts drawer expanded with 3 line-through rows + reasons. |
| `committed` | CTA flipped to `"You're in · 3 of 4"`, **sun fill** with ink check prefix. Below: `"Window closes in 47s"`. |
| `read-only` | Late-joiner mode. Eyebrow `"Tonight's verdict"` (past-tense-implicit). Hero + meta + time badge + rule chip + voice receipts (late-joiner not in receipts — they didn't contribute). Suppressed: ratification CTA, reroll affordance, `"Start over"` secondary. Primary CTA is `"Start a new decision"` (white pill). Cuts drawer remains available (informational, not actionable). |
| `no-survivor` | Terminal — engine exited with no candidates after soft-pref relax. Eyebrow `"Tonight"`. Hero `"NO SPOT / FITS"` (one word per line). Meta line names the hard-need vetoes that survived (`"Vegan options · $$ cap · 15 min walk"`). No time badge. Rule chip is the load-bearing message in aggregate-rule register. Suppressed: voice receipts, ratification CTA, reroll, `"Start over"` (secondary). Primary CTA `"Widen radius"` (sun-fill); secondary ghost `"Start over"`. |

## What this surface defends against

- **Algorithm-as-decider drift.** Rule chip + receipts read in the first 2 seconds. The reader sees that *what they said* produced the verdict — not that the app decided.
- **Equity-celebration drift.** No confetti, no trophies, no "Pico's wins!" The hero is a statement, not a reward.
- **The loser feels excluded.** Receipts include the loser by name. Their voice is on screen as proof.
- **Re-litigation paralysis.** `"Start over"` is tertiary — visible but quiet. Reroll is one tier below and requires a reason.
- **Retroactive influence by late-joiners.** Read-only mode honestly shows the verdict was sealed before they arrived. No receipt chip for them (would imply they contributed). No ratification (would imply their tap matters to the outcome).
- **Member-blaming on no-survivor.** The no-survivor rule chip uses aggregate-rule attribution. Never names the member whose hard need exhausted the candidate pool.

## Copy register (load-bearing)

- **`"Tonight, the verdict is"`** — definite article. The verdict, not a recommendation.
- **`"Tonight's verdict"`** (read-only) — past-tense-implicit. The late-joiner sees the decision already happened.
- **`"Tonight"`** (no-survivor) — bare, no verb. There's no verdict; the eyebrow shouldn't promise one.
- **Place name UPPERCASE stacked, one word per line.** Statement of finality.
- **`"NO SPOT / FITS"`** (no-survivor) — same one-word-per-line treatment. The hero is the absence; the rule chip carries the why.
- **Time-badge audience: `"ALL FOUR OF YOU"`** — communal frame. NOT "Reserved for 4" / "Party of 4". Suppressed in `no-survivor` and unchanged in `read-only`.
- **Rule sentence is active voice and names what cut what.** `"Budget cap cut Ren Soba."` The rule is the agent — never the algorithm. NEVER `"We chose Pico's"` / `"The app picked"`.
- **No-survivor rule chip** uses aggregate attribution for shared constraints and attribute-attribution for private ones:
  - **Good:** `"Vegan options left no candidates within walking distance tonight."`
  - **Good:** `"Shellfish-safe kitchens are sparse within 2 miles tonight."`
  - **Bad:** `"Maya's vegan veto left no places."` (names the who)
  - **Bad:** `"Filtered for shellfish allergy left no places."` (exposes a private constraint)
- **Receipts use lowercase first names + private-anonymized verbs.** `"alex filtered shellfish"` not `"Alex has a shellfish allergy"`. Names are consented; conditions are not.
- **`"I'm in"`** — voluntary. NEVER `"Confirm"` / `"Accept"` / `"OK"`.
- **`"You're in · 3 of 4"`** — N-of-M, no percentage.
- **`"Start a new decision"`** (read-only) — voluntary, framed as a new round (not "re-do" or "join late"). The late-joiner becomes the initiator of the next session.
- **`"Widen radius"`** (no-survivor) — verb-first, action-shaped. NOT `"Try again"` (implies user error).
- **Pre-permission line** (`default` / `cuts` / `committed`) — `"We'll check in tomorrow — see if you went."` Voluntary warm-friend register. NEVER paraphrased to `"Enable notifications"`, `"Allow alerts"`, `"Turn on push"` or any system-register phrasing. The line surfaces under the CTA dock; the user's first `"I'm in"` tap fires the native iOS push permission prompt once per session (PRD user story 38–40). Suppressed in `read-only` (no ratification path) and `no-survivor` (no verdict to check in on).

## Mode-specific behavior

### `read-only`

- Triggered when a user taps the invite link **after** `rooms.verdict_committed_at` is non-null.
- Voice-receipt row shows only members who answered before commit. The late-joiner's chip does not appear.
- Primary CTA `"Start a new decision"` returns the user to S01 as the new initiator. Defaults are pre-populated from the prior room's `timer_minutes` + `radius_meters` (saves a tap; they're likely planning a similar outing).
- Cuts drawer is available (informational). The "See what got cut →" trigger remains; reading the elimination chain is part of understanding what they missed.
- VO order: eyebrow → hero → meta → time badge → rule chip → receipts (in order) → cuts trigger → re-invite CTA. Ratification path is announced as "Not available — this verdict is closed."

### `no-survivor`

- Triggered when VerdictEngine exits with `method = 'no_survivor'` after exhausting soft-pref relax (cuisine veto → vibe floor → radius widen).
- `"Widen radius"` is an inline expansion (not a separate sheet). Tapping the CTA reveals a C-21 range slider with range `1–10 mi`, suggested value = `current + 1.0 mi`, step `0.5`. Commit re-runs the engine; if the second run also fails, the surface re-renders with the new radius surfaced in the meta line.
- The `"Widen radius"` re-run does **not** consume a reroll budget — the engine failed, not the group.
- Secondary ghost `"Start over"` returns to S01 with prior `timer_minutes` + `radius_meters` retained.
- Voice-receipt row is suppressed — there's no verdict to receipt, and showing answers without a verdict reads as exposure.
- No telemetry hint copy in v1 (`"This is rare — most groups find a spot at 2 mi."`). Revisit if the no-survivor rate proves high in beta.
- VO order: eyebrow → hero (`"No spot fits"`) → meta (surviving hard-needs) → rule chip → primary CTA. The rule chip carries the load-bearing message and must be in the first read order.

## Edge cases

- **Verdict matches a veto.** Shouldn't be possible (EBA culls first), but defensively the surface would show a `"Filter clash"` banner above the hero and offer reroll directly.
- **Tie at regret stage.** Rule sentence becomes `"Pico's and Ren Soba tied; Pico's was closer for {majority}."` Distance becomes the second-order tiebreaker.
- **Only 1 candidate survives.** Eyebrow shifts to `"Only one made it tonight"`. Cuts drawer auto-opens. Otherwise identical to `default`.
- **`no-survivor` after widen.** If the user widens the radius and the engine still returns no survivors, the surface re-renders in `no-survivor` mode with the updated meta line. The slider is available again with a fresh `+1.0 mi` suggestion. There's no hard ceiling on widens, but each one re-shows the rule chip — friction by repetition.
- **Late-joiner during widen-loop.** If a member who is not the room's initiator opens the room while the initiator is on `no-survivor`, they see the same `no-survivor` mode but without the `"Widen radius"` CTA (initiator-only action). They see `"Start over"` only.
