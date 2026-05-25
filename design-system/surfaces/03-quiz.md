---
surface: 03-quiz
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenQ1Vetoes.jsx
  - code/screens/ScreenQ2Budget.jsx
  - code/screens/ScreenQ3Distance.jsx
  - code/screens/ScreenQ4Vibe.jsx
  - code/screens/ScreenQ5Regret.jsx
---

# S03 · Quiz (Q1–Q5)

> **Code:**
> - [`../code/screens/ScreenQ1Vetoes.jsx`](../code/screens/ScreenQ1Vetoes.jsx)
> - [`../code/screens/ScreenQ2Budget.jsx`](../code/screens/ScreenQ2Budget.jsx)
> - [`../code/screens/ScreenQ3Distance.jsx`](../code/screens/ScreenQ3Distance.jsx)
> - [`../code/screens/ScreenQ4Vibe.jsx`](../code/screens/ScreenQ4Vibe.jsx)
> - [`../code/screens/ScreenQ5Regret.jsx`](../code/screens/ScreenQ5Regret.jsx)

5 questions, ~10s each, total budget <60s. One decision per screen. The gradient hue-shifts continuously through the quiz — coral → magenta → indigo → midnight — which IS the experience.

## Quiz skeleton

Every Qn screen has the same skeleton:

```
QuizChrome  (Back? + Exit/Leave text labels)
   ↓ 0
TopBar  (5-segment progress; × suppressed in quiz context)
   ↓ 40
QuestionHeader  (eyebrow + display title + sub)
   ↓ 24
[question body]
   ↓ auto
CTADock  (primary pill)
```

Reusable across all five — see `components.jsx`. The `QuizChrome` row
owns the Exit/Leave affordance, so the C-02 TopBar's `×` is suppressed
on the quiz surfaces (`onClose` left undefined). See §"Quiz chrome
(Back + Exit)" below for the locked rules.

---

> **0.1.0 quiz redesign.** The five questions below were reworked by the
> 0.1.0 quiz redesign (`gti-vault/50_product/0.1.0-quiz-amendments`,
> `gti-vault/10_prds/0.1.0-quiz-redesign-prd`). Dietary vetoes and walk-time
> moved out of the quiz — vetoes into the per-account *profile*, walk-time
> into the pre-quiz *parameters* surface — so the in-quiz questions are
> now positive, decision-shaping signals. The JSX in `code/screens/`
> (filenames `ScreenQ1Vetoes` / `ScreenQ3Distance`) still carry the 0.1.0
> sample content and have not been renamed; the markdown below is the
> authoritative question spec.

## Q1 — Cuisine craving (capped multi-select chips)

Soft scoring signal — what the member is craving tonight. Multi-select
C-04 chips. Gradient: `q1` (coral → yellow).

**Cap:** at most **3** cuisine picks, plus a mutually-exclusive **"No
preference"** chip. Once 3 are selected the remaining cuisine chips render
in C-04's `disabled` state; a selected chip stays tappable so it can be
deselected to free a slot. The cap forces selectivity (anti-paralysis) and
bounds the preference-override inference — beyond 3, the honest signal is
"No preference."

**Rule:** "No preference" is mutually exclusive — selecting it clears every
cuisine; selecting any cuisine clears "No preference". "No preference" never
counts toward the 3-cap.

**Not a hard veto.** Cuisine craving is a positive soft-scoring axis, not an
EBA cut. Cuisine *NEVERS* (the negative direction) live in the per-account
profile. The general per-member Foursquare call supplies non-craved variety
so the candidate pool is never all-craved.

---

## Q2 — Spend cap (single-select tier)

Hard NEED veto — a ceiling the verdict never exceeds. Single-select.
Gradient: `q2`.

**4 fixed tiers, never a slider.** Slider creates per-user exact numbers that produce information asymmetry ("Maya said $34") and don't survive the rule chip cleanly. Tiers normalize to 4 categories everyone uses. Aggregated as the intersection — the lowest cap across members.

---

## Q3 — Reputation / discovery (single-select chips)

Soft scoring signal — the standing of the place, not the food.
Single-select C-04 chip picker. Gradient: `q3`.

**Options:** `Popular · Hidden gem · Classic · New · No preference`. Default:
`No preference` — the neutral, non-pruning answer.

