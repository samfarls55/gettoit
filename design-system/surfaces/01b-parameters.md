---
surface: 01b-parameters
status: superseded
locked-date: 2026-05-15
superseded-date: 2026-05-19
superseded-by: 01-setup
jsx:
  - code/screens/ScreenParameters.jsx
---

# S01b · Pre-quiz parameters setup

> **SUPERSEDED (2026-05-19) — replaced by [[01-setup|S01 Plan setup]].** The workflow-overhaul phase collapsed [[01-initiator|S01 Initiator Landing]] + this surface into a single Plan setup screen ([[../../gti-vault/15_issues/workflow-overhaul/issues/sg-wf-1-plan-setup-surface|sg-WF-1]] / #154). The new surface carries this surface's flat eyebrow-per-control rhythm, the four chip groups, and the read-only LocationPicker echo pattern forward — with the transport-mode chip group dropped (collapsed into a distance slider per workflow-overhaul Q8). This file and `code/screens/ScreenParameters.jsx` remain in the tree until the paired iOS tracer-bullet **tb-WF-4** retires the consuming Swift code; do **not** build new features against this surface. See [[../../gti-vault/50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] for the locked decisions.

> **Code:** [`../code/screens/ScreenParameters.jsx`](../code/screens/ScreenParameters.jsx)

The session initiator sets the parameters that apply to **everyone** in the session, between the S01 share step and the start of the quiz.

This surface was added by TB-05 (v1.1) — it is the iOS home of the *parameters* bucket of the v1.1 three-bucket input model (see `gti-vault/10_prds/v1.1-quiz-redesign-prd.md`). It introduces **no new component** — the PRD module (K) note is explicit that the pre-quiz surface "consumes existing tokens and components."

## What this surface defends against

- **Joiner friction.** The five session parameters are consistent for every participant. Capturing them once, from the initiator, means a joiner never re-enters shared settings — they read the parameters off the room and go straight to the quiz.
- **Quiz pollution.** Geography, meal time, group context, service shape and transport mode are *not* per-member opinions. Mixing them into the 5-question quiz would make the quiz longer and ask each member to re-answer settings the group already agreed on.
- **Pre-commitment paralysis.** Every control opens on a sensible default. An initiator who skims the screen and taps the CTA still ships a valid session — the same "sensible default" contract S01's timer + radius controls follow.

## When it shows

After S01's CTA fires (the room exists, the share link is dropped or the solo path is taken) and **before** the quiz starts. Only the **initiator** sees it. Joiners arriving by deep link skip it entirely.

## Components used

`GradientSurface` (initiator) · `Eyebrow` · display headline · `Glass` row (geography echo) · `Chip` (C-04, single-select variant) ×4 groups · `CTADock` · `PillCTA` white.

## The five parameters

| Parameter | Control | Stored on |
|---|---|---|
| Geography | **Read-only echo** of the S01 `C-23 LocationPicker` pick — a plain glass row, not the tappable chip. The where is fixed by the time the initiator reaches S01b. | `rooms.location_*` (TB-03) |
| Meal time | Single-select chip group: `Breakfast · Lunch · Dinner · Late night`. Default `Dinner`. | `rooms.session_params` |
| Group context | Single-select chip group: `Just me · Two of us · A group`. Default `A group`. The signal is the *occasion*, not a headcount — actual group size is inferred from who accepts the invite. | `rooms.session_params` |
| Service shape | Single-select chip group: `Dine in · Outdoor seating · Takeout · Delivery`. Default `Dine in`. | `rooms.session_params` |
| Transport mode | Single-select chip group: `Walking · Driving`. Default `Walking`. Drives the *default* S01 radius — walking → 2.0 mi, driving → 5.0 mi — which the initiator can still override on the S01 slider. | `rooms.session_params` |

`rooms.session_params` is a generic `jsonb` column (`{ meal_time, group_context, service_shape, transport_mode }`), mirroring the TB-04 generic-jsonb `votes` decision so parameter content can change without a migration.

## Chip group treatment

The four chip groups are the **C-04 chip, single-select variant** — exactly the treatment S01's timer chip group uses. Selected: sun-yellow fill, ink text, `scale 1.02`, `shadow-chip-selected`. Default: glass row (white 0.04 bg, white 0.55 outline, `blur(4px)`). Tap target ≥ 48. Chips wrap to as many rows as the labels need — the four service-shape labels take two rows, the two transport labels fit one.

## Copy register

- **`"Set the ground rules"`** — plural, collaborative, present-tense. Not "Configure your session" (procedural, algorithm-tinted).
- **`"These apply to everyone. Your friends skip straight to the quiz."`** — states the parameters-bucket contract plainly: shared settings, set once.
- Section eyebrows are second-person and casual — `"When are you eating"`, `"Who's coming"`, `"How you want to eat"`, `"How you'll get there"` — never `"Meal time"` / `"Service type"` (form-field register).
- **`"Start the quiz"`** — the CTA names the next step, not the persistence action.

## Behavior

CTA → persist the four captured parameters onto `rooms.session_params` (an `UPDATE` on the room, RLS-scoped to the creator) → start the quiz. On a persistence failure the surface shows the error and stays put; the parameters bucket must not be lost on the way to the quiz.
