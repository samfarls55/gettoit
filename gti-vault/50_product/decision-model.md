---
title: Decision Model
description: End-to-end flow of a group decision — invite, quiz, aggregation, verdict, recovery
type: product-vision
status: draft
created: 2026-05-08
---

# Decision Model

How a single group decision flows end-to-end. The mechanic-level details below (quiz length, signal type, aggregation, tiebreaker) were locked 2026-05-08 in [[0.1.0-design-locks]] and amended for 0.1.0 in [[0.1.0-quiz-amendments]] — those two docs are the source of truth for the mechanics; this doc records the flow.

## Flow at a glance

1. **Initiator** opens app, picks vertical (food / activities / bars), starts a decision.
2. App generates an **invite link**. Initiator drops it in a group chat (iMessage / WhatsApp / etc).
3. **Invitees** open link. Web fallback works for non-installers; native app preferred.
4. Each participant answers a fixed-length quiz (5 questions — [[0.1.0-design-locks]] Lock 1).
5. App pulls candidate options from **external data** for the chosen vertical.
6. App aggregates answers, filters and ranks options, returns a **single verdict**.
7. Group sees verdict. They either commit, or trigger a **reroll-with-reason**.
8. Post-decision: lightweight **follow-through check-in** the next day.

## Mode

**Group-first.** Solo flow exists as a fallback (single participant, same quiz, no aggregation) but is not the hero use case. Marketing, onboarding, and 0.1.0 design lead with group.

## The quiz

- Length: 5 questions, locked in [[0.1.0-design-locks]] Lock 1. Re-evaluate after the first beta cohort.
- Signal type, locked in [[0.1.0-design-locks]] Lock 2: hard vetoes / constraints (primary) → cardinal preference intensity on one axis (secondary) → commitment lock (tertiary).
- **0.1.0 amendment** ([[0.1.0-quiz-amendments]]): the question set was redesigned into a three-bucket input model (profile / parameters / questions). The five questions are now cuisine craving, spend cap, reputation/discovery, vibe energy, and a Q5 preference probe over real candidate venues. Q5's role shifted from "tiebreaker scalar" to "preference probe."
- Aggregation philosophy locks the question design: questions must elicit BOTH dealbreakers AND preferences (see Aggregation below).

## Option source

External data per vertical. App never asks the group to supply candidates — it generates them. This is core to the [[north-star|zero-pre-curation moat]].

Each vertical = its own integration:

- Food → Yelp / Google Places
- Activities → fragmented (Eventbrite + Google + curated lists) — hardest data layer
- Bars → similar to food

## Aggregation

**Veto-respecting + satisficing, with a worst-off-protecting tiebreak.** Locked in [[0.1.0-design-locks]] Lock 3; realized for 0.1.0 per [[0.1.0-quiz-amendments]] §4 and [[60_engineering/adr/0011-worst-off-protecting-verdict-engine|ADR 0011]].

1. **EBA prune** — hard-no signals from any participant filter the candidate pool (dietary, budget cap, cuisine NEVERS).
2. **Satisficing floor** — among survivors, keep options every member scores at or above an acceptability threshold.
3. **Maximin tiebreak** — pick the option with the best worst-case (highest minimum) member score, protecting the worst-off member. Not a majority or sum vote: a polarizing higher-sum pick loses to a worst-off-protecting one.

Why this philosophy: matches how real groups actually decide — dealbreakers come first, taste second — and a worst-off-protecting tiebreak prevents the quiet-defection backfire a majority/sum rule invites. Defensible when the verdict is explained.

## Output

**Single verdict + reroll.**

- App returns one option, not a ranked list. Listing reintroduces the choice problem we are solving.
- "Reroll" button presents next-best, but with a tax (see Failure recovery).
- Verdict may include light reasoning ("3/4 wanted comfort food, under $30, walking distance") for trust — to be tested against pure-verdict baseline.

## Failure recovery

**Reroll asks why.** No silent rerolls.

- On reroll, group selects a reason from a vertical-specific taxonomy (cost / distance / mood / dietary / availability / other).
- Reason becomes a new constraint feeding the next pick.
- Cap: ~3 rerolls per decision. After cap, app forces commit OR exits with no verdict. Cap is tunable but exists to prevent paralysis sneaking back in slot-machine costume.

This turns rejection into signal, feeds future preference learning (see [[0.1.0-scope]] memory deferral), and prevents reroll spirals.

## Group memory

- Persistent groups were **cut from 0.1.0** ([[0.1.0-design-locks]] §"Resolved 2026-05-12"). The group-chat thread the invite link is dropped into is the persistent group; there is no in-app "Friday crew" or one-tap re-invite.
- Decision history is **backend-only** in 0.1.0 — recorded for future preference learning, but with no UI surface.
- Aspirational endpoint: full per-user and per-group preference learning. Out of 0.1.0 scope — see [[0.1.0-scope]].

## Verification

Post-decision check-in is part of the model, not a bolt-on. Without it, the [[north-star|follow-through metric]] is unmeasurable.

- Trigger: 12–24 hours after verdict delivered.
- Lightweight: single-tap thumbs-up (went) / thumbs-down (skipped) / snooze.
- Optional second tap on skip: why didn't you go? — feeds rejection taxonomy.

## Related

- [[north-star]]
- [[0.1.0-scope]]
- [[research-brief]]
