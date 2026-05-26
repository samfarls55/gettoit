---
surface: 05-verdict
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenVerdict.jsx
---

# S05 · Verdict (the hero)

> **Code:** [`../code/screens/ScreenVerdict.jsx`](../code/screens/ScreenVerdict.jsx)
> Three live flavors: `default` · `committed` · `solo`.
> Closed verdicts (`read-only`) live on [`05a-verdict-read-only.md`](./05a-verdict-read-only.md).
> No-survivor terminals (`no-survivor`) live on [`05b-no-survivor.md`](./05b-no-survivor.md).

The screen this whole product exists to deliver. One verdict, where + when + who, with the rule that produced it and the receipts that prove it came from the inputs.

This doc covers the **live verdict surface** — the post-quiz surface a member arrives at while the Plan is in `decided-active` state. The closed-verdict view (post-`decided-expired`, or a Web invitee deep-linking into someone else's sealed Plan) lives on `05a-verdict-read-only.md`. The widen-and-retry terminal (engine returns no survivors) lives on `05b-no-survivor.md`. Per [[gti-vault/60_engineering/adr/0018-verdict-surface-three-way-split|ADR 0018]] (accepted 2026-05-26), the three intents are distinct surfaces because they collapse onto distinct one-intent screens; this doc only covers the live verdict.

## Verdict chrome (Home)

Every live-verdict flavor carries a single text-label `Home` affordance above the eyebrow, mirroring the `Back` slot in the quiz `QuizChrome` (`surfaces/03-quiz.md` §"Quiz chrome (Back + Exit)"). The top-trailing slot is intentionally empty — S05 has no `Exit` counterpart because the verdict is not exitable; the Plan persists by design (per `CONTEXT.md` → *Plan / Room lifecycle*).

### Per-flavor render rules

| Flavor | Chrome verb | Tap |
|---|---|---|
| `default` | `Home` | Pops to S00 Plan list (`onHome`) |
| `committed` | `Home` | Pops to S00 Plan list (`onHome`) |
| `solo` | `Home` | Pops to S00 Plan list (`onHome`) |

### Placement + treatment

| Element | Spec |
|---|---|
| Position | Top of the surface, above the eyebrow |
| `Home` | Top-leading |
| Top-trailing | Empty — no `Exit` counterpart on the verdict (the verdict is not exitable) |
| Type | Existing `eyebrow` token treatment — Inter 700 / 11 / tracking 0.18em / UPPERCASE |
| Color | white 0.78 |
| Icons | **None** — pure text label. Matches the `QuizChrome` text-only idiom |
| Tap target | 44pt minimum (per HIG); the hit row is taller than the visible glyph via padding |
| Visual weight | Low — the chrome must not compete with the choreographed verdict reveal below |

### Behavior

- **`Home`** (every live flavor). Tap **pops to S00 Plan list**. Pure navigation — no confirm alert, no session teardown, no membership mutation. The room is already closed at verdict (per `CONTEXT.md` → *Plan / Room lifecycle*), so there is nothing to tear down. The verdicted Plan stays on the user's list in the **Decided** section in `decided-active` state — tapping it from the Plan list returns the user to this same verdict surface.
- **No correctability impact.** The verb does not consume a reroll budget and is not a re-decide path. The reroll path (with its 3-burn cap, stated-reason friction, and initiator-only gate per S07) remains the only way to re-decide a Plan after the verdict.

### What this affordance replaces

Pre-bug-22 the verdict carried a `Start over` tertiary CTA under the primary on every mode. The verb implied a flow-restart that tore down the Plan, but the in-flight Plan is not destroyed — it's persisted, decided, and lives on the Plan list. The verb was renamed (`Home`), repositioned (chrome row, not the CTA dock), and reframed as pure navigation. The retired affordance is removed from every flavor; it is never duplicated in the dock.

## The five-second test

The **loser** is the rate-limiting reader. They must see, within 5 seconds:

1. The verdict (single option, no negotiation surface)
2. The rule that produced it (one short sentence)
3. Their voice was counted (per-member receipt)
4. A path to ratify (`I'm in`)
5. A correctability path (friction-bearing reroll)

All five land within the choreo's 1.4s reveal. If you add a 6th element, something has to leave.

The test applies in full to `default` and `committed`. In `solo` the test collapses to steps 1, 2, 4, 5 — there's a single voice, so step 3 ("their voice was counted") is implicit and the voice-receipt row is suppressed; the rule chip + I'm in + reroll still land within the same 1.4s reveal.

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

See [`05a-verdict-read-only.md`](./05a-verdict-read-only.md) §"Choreographed reveal" for the read-only variant (identical timing, the CTA fade-up lands on the re-invite CTA) and [`05b-no-survivor.md`](./05b-no-survivor.md) §"Compressed reveal" for the no-survivor compression (no time-badge or receipts beats).

## Flavors

| Flavor | Visible state |
|---|---|
| `default` | Home chrome row above the eyebrow. CTA reads `"I'm in"`, white fill. CTA dock secondary slot empty pre-commit. |
| `committed` | Home chrome row above the eyebrow. CTA flipped to `"You're in · 3 of 4"`, **sun fill** with ink check prefix. Below: `"Window closes in 47s"` (status, not a verb). |
| `solo` | Single-member room. Triggered when `members.length === 1` AND the initiator did not share an invite (the share sheet never opened). Home chrome row above the eyebrow. Eyebrow `"Tonight, the verdict is"` (same definite article as `default` — the singular voice still produced a verdict). Hero + meta + time badge + rule chip + `I'm in` CTA + reroll tertiary all present. **Suppressed:** voice-receipt row (one voice doesn't need to be receipted back to itself). **Replaced:** the `default` mode's save-group affordance is replaced with the **save-taste-profile** affordance (the C-22 Auth Upgrade Chip from TB-12, copy `"Save this taste profile"`). The chip surfaces under the primary CTA in `default-idle` state for anonymous users; suppressed for already-linked users. Time badge renders the timestamp only — no audience subtitle. The communal frame self-cancels with `N = 1`; the solo voter already knows it's them. |

## What this surface defends against

- **Algorithm-as-decider drift.** Rule chip + receipts read in the first 2 seconds. The reader sees that *what they said* produced the verdict — not that the app decided.
- **Equity-celebration drift.** No confetti, no trophies, no "Pico's wins!" The hero is a statement, not a reward.
- **The loser feels excluded.** Receipts include the loser by name. Their voice is on screen as proof.
- **Re-litigation paralysis.** The `Home` chrome verb is pure navigation — it returns the user to the Plan list, it does **not** re-decide the Plan. The only re-decide path is reroll, which carries its own friction (3-burn cap, stated-reason requirement, initiator-only) per S07.

## Copy register (load-bearing)

- **`"Tonight, the verdict is"`** — definite article. The verdict, not a recommendation.
- **Place name UPPERCASE stacked, one word per line.** Statement of finality.
- **Time-badge audience: `"ALL FOUR OF YOU"`** — communal frame. NOT "Reserved for 4" / "Party of 4". In `solo` the audience subtitle is **omitted** — the badge renders the timestamp alone. The communal frame self-cancels with `N = 1`, and `"YOU"` would only restate what the solo voter already knows.
- **Rule sentence is active voice and names what cut what.** `"Budget cap cut Ren Soba."` The rule is the agent — never the algorithm. NEVER `"We chose Pico's"` / `"The app picked"`.
- **Receipts use lowercase first names + private-anonymized verbs.** `"alex filtered shellfish"` not `"Alex has a shellfish allergy"`. Names are consented; conditions are not.
- **`"I'm in"`** — voluntary. NEVER `"Confirm"` / `"Accept"` / `"OK"`.
- **`"You're in · 3 of 4"`** — N-of-M, no percentage.
- **Pre-permission line** (`default` / `committed`) — `"We'll check in tomorrow — see if you went."` Voluntary warm-friend register. NEVER paraphrased to `"Enable notifications"`, `"Allow alerts"`, `"Turn on push"` or any system-register phrasing. The line surfaces under the CTA dock; the user's first `"I'm in"` tap fires the native iOS push permission prompt once per session (PRD user story 38–40).

## Flavor-specific behavior

### `solo`

- Carries the Home chrome row above the eyebrow — same idiom as the group `default` flavor. Tap pops to S00 Plan list with the just-decided Plan visible in the **Decided** section.
- Triggered when `members.length === 1` AND the initiator did NOT share an invite link (the iOS share sheet never opened). The flow skips S04 Waiting entirely — there's no quorum to wait on — and jumps directly to verdict computation followed by S05 in this variant.
- The engine runs identically. With a single `votes` row the EBA pruning chain still produces a survivor set (the singular voice is itself the room-aggregate min budget / min walk / max vibe). The regret tiebreaker still picks the maximum across survivors. `rule_text` follows the same generator — it names the rules that produced the verdict ("Budget cap cut Ren Soba.") without any "N of M wanted X" counts. The rule_text generator has no member-count branch, so this is guaranteed by construction; verified by the engine fixture test.
- Voice-receipt row is suppressed. Receipting a single voice back to itself reads as exposure (your one chip on screen, alone) and doesn't earn its place in the 1.4s reveal. The receipt-row step (1140ms) collapses; everything after lands at the same canonical delays.
- Time badge renders the timestamp only. The audience subtitle is suppressed in solo — the communal `"All N of you"` frame doesn't apply to a single voice, and replacing it with `"You"` would only restate what the solo voter already knows.
- `I'm in` CTA remains. The voice is voluntary in the same way — the user can still decline their own verdict and reroll. The 30s correctability window applies the same way; `"You're in"` reads without the N-of-M denominator when the user commits (no quorum to count to).
- **Save-taste-profile affordance** replaces the `default` mode's save-group secondary. The C-22 Auth Upgrade Chip (TB-12) is the load-bearing affordance — its `"Save this taste profile"` copy was already designed for this moment. Surfaces under the primary CTA in `default-idle` state for anonymous users; suppressed (`hidden`) for users who already linked Apple. Solo mode is the highest-conversion moment for sign-in (the user just demonstrated effort solo — they have a taste profile worth saving and no group context to default into).
- Reroll tertiary remains. A solo user can still discover their first verdict didn't fit (TB-10's cost / dist / mood / diet / avail taxonomy applies the same way).
- The chrome-row `Home` verb is the only path back to the Plan list. A solo user who wants to start a fresh Plan does so by tapping Home → S00 Plan list → FAB.

## Edge cases

- **Verdict matches a veto.** Shouldn't be possible (EBA culls first), but defensively the surface would show a `"Filter clash"` banner above the hero and offer reroll directly.
- **Tie at regret stage.** Rule sentence becomes `"Pico's and Ren Soba tied; Pico's was closer for {majority}."` Distance becomes the second-order tiebreaker.
- **Only 1 candidate survives.** Eyebrow shifts to `"Only one made it tonight"`. Otherwise identical to `default`.
