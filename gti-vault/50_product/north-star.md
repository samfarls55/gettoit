---
title: North Star
description: Core problem, primary metric, and unfair advantage for GetToIt
type: product-vision
status: draft
created: 2026-05-08
---

# North Star

## What GetToIt is

A mobile app that kills group decision paralysis for trivial-to-mid going-out choices. The initiator starts a decision in a group chat (Partyful-style invite link), each participant answers a short fixed quiz, the app aggregates and returns a single verdict pulled from real-world options.

## Primary user pain

**Decision paralysis.** Group has rough intent ("dinner tonight") but stalls before committing. Existing tools fail in three specific ways:

- **iMessage polls** require someone to pre-curate options. That curator becomes a de-facto decider.
- **Google Maps / Yelp** is one person's screen — no shared answer, no group fairness.
- **ChatGPT** is a solo dialogue, not a community ritual.
- **Yelp roulette** exists but is buried, not viral, and friends don't use it.

Secondary pain: **group coordination friction.** Diverging preferences without a fair process to settle them.

## North-star metric

**% of verdicts followed-through.**

Definition: of decisions where a verdict was delivered, what fraction did the group actually act on (went to the place / did the activity).

Measured via lightweight post-decision check-in (e.g., next-day push: "did you go?").

Why this metric: directly tests the paralysis-kill claim. Other candidates (decisions/month, invite-acceptance rate, time-to-verdict) measure engagement or speed but can grow while real utility stays fake.

## Unfair advantage (compound moat)

Not one feature — three working together:

1. **Zero pre-curation burden.** App generates candidate options from external data per vertical (Yelp/Google/etc). Group only answers preferences, never fights over which list to vote on.
2. **Group-native invite flow.** Partyful-style link sent in group chat. Web fallback for non-installers. Viral loop built into core mechanic.
3. **Speed to verdict.** Fixed-length quiz, parallel answering, instant aggregation. Target: under 90 seconds from start to verdict.

## Stakes range

Trivial / playful. Going-out decisions: where to eat, what to do Saturday, which bar.

Out of scope: life-altering choices (career, marriage, surgery), heavy deliberation domains. The 5-question constraint and reroll mechanic would feel glib for high-stakes decisions.

## Tone

Light, fun, fast. The decision becomes a 90-second ritual the group plays together, not a chore.

## Related

- [[decision-model]] — how the mechanic works end-to-end
- [[0.1.0-scope]] — what ships first vs. deferred
- [[research-brief]] — open questions blocking the mechanic design
