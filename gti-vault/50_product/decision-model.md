---
title: Decision Model
description: End-to-end flow of a group decision — invite, quiz, aggregation, verdict, recovery
type: product-vision
status: draft
created: 2026-05-08
---

# Decision Model

How a single group decision flows end-to-end. Mechanic-level details (exact question content, signal type) are gated on research — see [[research-brief]].

## Flow at a glance

1. **Initiator** opens app, picks vertical (food / activities / bars), starts a decision.
2. App generates an **invite link**. Initiator drops it in a group chat (iMessage / WhatsApp / etc).
3. **Invitees** open link. Web fallback works for non-installers; native app preferred.
4. Each participant answers a fixed-length quiz (provisional: 5 questions).
5. App pulls candidate options from **external data** for the chosen vertical.
6. App aggregates answers, filters and ranks options, returns a **single verdict**.
7. Group sees verdict. They either commit, or trigger a **reroll-with-reason**.
8. Post-decision: lightweight **follow-through check-in** the next day.

## Mode

**Group-first.** Solo flow exists as a fallback (single participant, same quiz, no aggregation) but is not the hero use case. Marketing, onboarding, and v1 design lead with group.

## The quiz

- Length: provisional 5 questions. Final count TBD pending [[research-brief|research]] on cognitive load and existing simplification frameworks.
- Signal extracted: TBD pending research. Candidate signal types under evaluation:
	- Constraint / hard filter (dietary, budget, distance)
	- Mood / vibe state (energy, adventurous vs. comfort)
	- Forced trade-off preferences (cheap vs. close, new vs. reliable)
	- Veto map (each person's hard-no's + soft-yeses)
- Aggregation philosophy locks the question design: questions must elicit BOTH dealbreakers AND preferences (see Aggregation below).

## Option source

External data per vertical. App never asks the group to supply candidates — it generates them. This is core to the [[north-star|zero-pre-curation moat]].

Each vertical = its own integration:

- Food → Yelp / Google Places
- Activities → fragmented (Eventbrite + Google + curated lists) — hardest data layer
- Bars → similar to food

## Aggregation

**Veto-respecting + majority.**

1. Hard-no signals from any participant filter the candidate pool (e.g., "no spicy" eliminates spicy options).
2. Among surviving options, majority preference wins.
3. Tiebreakers: TBD pending research on group fairness / procedural justice.

Why this philosophy: matches how real groups actually decide — dealbreakers come first, taste second. Defensible when verdict is explained.

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

This turns rejection into signal, feeds future preference learning (see [[v1-scope]] memory deferral), and prevents reroll spirals.

## Group memory

- v1: app remembers persistent groups ("Friday crew") + decision history. One-tap re-invite same group.
- v1 instruments preference data for future ML.
- Aspirational endpoint: full per-user and per-group preference learning. Out of v1 scope — see [[v1-scope]].

## Verification

Post-decision check-in is part of the model, not a bolt-on. Without it, the [[north-star|follow-through metric]] is unmeasurable.

- Trigger: 12–24 hours after verdict delivered.
- Lightweight: single-tap thumbs-up (went) / thumbs-down (skipped) / snooze.
- Optional second tap on skip: why didn't you go? — feeds rejection taxonomy.

## Related

- [[north-star]]
- [[v1-scope]]
- [[research-brief]]
