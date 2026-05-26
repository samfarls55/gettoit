---
surface: 05-verdict
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenVerdict.jsx
---

# S05 · Verdict (the hero)

> **Code:** [`../code/screens/ScreenVerdict.jsx`](../code/screens/ScreenVerdict.jsx)
> Five modes: `default` · `committed` · `read-only` · `no-survivor` · `solo`.

The screen this whole product exists to deliver. One verdict, where + when + who, with the rule that produced it and the receipts that prove it came from the inputs.

## Verdict chrome (Home / Done)

Every iOS-reachable verdict mode carries a single text-label affordance above the eyebrow, mirroring the `Back` slot in the quiz `QuizChrome` (`surfaces/03-quiz.md` §"Quiz chrome (Back + Exit)"). The top-trailing slot is intentionally empty — S05 has no `Exit` counterpart because the verdict is not exitable; the Plan persists by design (per `CONTEXT.md` → *Plan / Room lifecycle*).

### Per-mode render rules

| Mode | Chrome verb | Tap |
|---|---|---|
| `default` | `Home` | Pops to S00 Plan list (`onHome`) |
| `committed` | `Home` | Pops to S00 Plan list (`onHome`) |
| `solo` | `Home` | Pops to S00 Plan list (`onHome`) |
| `no-survivor` | `Home` | Pops to S00 Plan list (`onHome`) |
| `read-only` | `Done` | Fires Solo Setup re-invite (`onAdvance`) — the late-joiner has no Plan-list destination for someone else's Plan, so the chrome cannot honestly read `Home`. `Done` frames the chrome as "close this read-only snapshot"; tap lands the late-joiner on Solo Setup as initiator of their own next session (wfr-16) |

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

- **`Home`** (group modes — `default` / `committed` / `solo` / `no-survivor`). Tap **pops to S00 Plan list**. Pure navigation — no confirm alert, no session teardown, no membership mutation. The room is already closed at verdict (per `CONTEXT.md` → *Plan / Room lifecycle*), so there is nothing to tear down. The verdicted Plan stays on the user's list in the **Decided** section in `decided-active` state — tapping it from the Plan list returns the user to this same verdict surface.
- **`Done`** (`.readOnly` only). Tap fires `onAdvance` — the same Solo Setup re-invite path the primary `Start a new decision` CTA uses. There is no Plan list to pop to (the Plan isn't the late-joiner's); `Done` is the honest verb. No confirm alert, no session teardown.
- **No correctability impact.** Neither verb consumes a reroll budget and neither is a re-decide path. The reroll path (with its 3-burn cap, stated-reason friction, and initiator-only gate per S07) remains the only way to re-decide a Plan after the verdict.
- **No-survivor is no exception.** Even though `no-survivor` is the terminal failure mode, Home is pure navigation: the Plan returns to the user's list in its decided-failure state. The initiator's `Widen radius` CTA (and any subsequent re-run) is the only path that mutates the Plan's verdict.

### What this affordance replaces

Pre-bug-22 the verdict carried a `Start over` tertiary CTA under the primary on every mode except `read-only`. The verb implied a flow-restart that tore down the Plan, but the in-flight Plan is not destroyed — it's persisted, decided, and lives on the Plan list. The verb was renamed (`Home`), repositioned (chrome row, not the CTA dock), and reframed as pure navigation. The retired affordance is removed from every mode; it is never duplicated in the dock.

## The five-second test

The **loser** is the rate-limiting reader. They must see, within 5 seconds:

1. The verdict (single option, no negotiation surface)
2. The rule that produced it (one short sentence)
3. Their voice was counted (per-member receipt)
4. A path to ratify (`I'm in`)
5. A correctability path (friction-bearing reroll)

All five land within the choreo's 1.4s reveal. If you add a 6th element, something has to leave.