Reputation is a **client-side-scored** axis derived from Foursquare venue
metadata (rating count / value / venue age) — *not* a fetch filter. The 0.1.0
query-chip technique (sending the chip as a Foursquare `query` keyword) was
retired: the Q5 factorial needs reputation variety in every member's pool,
so reputation cannot strict-filter the fetch.

---

## Q4 — Vibe energy (cardinal scale)

Cardinal scalar on a single axis — energy / loudness, not formality.
Gradient: `q4` (indigo). UI: the C-08 Vibe Energy Scale.

**Canonical vocabulary** (`vibe-labels` token → `GTIVibeLabels.all`):
`QUIET · CHILL · SOCIAL · LIVELY · ROWDY`. Low-energy → high-energy.

The huge live word at the center is the system saying "yes, this is your vibe." Small text would invite second-guessing.

**Why no drag handle:** Q4 is cardinal-scalar, not interpolatable. Tapping a stop is canonical. A drag handle invites users to land between stops, which the preference math can't use.

---

## Q5 — Preference probe (3 cards × 5 buttons)

**The only surface in the system where multi-option rating is permitted.** Gradient: `q5` (midnight).

> **Code:** [`../code/screens/ScreenQ5Regret.jsx`](../code/screens/ScreenQ5Regret.jsx)
> Two modes: `default` · `no-results`.

