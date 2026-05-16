---
title: Frontend Design Brief — GetToIt v1
description: One-page brief for kicking off frontend design exploration. Concept, key screens, voice, must-haves, anti-patterns.
type: brief
status: superseded
created: 2026-05-08
related:
  - "[[50_product/north-star]]"
  - "[[50_product/decision-model]]"
  - "[[50_product/v1-design-locks]]"
  - "[[50_product/verdict-screen-spec]]"
---

# Frontend Design Brief — GetToIt v1

> **Superseded — design exploration archived.** The design work this brief kicked off shipped as the `design-system/` package (Sunset Pop). Kept as a historical record of the kickoff brief.

## What it is

**GetToIt** is a mobile-first app that kills group decision paralysis for trivial-to-mid going-out choices. v1 ships the **food vertical only**: a group decides where to eat in under 90 seconds.

The pitch in one line: *drop a link in the group chat, everyone answers 5 quick questions, app returns a single verdict everyone can live with.*

## Why it exists

Group chats stall on "where should we eat?" because nobody wants to be the decider, ranked lists reignite the fight, and dealbreakers (allergies, budget, distance) get lost in the noise. GetToIt removes the human decider — the rule + the inputs are the decider — and surfaces a verdict the group commits to.

**North-star metric:** % of verdicts the group actually follows through on (measured via a next-day check-in).

## Who uses it

Friend groups, couples, small co-worker crews — 2–8 people, lateral relationships (no boss / no host). Phone-first, often at the end of a workday. Use happens in <60s windows between other things.

## The flow (7 surfaces to design)

1. **Initiator landing** — pick vertical (food only in v1), start a decision, generate share link.
2. **Invite hand-off** — link unfurl in iMessage / WhatsApp / etc. Web fallback for non-installers.
3. **Quiz** — 5 fixed questions, ~10s each. Q1–Q3 hard vetoes (diet, budget, logistics). Q4 cardinal vibe/cuisine axis. Q5 regret-of-omission tiebreaker. Mobile-native, one decision per screen.
4. **Waiting / coordination state** — invitees still answering. Honest, calm, no anxiety.
5. **Verdict screen** — the hero surface. One option. Where + when + who. Rule chip. Voice-receipt row. Eliminated-options drawer (collapsed). "I'm in" ratification with mutual-state visibility. Time-boxed correctability window.
6. **Reroll-with-reason** — capped at ~3. Reason taxonomy (cost / distance / mood / diet / availability). Friction is the feature.
7. **Next-day check-in** — single-tap thumbs-up / thumbs-down / snooze. Feeds the north-star metric.

## Voice & register

**Warm friend, not court formal. Aggregate rule, not personal blame.**

- ✅ "Budget cap cut Sushi Ren."
- ❌ "Alex said no to Sushi Ren."
- ✅ "We're at Pico's at 7. Three of you are in."
- ❌ "The algorithm picked Pico's."
- ✅ "I'm in." (commitment, voluntary register)
- ❌ "Confirm." / "Accept." (coercive, reactance lever)

Distribution rule: **NEED-then-EQUALITY** — hard constraints prune visibly, soft preferences balance invisibly across sessions. **Never EQUITY** — no "your turn", no win-counts, no exchange-relationship framing.

## Must-haves on the verdict screen (locked)

1. The verdict — option name + implementation intention (where + when + who).
2. Rule chip — one-sentence aggregate-rule attribution. Tappable for detail.
3. Voice-receipt row — anonymized per-member input chip.
4. Eliminated-options drawer — collapsed by default.
5. "I'm in" ratification — voluntary, mutual-state visible.
6. Correctability window — 30–90s, time-boxed, then hard-close.
7. Hard-close artifact — the screen visibly closes after ratification.

## Anti-patterns (do not design these)

- Ranked lists or "top 3" reveals — re-imports the choice problem we just solved.
- Per-member vote tallies on the verdict screen — converts communal frame into exchange.
- "Your turn" / "you got your way last time" copy — equity register, breaks group trust.
- Slot-machine reroll mechanics — paralysis sneaking back in.
- Maximizer scaffolding — Likert-rate-each-option, pairwise comparisons, open-text inputs.

## Brand-feel cues for the design session

- Speed and finality. The app's job is to *end* the conversation, not enrich it.
- Lateral / friendly. Not authoritative. Not corporate.
- Honest mechanics. Members can audit the rule that produced the verdict.
- Calm under time pressure. End-of-workday users, decision-fatigued.

## What designers should produce

Visual directions for: invite unfurl, quiz screens (with progress), waiting state, verdict screen, reroll dialog, check-in. Color, type, motion language, illustration / iconography stance, empty + error states.

## Open questions to flag during the session

- Warm-friend vs court-formal register — A/B post-launch, but pick a starting tone.
- Whether the cardinal Q4 axis is cuisine, vibe, or energy — vertical-specific, copy-driven.
- Logo / wordmark — not yet defined.

## Anchor docs

- [[50_product/north-star]] — problem, metric, moat.
- [[50_product/decision-model]] — full end-to-end flow.
- [[50_product/v1-design-locks]] — the four locked design decisions, with rationale.
- [[50_product/verdict-screen-spec]] — verdict-screen synthesis (7 elements, 8 prescriptions).
