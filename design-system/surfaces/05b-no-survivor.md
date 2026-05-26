---
surface: 05b-no-survivor
status: locked
locked-date: 2026-05-26
jsx: []
---

# S05b · No-survivor (widen-and-retry)

> **Parent:** [`05-verdict.md`](./05-verdict.md) (live verdict — `default` / `committed` / `solo`)
> **Sibling:** [`05a-verdict-read-only.md`](./05a-verdict-read-only.md) (closed-verdict view)
> Per [[gti-vault/60_engineering/adr/0018-verdict-surface-three-way-split|ADR 0018]] — the no-survivor terminal is a single-intent Focus surface, distinct from the live verdict.

The Focus surface rendered when VerdictEngine exits with `method = 'no_survivor'` after exhausting soft-pref relax (cuisine veto → vibe floor → radius widen). **One intent:** widen the search and re-run.

This is **not a verdict surface**. There's no decision to celebrate — no hero, no time badge, no receipts. The hero is the *absence* (`NO SPOT / FITS`); the rule chip carries the load-bearing message.

## Layout

| Element | Visible state |
|---|---|
| Chrome row | `Home` top-leading — always rendered (the initiator owns this surface; PlanList is reachable) |
| Eyebrow | `"Tonight"` — bare, no verb. There's no verdict; the eyebrow shouldn't promise one |
| Hero | `"NO SPOT / FITS"` (stacked one word per line) — same UPPERCASE treatment as the live verdict's place name |
| Meta line | Surviving hard-needs (`"Vegan options · $$ cap · 15 min walk"`) |
| Rule chip | Aggregate-rule register — `"Vegan options left no candidates within walking distance tonight."` Never names a person |
| Widen expansion | Inline range slider, 1..10 mi, 0.5-mi step. Initial value = `current + 1.0 mi`, clamped to the 10 mi cap |
| Primary CTA | **Initiator-only** — `"Widen radius"` (sun-fill) when slider closed; `"Re-run · N.N mi"` once slider opens |

## Verdict chrome (Home)

Same idiom as the live verdict ([`05-verdict.md`](./05-verdict.md) §"Verdict chrome"). Top-leading `Home` verb, eyebrow-token treatment, 44pt hit row. Tap pops to S00 Plan list with the just-failed Plan visible in the **Decided** section in `decided-active` state — the no-survivor still counts as a settled verdict; the user can return and tap `Widen radius` again.

Non-initiators see only the chrome `Home` verb — the primary `Widen radius` CTA is suppressed (initiator-only per spec). Home is their exit.

## Compressed reveal

The choreography skips the time-badge and receipts beats (which don't render here). Schedule:

| Step | Delay | Element |
|---|---|---|
| 1 | 80ms | Eyebrow `"Tonight"` |
| 2 | 280ms | Hero `"NO SPOT / FITS"` |
| 3 | 700ms | Meta line (surviving hard-needs) |
| 5 | 1020ms | Rule chip |
| 7 | 1380ms | Primary CTA |

Same easing token (`outSoft`) as the live verdict. See [`motion.md`](../motion.md) §"Verdict reveal — no-survivor block".

## Widen radius mechanics

- Range: **1.0 mi to 10.0 mi**, step **0.5 mi**.
- Initial value: `current_radius_miles + 1.0`, clamped to `[1.0, 10.0]`.
- Tapping `Widen radius` opens the inline expansion (slider + value chip). Tapping the CTA a second time fires `onWidenRadius(meters:)` with the slider's commit value.
- The widen call re-runs `compute-verdict` server-side with the new radius. The prior `no_survivor` verdict + cuts are dropped; successful prior verdicts are NOT replaced.

### Reroll burns are NOT consumed

The widen action does **not** consume a reroll burn. The engine failed, not the group; reroll burns are reroll-specific (`07-reroll.md` mechanics). The no-survivor recovery is a quiz-pool-fetch retry, not a verdict reroll. This is explicit in the implementation: the `NoSurvivorScreen` widen-CTA tap path never touches `RerollStore`.

### Failure loop

If a widen still produces no survivors, the surface re-renders in this same shape with the updated meta line. The slider is available again with a fresh `+1.0 mi` suggestion. There's no hard ceiling on widens, but each one re-shows the rule chip — friction by repetition.

## Copy register (load-bearing)

- **`"Tonight"`** — bare, no verb. There's no verdict to promise.
- **`"NO SPOT / FITS"`** — same one-word-per-line treatment as the live hero. The hero is the absence; the rule chip carries the why.
- **No-survivor rule chip** uses aggregate attribution for shared constraints and attribute-attribution for private ones:
  - **Good:** `"Vegan options left no candidates within walking distance tonight."`
  - **Good:** `"Shellfish-safe kitchens are sparse within 2 miles tonight."`
  - **Bad:** `"Maya's vegan veto left no places."` (names the who)
  - **Bad:** `"Filtered for shellfish allergy left no places."` (exposes a private constraint)
- **`"Widen radius"`** — verb-first, action-shaped. NOT `"Try again"` (implies user error).

## Voice and motor accessibility (VO)

VO read order: chrome → eyebrow → hero (`"No spot fits"`) → meta (surviving hard-needs) → rule chip → primary CTA. The rule chip carries the load-bearing message and must be in the first read order.

## Defends against

- **Member-blaming on no-survivor.** The rule chip uses aggregate-rule attribution. Never names the member whose hard need exhausted the candidate pool.
- **Spuriously consuming a burn.** The widen is free — the failure was the engine's, not the group's. Burn-aware mechanics live exclusively on the reroll path (S07).
- **Implying user error.** `"Widen radius"` is verb-first and action-shaped; never `"Try again"` (which would frame the no-survivor as an input mistake the user made, when it's a pool-availability outcome of the inputs the engine received).

## Edge cases

- **Late-joiner during widen-loop.** A member who is not the room's initiator opens the room while the initiator is on `no-survivor`. They see the same surface but without the primary CTA (initiator-only). The chrome-row `Home` verb is their only exit.
- **No-survivor reached via read-only deep link.** A late-joiner deep-linking into a `decided-expired` Plan whose engine run was a no-survivor lands on [`05a-verdict-read-only.md`](./05a-verdict-read-only.md), not this surface — they have no widen action to take, and the read-only register is the honest shape for "this Plan ended without a verdict, here's the record."
- **No telemetry hint copy in 0.1.0.** No `"This is rare — most groups find a spot at 2 mi."` Revisit if the no-survivor rate proves high in beta.
