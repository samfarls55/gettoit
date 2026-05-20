---
surface: 01-setup
status: locked
locked-date: 2026-05-19
supersedes:
  - 01-initiator
  - 01b-parameters
jsx:
  - code/screens/ScreenSetup.jsx
---

# S01 · Plan setup

> **Code:** [`../code/screens/ScreenSetup.jsx`](../code/screens/ScreenSetup.jsx)

The canonical **Plan creation + Plan edit** surface — one screen that collapses today's S01 (Initiator landing) + S01b (Pre-quiz parameters) into a single Setup screen. Lands the design-system contract for the workflow-overhaul phase per [[../../gti-vault/50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] (the locked outcomes of the 2026-05-19 `/grill-with-docs` session).

This surface ships once; the iOS wiring (replacing the existing `ScreenInitiator` + `ScreenParameters` paths) lives in the paired tracer-bullet **tb-WF-4**. Until that lands, the legacy S01 + S01b surfaces remain in the tree, marked `superseded`.

## Modes

The surface has two modes — `create` (new Plan) and `edit` (existing `pending` Plan) — driven by a single `mode` prop. Both modes share layout; only the headline and the secondary CTA label differ.

| Mode | Headline | Body | Secondary CTA | Primary CTA |
|---|---|---|---|---|
| `create` | `Start a new plan` | `One screen. Set it once. Share when you're ready.` | `SAVE FOR LATER` | `Drop the invite link` (group) / `Start the quiz` (solo) |
| `edit` | `Edit your plan` | `One screen. Set it once. Share when you're ready.` | `SAVE CHANGES` | `Drop the invite link` (group) / `Start the quiz` (solo) |

The primary CTA's label swaps on the live `groupContext` selection — `A group` / `Two of us` reads `Drop the invite link`, `Just me` reads `Start the quiz`. The `groupContext` chip group defaults to `A group`, so the canonical first-paint label is `Drop the invite link`.

## What this surface defends against

The new surface deliberately **overrides** S01-initiator's "no name your night" defense. The original surface forbade naming the session up front (the framing was that pre-commitment killed momentum). With Plans now persistent, named, list-backed items in the Reminders-app spirit, **naming is the load-bearing differentiator** — without a name, the Plan can't be re-found on the list, an Edit-mode return is meaningless, and the rename of *decision → Plan* (workflow-overhaul Q2) loses its motivating ground.

This spec exception is the only intentional override against the locked S01 rule set. Other S01 defenses still hold:

- **Algorithm framing** — still suppressed. No "AI", "smart", "suggestions" copy anywhere.
- **Group-size friction** — still suppressed. The `Who's coming` chip group is **occasion framing**, not headcount; actual group size is inferred from who accepts the invite.
- **Pre-commitment paralysis** — still defended. Every control except `Name this plan` opens on a sensible default; an initiator can ship a valid Plan by typing a name and tapping the primary CTA.

If a future spec change wants to add a seventh control, it has to justify the addition against the same locked rule: every knob beyond name must either ship a sensible default or be explicitly load-bearing.

## Locked inventory — six controls, flat eyebrow-per-control rhythm

| # | Eyebrow | Control | Default |
|---|---|---|---|
| 1 | `Name this plan` | Text input, **required**, 40-char cap, placeholder `"Name this plan"` | empty |
| 2 | `Who's coming` | Single-select chips (C-04): `Just me · Two of us · A group` | `A group` |
| 3 | `Where to` | `C-23 LocationPicker` chip (existing) | resolved GPS / `empty` |
| 4 | `When are you eating` | Single-select chips (C-04): `Breakfast · Lunch · Dinner · Late night` | `Dinner` |
| 5 | `How you want to eat` | Single-select chips (C-04): `Dine in · Outdoor seating · Takeout · Delivery` | `Dine in` |
| 6 | `How far` | Distance slider (C-21 variant — see below) | `1.0 mi` |

**Removed from the merged S01 + S01b inventory:**

