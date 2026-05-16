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
TopBar  (× + 5-segment progress)
   ↓ 40
QuestionHeader  (eyebrow + display title + sub)
   ↓ 24
[question body]
   ↓ auto
CTADock  (primary pill)
```

Reusable across all five — see `components.jsx`.

---

> **v1.1 quiz redesign.** The five questions below were reworked by the
> v1.1 quiz redesign (`gti-vault/50_product/v1.1-quiz-amendments`,
> `gti-vault/10_prds/v1.1-quiz-redesign-prd`). Dietary vetoes and walk-time
> moved out of the quiz — vetoes into the per-account *profile*, walk-time
> into the pre-quiz *parameters* surface — so the in-quiz questions are
> now positive, decision-shaping signals. The JSX in `code/screens/`
> (filenames `ScreenQ1Vetoes` / `ScreenQ3Distance`) still carry the v1
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
metadata (rating count / value / venue age) — *not* a fetch filter. The v1
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

3 *real* candidate venues. The member rates each 1–5 on excitement ("How
excited does this make you?"). Q5 is a **preference probe**, not a
tiebreaker — the ratings reveal how much each preference axis truly weighs.
CTA flips to **sun-yellow `"Drop the verdict"`** — the only quiz screen that
telegraphs the verdict is coming. The factorial card-generation logic and
the real-candidate wiring are specified by the v1.1 PRD (module C) and built
by issue **tb-08** — this surface section is the visual shell only.

---

## Cross-quiz invariants

- **No back arrow.** The `×` exits the session entirely. Going back after answering pollutes the preference signal. If a user mis-taps, they exit and restart. Friction is the feature.
- **Top bar progress fills first (300ms ease-out)** so users know they're on the next question before the 1.1s gradient settles.
- **Primary CTA is white-filled by default.** Q5 breaks the pattern (sun-filled) deliberately — it telegraphs commitment.