The test applies in full to `default` and `committed`. It applies in **limited form** to `read-only` (steps 1–3 only — there is no ratification or reroll path for a late-joiner). It does **not apply** to `no-survivor` — there is no verdict to ratify; the rule chip becomes the load-bearing message. In `solo` the test collapses to steps 1, 2, 4, 5 — there's a single voice, so step 3 ("their voice was counted") is implicit and the voice-receipt row is suppressed; the rule chip + I'm in + reroll still land within the same 1.4s reveal.

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
| `default` | Home chrome row above the eyebrow. CTA reads `"I'm in"`, white fill. CTA dock secondary slot empty pre-commit. |
| `committed` | Home chrome row above the eyebrow. CTA flipped to `"You're in · 3 of 4"`, **sun fill** with ink check prefix. Below: `"Window closes in 47s"` (status, not a verb). |
| `read-only` | Late-joiner mode. Chrome row reads `Done` (wfr-16 — fires `onAdvance` / Solo Setup; see §"Verdict chrome (Home / Done)"). Eyebrow `"Tonight's verdict"` (past-tense-implicit). Hero + meta + time badge + rule chip + voice receipts (late-joiner not in receipts — they didn't contribute). Suppressed: ratification CTA, reroll affordance. Primary CTA is `"Start a new decision"` (white pill). |
| `no-survivor` | Terminal — engine exited with no candidates after soft-pref relax. Home chrome row above the eyebrow. Eyebrow `"Tonight"`. Hero `"NO SPOT / FITS"` (one word per line). Meta line names the hard-need vetoes that survived (`"Vegan options · $$ cap · 15 min walk"`). No time badge. Rule chip is the load-bearing message in aggregate-rule register. Suppressed: voice receipts, ratification CTA, reroll. Primary CTA `"Widen radius"` (sun-fill, initiator-only); non-initiators see the chrome `Home` as their only exit. |
| `solo` | Single-member room. Triggered when `members.length === 1` AND the initiator did not share an invite (the share sheet never opened). Home chrome row above the eyebrow. Eyebrow `"Tonight, the verdict is"` (same definite article as `default` — the singular voice still produced a verdict). Hero + meta + time badge + rule chip + `I'm in` CTA + reroll tertiary all present. **Suppressed:** voice-receipt row (one voice doesn't need to be receipted back to itself). **Replaced:** the `default` mode's save-group affordance is replaced with the **save-taste-profile** affordance (the C-22 Auth Upgrade Chip from TB-12, copy `"Save this taste profile"`). The chip surfaces under the primary CTA in `default-idle` state for anonymous users; suppressed for already-linked users. Time badge renders the timestamp only — no audience subtitle. The communal frame self-cancels with `N = 1`; the solo voter already knows it's them. |

## What this surface defends against

- **Algorithm-as-decider drift.** Rule chip + receipts read in the first 2 seconds. The reader sees that *what they said* produced the verdict — not that the app decided.
- **Equity-celebration drift.** No confetti, no trophies, no "Pico's wins!" The hero is a statement, not a reward.
- **The loser feels excluded.** Receipts include the loser by name. Their voice is on screen as proof.
- **Re-litigation paralysis.** The `Home` chrome verb is pure navigation — it returns the user to the Plan list, it does **not** re-decide the Plan. The only re-decide path is reroll, which carries its own friction (3-burn cap, stated-reason requirement, initiator-only) per S07.
- **Retroactive influence by late-joiners.** Read-only mode honestly shows the verdict was sealed before they arrived. No receipt chip for them (would imply they contributed). No ratification (would imply their tap matters to the outcome).
- **Member-blaming on no-survivor.** The no-survivor rule chip uses aggregate-rule attribution. Never names the member whose hard need exhausted the candidate pool.

## Copy register (load-bearing)

- **`"Tonight, the verdict is"`** — definite article. The verdict, not a recommendation.
- **`"Tonight's verdict"`** (read-only) — past-tense-implicit. The late-joiner sees the decision already happened.
- **`"Tonight"`** (no-survivor) — bare, no verb. There's no verdict; the eyebrow shouldn't promise one.
- **Place name UPPERCASE stacked, one word per line.** Statement of finality.
- **`"NO SPOT / FITS"`** (no-survivor) — same one-word-per-line treatment. The hero is the absence; the rule chip carries the why.
- **Time-badge audience: `"ALL FOUR OF YOU"`** — communal frame. NOT "Reserved for 4" / "Party of 4". Suppressed in `no-survivor` and unchanged in `read-only`. In `solo` the audience subtitle is **omitted** — the badge renders the timestamp alone. The communal frame self-cancels with `N = 1`, and `"YOU"` would only restate what the solo voter already knows.
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
- **Pre-permission line** (`default` / `committed`) — `"We'll check in tomorrow — see if you went."` Voluntary warm-friend register. NEVER paraphrased to `"Enable notifications"`, `"Allow alerts"`, `"Turn on push"` or any system-register phrasing. The line surfaces under the CTA dock; the user's first `"I'm in"` tap fires the native iOS push permission prompt once per session (PRD user story 38–40). Suppressed in `read-only` (no ratification path) and `no-survivor` (no verdict to check in on).

## Mode-specific behavior

### `read-only`

- The chrome row reads `Done`, not `Home` — see §"Verdict chrome (Home / Done)". The iOS read-only path is reached only via a deep link to someone else's Plan (the Plan is not on the late-joiner's list), and the Web invitee has no Plan list at all (per the *Web invitee* definition in `CONTEXT.md`), so a `Home` verb has no honest destination. `Done` fires `onAdvance` — the same Solo Setup re-invite path the primary `Start a new decision` CTA uses. Restoring this chrome closed the workflow-review wfr-16 finding (the late-joiner had no escape hatch above the eyebrow before that fix).
- Triggered when a user taps the invite link **after** `rooms.verdict_committed_at` is non-null.
- Voice-receipt row shows only members who answered before commit. The late-joiner's chip does not appear.
- Primary CTA `"Start a new decision"` returns the user to S01 as the new initiator. Defaults are pre-populated from the prior room's `timer_minutes` + `radius_meters` (saves a tap; they're likely planning a similar outing).
- VO order: eyebrow → hero → meta → time badge → rule chip → receipts (in order) → re-invite CTA. Ratification path is announced as "Not available — this verdict is closed."

