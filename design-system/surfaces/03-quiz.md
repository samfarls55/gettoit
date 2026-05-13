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

## Q1 — Vetoes (multi-select chips)

EBA veto, multi-select. Gradient: `q1` (coral → yellow).

**Options (v1, food vertical):** `Gluten · Dairy · Shellfish · Needs vegan options · Halal-only · Nothing tonight`

**Rule:** `"Nothing tonight"` is mutually exclusive — selecting it clears all others; selecting any other clears it.

**Anonymization:** chip labels are private to the user. The verdict's voice receipts can name the **constraint** (`"alex filtered shellfish"`) but never the **condition** (`"alex has a shellfish allergy"`).

---

## Q2 — Budget cap (single-select tier)

EBA veto threshold, single-select. Gradient: `q2`.

**4 fixed tiers, never a slider.** Slider creates per-user exact numbers that produce information asymmetry ("Maya said $34") and don't survive the rule chip cleanly. Tiers normalize to 4 categories everyone uses.

---

## Q3 — Logistics (walk time)

EBA veto threshold with display readout. Gradient: `q3`.

**Stops:** 5 / 10 / 15 / 20 / 30 minutes. Default: 15.

The chosen number is rendered at display-xl scale (100px) — this rehearses the constraint in the user's head. They're explicitly setting the boundary, not picking abstractly.

---

## Q4 — Vibe (cardinal scalar)

Cardinal scalar on low-key ↔ lively axis. Gradient: `q4` (indigo).

**Canonical vocabulary** (in `VIBE_LABELS`): `HUSHED · MELLOW · BUZZY · LOUD · ROWDY`.

The huge live word at the center is the system saying "yes, this is your vibe." Small text would invite second-guessing.

**Why no drag handle:** Q4 is cardinal-scalar, not interpolatable. Tapping a stop is canonical. A drag handle invites users to land between stops, which the regret math can't use.

---

## Q5 — Regret rater (3 cards × 5 buttons)

**The only surface in the system where multi-option rating is permitted.** Gradient: `q5` (midnight).

3 candidates — survivors of EBA + scalar filtering. User rates regret-of-omission per card. CTA flips to **sun-yellow `"Drop the verdict"`** — the only quiz screen that telegraphs the verdict is coming.

If usability testing shows this surface is the longest in the flow, try compressing to 2 cards (top 2 candidates by aggregate vibe match). Don't reduce to 1 (then the tiebreaker is moot).

---

## Cross-quiz invariants

- **No back arrow.** The `×` exits the session entirely. Going back after answering pollutes regret math. If a user mis-taps, they exit and restart. Friction is the feature.
- **Top bar progress fills first (300ms ease-out)** so users know they're on the next question before the 1.1s gradient settles.
- **Primary CTA is white-filled by default.** Q5 breaks the pattern (sun-filled) deliberately — it telegraphs commitment.