3 *real* candidate venues. The member rates each 1–5 on excitement ("How
excited does this make you?"). Q5 is a **preference probe**, not a
tiebreaker — the ratings reveal how much each preference axis truly weighs.
CTA flips to **sun-yellow `"Drop the verdict"`** — the only quiz screen that
telegraphs the verdict is coming. The factorial card-generation logic and
the real-candidate wiring are specified by the 0.1.0 PRD (module C) and built
by issue **tb-08** — this surface section is the visual shell only.

### Modes

| Mode | Visible state |
|---|---|
| `default` | TopBar (segment 5 active) + C-03 QuestionHeader + three factorial candidate cards with 1–5 excitement raters + sun-fill `"Drop the verdict"` CTA. |
| `no-results` | TopBar (segment 5 active) + centered headline + body block + sun-fill `"Head to the verdict"` CTA. The three rater cards and the `"Drop the verdict"` CTA are suppressed. |

### `no-results` mode

The Q5-flow analogue of the verdict-side `no-survivor` mode
(`surfaces/05-verdict.md`) — same structural precedent: a centered
headline + body block in place of the surface's primary content, an
action-shaped sun-fill CTA, no fictitious filler.

- **Trigger condition.** The per-member venue fetch produced no
  factorial-usable pool — there are no real candidates to rate. The app
  must never surface a made-up place to a user, so an empty pool renders
  this state rather than fabricated venues. (The factorial-pool fetch and
  the empty-pool detection are PRD module C; the iOS consumption is the
  paired tracer bullet **tb-26**.)
- **Rendered elements.**
  - C-01 gradient surface — the `q5` gradient stops, unchanged.
  - C-02 TopBar — `×` + 5-segment progress, segment 5 active.
  - A centered headline + body block — the C-03 question-header family
    rendered centered, matching the verdict `no-survivor` centered-block
    treatment.
  - C-05 primary pill CTA, **sun fill** — `"Head to the verdict"`.
- **Suppressed elements.** The three factorial rater cards and the
  `"Drop the verdict"` CTA. There is nothing to rate, so neither earns a
  place on the surface.
- **Composition.** Built entirely from existing primitives — C-01 / C-02 /
  C-03 / C-05 — and existing tokens. No new component, no new token.

**Locked copy** (`no-results`):

- **Headline:** `No spots to rate near you.`
- **Body:** `Couldn't line up rateable spots in your radius tonight. Your other answers still count — the verdict lands without this step.`
- **CTA:** `Head to the verdict` (C-05, sun fill — action-shaped, per the
  design system's ban on generic `Next` / `Continue` / `OK` CTAs).

---

## Quiz chrome (Back + Exit)

Every Qn surface carries two text-label affordances above the C-02
TopBar: a `Back` link top-leading and an `Exit` / `Leave` link
top-trailing. Locked by the workflow-overhaul plan §Q5 (`[[../../gti-vault/50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]]`)
and the canonical verb semantics in `[[../../CONTEXT|CONTEXT.md]]` →
*Plan back* / *Plan exit*. The `Delete` verb lives on the Plan list
surface (sg-WF-4) and never appears here.

### Per-question render rules

| Question | Back | Exit / Leave |
|---|---|---|
| Q1 — Cuisine craving | **Omitted** — no prior question to return to | Rendered |
| Q2 — Spend cap | Rendered | Rendered |
| Q3 — Reputation / discovery | Rendered | Rendered |
| Q4 — Vibe energy | Rendered | Rendered |
| Q5 — Preference probe | Rendered | Rendered |

`Back` is wired via `QuizChrome canBack={false}` on Q1; that collapses
the leading slot to a 44pt-wide spacer so the Exit/Leave label stays
anchored to the trailing edge. The Q1 chrome therefore carries only
`Exit` / `Leave`.

### Role-conditional labels

| Role | Top-trailing label |
|---|---|
| Initiator (Plan creator, Account member) | `Exit` |
| Joiner (Account or Web invitee) | `Leave` |

Same mechanic, different verb: `Leave` honours that the joiner is
withdrawing from someone else's Plan, not killing it. The label is
selected by the `role` prop on `QuizChrome` (`'initiator'` |
`'joiner'`).

### Placement + treatment

| Element | Spec |
|---|---|
| Position | Top of the surface, above the C-02 TopBar |
| `Back` | Top-leading |
| `Exit` / `Leave` | Top-trailing |
| Type | Existing `eyebrow` token treatment — Inter 700 / 11 / tracking 0.18em / UPPERCASE |
| Color | white 0.78 |
| Icons | **None** — pure text labels. Matches the existing S01 `SETTINGS` footer link convention |
| Tap target | 44pt minimum (per HIG); the hit row is taller than the visible glyph via padding |
| Visual weight | Low — neither label may compete with the primary chip / scale / rater area below |

### Behavior

- **`Back`.** Tap steps the active quiz screen one question backward
  (e.g., Q3 → Q2) **with the prior answer preserved and re-editable**.
  Strictly per-member; never affects room state. Wired via the
  `onBack` callback supplied by the host surface — the JSX guarantees
  the affordance renders; the actual nav + answer-preservation lives
  in the iOS state layer (tb-WF-2).
- **`Exit` / `Leave`.** Tap opens the confirmation alert (below). On
  confirm, `onExit` fires — the host drops the exiter from the room
  (answers discarded), then routes to the Plan list surface. Room
  mutation is an iOS-wiring concern (tb-WF-2). On cancel ("Keep
  going"), the alert dismisses and no state changes.

### Confirmation copy (verbatim — do not paraphrase)

**`Exit` (initiator, multi-member room):**

- Title: `Exit this plan?`
- Body: `Your answers will be discarded. Others can still finish without you.`
- Confirm button: `Exit`
- Cancel button: `Keep going`

**`Leave` (joiner):**

- Title: `Leave this plan?`
- Body: `Your answers will be discarded. The host and others can still finish.`
- Confirm button: `Leave`
- Cancel button: `Keep going`

**Solo session** (only one member; the invite link was never shared) —
`QuizChrome solo={true}`:

- Title: `Exit this plan?`
- Body: `Your answers will be discarded. Your plan will stay saved so you can start over.`
- Confirm button: `Exit`
- Cancel button: `Keep going`

The solo variant communicates the Plan-state side-effect — the Plan
returns to `pending` on the user's list — because a solo exit is the
only case where the Plan can't quietly continue without the user.

### Cancel-via-backdrop

Tapping outside the alert card dismisses it the same as `Keep going`.
No state changes. Backdrop is `rgba(0,0,0,0.42)`; the alert card uses
the existing dark glass treatment (matches C-23 LocationPickerSheet
and the Settings delete alert).

---

## Cross-quiz invariants

- **In-quiz back is allowed Q2–Q5.** `Back` steps one question backward
  with the prior answer preserved; see §"Quiz chrome (Back + Exit)"
  above. Q1 has no Back affordance (no prior question). The 0.1.0 "no
  back arrow / friction is the feature" stance was retired by the
  workflow-overhaul plan §Q5 — preserving the prior answer prevents
  the preference-signal pollution that the friction model was
  guarding against.
- **Top bar progress fills first (300ms ease-out)** so users know they're on the next question before the 1.1s gradient settles.
- **Primary CTA is white-filled by default.** Q5 breaks the pattern (sun-filled) deliberately — it telegraphs commitment.