### `solo`

- Carries the Home chrome row above the eyebrow — same idiom as the group `default` mode. Tap pops to S00 Plan list with the just-decided Plan visible in the **Decided** section.
- Triggered when `members.length === 1` AND the initiator did NOT share an invite link (the iOS share sheet never opened). The flow skips S04 Waiting entirely — there's no quorum to wait on — and jumps directly to verdict computation followed by S05 in this variant.
- The engine runs identically. With a single `votes` row the EBA pruning chain still produces a survivor set (the singular voice is itself the room-aggregate min budget / min walk / max vibe). The regret tiebreaker still picks the maximum across survivors. `rule_text` follows the same generator — it names the rules that produced the verdict ("Budget cap cut Ren Soba.") without any "N of M wanted X" counts. The rule_text generator has no member-count branch, so this is guaranteed by construction; verified by the engine fixture test.
- Voice-receipt row is suppressed. Receipting a single voice back to itself reads as exposure (your one chip on screen, alone) and doesn't earn its place in the 1.4s reveal. The receipt-row step (1140ms) collapses; everything after lands at the same canonical delays.
- Time badge renders the timestamp only. The audience subtitle is suppressed in solo — the communal `"All N of you"` frame doesn't apply to a single voice, and replacing it with `"You"` would only restate what the solo voter already knows.
- `I'm in` CTA remains. The voice is voluntary in the same way — the user can still decline their own verdict and reroll. The 30s correctability window applies the same way; `"You're in"` reads without the N-of-M denominator when the user commits (no quorum to count to).
- **Save-taste-profile affordance** replaces the `default` mode's save-group secondary. The C-22 Auth Upgrade Chip (TB-12) is the load-bearing affordance — its `"Save this taste profile"` copy was already designed for this moment. Surfaces under the primary CTA in `default-idle` state for anonymous users; suppressed (`hidden`) for users who already linked Apple. Solo mode is the highest-conversion moment for sign-in (the user just demonstrated effort solo — they have a taste profile worth saving and no group context to default into).
- Reroll tertiary remains. A solo user can still discover their first verdict didn't fit (TB-10's cost / dist / mood / diet / avail taxonomy applies the same way).
- The chrome-row `Home` verb is the only path back to the Plan list. A solo user who wants to start a fresh Plan does so by tapping Home → S00 Plan list → FAB.

### `no-survivor`

- Triggered when VerdictEngine exits with `method = 'no_survivor'` after exhausting soft-pref relax (cuisine veto → vibe floor → radius widen).
- Carries the Home chrome row above the eyebrow. Tap pops to S00 Plan list; the Plan stays in `decided-active` (no-survivor still counts as a settled verdict — the user can return to it from the list and tap `Widen radius` again).
- `"Widen radius"` is an inline expansion (not a separate sheet). Tapping the CTA reveals a C-21 range slider with range `1–10 mi`, suggested value = `current + 1.0 mi`, step `0.5`. Commit re-runs the engine; if the second run also fails, the surface re-renders with the new radius surfaced in the meta line.
- The `"Widen radius"` re-run does **not** consume a reroll budget — the engine failed, not the group.
- Non-initiators see only the chrome `Home` verb — the primary `Widen radius` CTA is suppressed (initiator-only). Home is their exit.
- Voice-receipt row is suppressed — there's no verdict to receipt, and showing answers without a verdict reads as exposure.
- No telemetry hint copy in 0.1.0 (`"This is rare — most groups find a spot at 2 mi."`). Revisit if the no-survivor rate proves high in beta.
- VO order: eyebrow → hero (`"No spot fits"`) → meta (surviving hard-needs) → rule chip → primary CTA. The rule chip carries the load-bearing message and must be in the first read order.

## Edge cases

- **Verdict matches a veto.** Shouldn't be possible (EBA culls first), but defensively the surface would show a `"Filter clash"` banner above the hero and offer reroll directly.
- **Tie at regret stage.** Rule sentence becomes `"Pico's and Ren Soba tied; Pico's was closer for {majority}."` Distance becomes the second-order tiebreaker.
- **Only 1 candidate survives.** Eyebrow shifts to `"Only one made it tonight"`. Otherwise identical to `default`.
- **`no-survivor` after widen.** If the user widens the radius and the engine still returns no survivors, the surface re-renders in `no-survivor` mode with the updated meta line. The slider is available again with a fresh `+1.0 mi` suggestion. There's no hard ceiling on widens, but each one re-shows the rule chip — friction by repetition.
- **Late-joiner during widen-loop.** If a member who is not the room's initiator opens the room while the initiator is on `no-survivor`, they see the same `no-survivor` mode but without the `"Widen radius"` CTA (initiator-only action). They see the chrome-row `Home` verb only — Home pops them back to their Plan list.