- **Category picker** — food only in v1, so no picker rendered (S01-initiator's drinks/movie placeholder rows are not carried forward).
- **Timer chip group** — retired by v1.1 PRD US34 / US35 / §line 115. There is no session timer in v1.1+.
- **Transport mode chips** (S01b's `Walking / Driving`) — collapsed into the distance slider. The walk-vs-drive cognitive shift is signaled implicitly by the tick at 1.0 mi (see §Distance slider).

### Chip group treatment

All four chip groups are the **C-04 chip, single-select variant** — same primitive as today's S01 timer chips and S01b parameter chips. Selected: sun-yellow fill, ink text, `scale 1.02`, `shadow-chip-selected`. Default: glass row (white 0.04 bg, white 0.55 outline, `blur(4px)`). Tap target ≥ 48. Chips wrap to as many rows as the labels need.

### Name input treatment

| Property | Value |
|---|---|
| Component | Glass row (matches the C-23 picker treatment — same `--r-row` radius, same soft-glass background) hosting a borderless `<input type="text">`. |
| Background | `var(--glass-fill-soft)` with `rgba(255,255,255,0.18)` outline |
| Backdrop | `blur(12px) saturate(160%)` |
| Min-height | `56` (matches the C-23 chip) |
| Padding | `12px 16px` |
| Border-radius | `var(--r-row)` |
| Font (input value) | Inter 700 / 17 / white |
| Placeholder | `"Name this plan"` in `rgba(255,255,255,0.6)` |
| Cap | `maxLength={40}` — hard cap, no truncation indicator (the cap is light enough that users feel the limit by hitting it, not by seeing a counter) |
| Eyebrow | `Name this plan` in `eyebrow` token treatment, opacity `0.6`, above the row |

The eyebrow doubles as the placeholder string. Voice register — sentence case in eyebrow, sentence case in placeholder. Never `"Plan name"` (form-field register) or `"Tonight's plan"` (occasion-coupling — Plans can be days out).

## Distance slider — C-21 variant

The `How far` slider is a **non-uniform-step variant of C-21 Range Slider** (see `components.md §C-21`). Same visual primitive — sun-filled left of thumb, white disk thumb, 6px track inside a 44pt hit row — with two added behaviors:

- **Step schedule:** non-uniform. The allowed values shrink below 1 mi (the walking range) and grow above 5 mi (the suburban-drive range):
  - **0.25–1.0 mi:** `0.25, 0.50, 0.75, 1.00`
  - **1.0–5.0 mi:** `1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0`
  - **5.0–10.0 mi:** `5.0, 6.0, 7.0, 8.0, 9.0, 10.0`
  - Composed: `[0.25, 0.50, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]` (17 stops). The native `<input type="range">` slides through the smallest gap (0.25); on `onChange`, the JSX snaps to the nearest entry in the list.
- **Anchor tick at 1.0 mi:** a 2 × 10 px rounded rect (radius 1px) in the `color.slider.tick` token (`rgba(255,255,255,0.55)`), centered on the 6px track at the 1.0 mi position. Purely visual — no words, no label. Anchors the implicit walk/drive cognitive boundary without resurrecting the rejected transport-mode question.
- **Mono-tag value label** above the row, top-right, aligned with the `How far` eyebrow on the left: `"1.0 MI"` (`{value.toFixed(1)} MI` rendered in `mono-tag` token treatment — Inter 500 / 11 / tracking 0.18em / UPPERCASE / white 0.88). **Never** `"WALKING DISTANCE"` or `"DRIVING DISTANCE"` — those labels would re-introduce the transport-mode binary the slider replaces.

Range, default, snap-list, and tick position are locked. Any deviation requires re-grilling Q8 of [[../../gti-vault/50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]].

### New token

A new `color.slider.tick` token landed with this surface (`rgba(255,255,255,0.55)`). The value is the existing white-at-0.55 already used by S01-initiator's `SETTINGS` link and the C-04 chip outline, lifted into a semantic role so the tick has a registered home. Generated into `GTIColor.Slider.tick` (`ios/Sources/GTITokens.swift`) by `gen-swift.mjs`.

## Where the LocationPicker lives

The `C-23 LocationPicker` (existing) renders as control #3 under the `Where to` eyebrow. It follows the locked state table from `01-initiator.md §"Persistent location selector"` (`auto / manual / stale / empty / loading`) — no surface-level changes to the chip's behavior.

Validation note: per workflow-overhaul Q10, **location is not gated separately on this screen**. The picker's existing `empty` state surfaces visually; the user can ship a Plan with `null` location and resolve it via the existing S04 mechanism. This is a deliberate departure from S01-initiator, where `empty` disabled the primary CTA — the workflow overhaul splits Plan minting (here) from room minting (on tap), and a Plan with no location is a valid `pending` row.

## Dock

| Mode | Secondary | Primary |
|---|---|---|
| `create` | `SAVE FOR LATER` text link (eyebrow token treatment, white 0.55) | `PillCTA` white — `Drop the invite link` (group) / `Start the quiz` (solo) |
| `edit` | `SAVE CHANGES` text link (eyebrow token treatment, white 0.55) | `PillCTA` white — `Drop the invite link` (group) / `Start the quiz` (solo) |

Both dock affordances are inside a `CTADock`. The secondary uses the **same treatment** as today's S01 `SETTINGS` footer link — `eyebrow` token (Inter 700 / 11 / tracking 0.18em / UPPERCASE), `rgba(255,255,255,0.55)`, 44pt min-height hit row, sits below the primary `PillCTA` with `4px` margin-top. Plain `<button>`, no icon, no chevron. Mirrors the C-22 chip's primary-pill-plus-tertiary-text pattern.

### Validation

- **Name required for both dock CTAs.** Both `SAVE FOR LATER` (or `SAVE CHANGES` in edit mode) **and** `Drop the invite link` / `Start the quiz` are disabled until `name.trim().length > 0`.
- **No other field is gated.** Defaults ship the screen; an initiator who types a name and taps primary mints a valid Plan + room.

### Top-bar back / cancel behavior

Per workflow-overhaul Q11:

- `create` mode, name non-empty, user taps top-bar Back/Cancel → **auto-save** the Plan as `pending`, return to the Plan list. (Treat the secondary `SAVE FOR LATER` and a back-out as equivalent — no work lost.)
- `create` mode, name empty, user taps top-bar Back/Cancel → **discard**, return to the Plan list. No confirm prompt (nothing has been named, nothing to lose).
- `edit` mode, user taps top-bar Back/Cancel → **auto-save** changes, return to the list. The name is non-empty by definition (existing Plan), so the empty-discard branch is impossible from edit.

The top-bar itself is supplied by the surrounding navigation chrome (Plan list ↔ Setup is a push-style transition, not a quiz-style segmented progress); this surface does not render a `C-02 TopBar`. The chrome's `Back`/`Cancel` button is wired to the host (iOS — tb-WF-4).

## Components used

`GradientSurface` (initiator stop) · `GTIMark` · `Eyebrow` · display headline · Glass row (name input) · `Chip` (C-04 single-select) ×3 groups · `LocationPickerChip` (C-23, existing) · `RangeSlider` (C-21 with non-uniform `steps` + `tickAt`) · `CTADock` · `PillCTA` white · `eyebrow`-styled `<button>` secondary text link.

No new component is introduced. The existing C-21 gained an optional non-uniform-step + tick variant — documented in `components.md §C-21` — but it remains the same primitive.

## Copy register

Carries S01b's voice forward — second-person, casual, never form-field register.

- **`Start a new plan` / `Edit your plan`** — present-tense, declarative. Not `"Create a session"` (procedural) or `"Plan details"` (form-field).
- **`One screen. Set it once. Share when you're ready.`** — three short declarative sentences. Names the contract (one screen) and the asynchronous nature (share when ready, not on submit).
- **Eyebrows** — second-person and casual: `Name this plan`, `Who's coming`, `Where to`, `When are you eating`, `How you want to eat`, `How far`. Never `Plan name` / `Group size` / `Meal time` / `Service type` / `Distance` (form-field register).
- **`Drop the invite link` / `Start the quiz`** — voluntary verb, casual register. The label swaps on `groupContext` — solo gets `Start the quiz` (no one to invite); group gets `Drop the invite link`.
- **`SAVE FOR LATER` / `SAVE CHANGES`** — eyebrow-token mono-tag treatment, deliberately understated. Mirrors `SETTINGS` on S01-initiator.

## Persistence + behavior

The Setup surface is the **Plan** surface, not the room surface. Persistence rules:

- **Save for later** (secondary tap, or back-out with name non-empty): mints a `plans` row with `status: 'pending'`, captures all six controls onto the Plan, returns to the Plan list. No room created.
- **Primary CTA tap** (`Drop the invite link` / `Start the quiz`): mints the `plans` row as above **and** immediately mints the `rooms` row from the Plan's captured controls + fires the existing invite / quiz flow.
- **Edit mode primary tap**: writes back to the existing `plans` row, then immediately mints the room + fires the invite/quiz.
- **Edit mode secondary (`SAVE CHANGES`) tap**: writes back to the existing `plans` row, returns to the list. No room created.

Column-level mapping (Plan → captured controls) is owned by [[../../gti-vault/15_issues/workflow-overhaul/issues/tb-wf-1-plans-table-schema|tb-WF-1]] (Plans table schema). The room-level mapping inherits today's `rooms.session_params` jsonb shape (from S01b) plus a new `rooms.distance_mi` derived from the slider value — see tb-WF-4 for the room-side wiring.

## Accessibility

- **Tab/focus order:** Name input → Who's coming chip group → LocationPicker chip → When chip group → How you want to eat chip group → How far slider → primary CTA → secondary text link.
- **VoiceOver:**
  - Name input: announces the eyebrow as the field label ("Name this plan, text field").
  - Chip groups: VO announces selected state via `aria-pressed`.
  - LocationPicker: inherits its existing VO contract from C-23.
  - Slider: `aria-label="Plan distance"`, `aria-valuetext={value.toFixed(1) + " miles"}` so VO reads `"1.0 miles"` rather than `"1"`.
- **Dynamic Type:** the screen is scrollable; all six rows tolerate text scaling up to AX5. The slider mono-tag value stays at its locked size (mono-tag treatment is intentionally non-scaling — same rule as the rest of the system).

## Versions / history

- `2026-05-19` — surface specified per [[../../gti-vault/15_issues/workflow-overhaul/issues/sg-wf-1-plan-setup-surface|sg-WF-1]] (#154). Locked from the 2026-05-19 `/grill-with-docs` decisions in [[../../gti-vault/50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]]. iOS wiring deferred to tb-WF-4 (gated on sg-WF-4 Plan list landing). Until tb-WF-4 lands, `01-initiator.md` and `01b-parameters.md` remain in the tree marked `superseded`.
