---
title: Research Brief — Decision Simplification
description: Open research questions blocking the 0.1.0 quiz design — frameworks, paralysis causes, group fairness. CLOSED 2026-05-08; deliverables linked below.
type: research-brief
status: closed
created: 2026-05-08
closed: 2026-05-08
deliverables:
  - "[[framework-comparison]]"
  - "[[paralysis-cause-priority]]"
  - "[[verdict-screen-spec]]"
  - "[[0.1.0-design-locks]]"
---

# Research Brief — Decision Simplification

> **Status: closed 2026-05-08.** All three priorities completed and synthesized. The four "Outputs that update the 0.1.0 design" are locked in [[0.1.0-design-locks]]. Cross-priority synthesis lives in [[framework-comparison]] (P1), [[paralysis-cause-priority]] (P2), and [[verdict-screen-spec]] (P3). Mechanical layer-1 reports in `01_raw/{decision-simplification-frameworks,paralysis-causes,group-fairness-procedural-justice}/report.md`. Original brief preserved below for archival reference.

The [[decision-model|quiz mechanic]] (exact question count, signal type, aggregation tiebreakers) is gated on this research. Goal: adapt existing decision science rather than invent from scratch.

## Priority 1 — Existing simplification frameworks

**Question:** which validated decision-simplification frameworks already exist, and which adapts cleanest to a fixed-length group quiz?

Candidates to survey:

- **WRAP** (Heath & Heath, *Decisive*) — Widen options, Reality-test, Attain distance, Prepare to be wrong.
- **Satisficing** (Simon) — pick the first option that meets a threshold rather than optimizing.
- **Elimination by aspects** (Tversky) — sequential filter on most important attribute, then next, etc.
- **Pre-mortem / regret minimization** (Kahneman, Bezos).
- **Choice architecture / nudge** (Thaler & Sunstein).
- **Maximizer vs. satisficer scale** (Schwartz, *Paradox of Choice*).

Output: a short comparison doc per framework (1 page each), then a synthesis recommending which to adopt and how to map it to a 5-ish question parallel-group quiz.

## Priority 2 — Causes of decision paralysis

**Question:** what specifically causes paralysis on trivial-to-mid going-out decisions, and which cause does the [[decision-model|quiz]] need to defuse?

Candidate causes:

- Too many options (Schwartz's "paradox of choice").
- Fear of regret / FOMO on un-chosen options.
- Misaligned preferences between participants (group-specific).
- Decision fatigue (end-of-day cognitive depletion).
- Social-friction / not wanting to impose taste on others.

Output: brief naming the 1–2 dominant causes for our use case (going-out, group, trivial-stakes) with citations. Determines whether the quiz primarily extracts constraints, mood, preferences, or veto signal.

## Priority 3 — Group fairness / procedural justice

**Question:** when a group decision goes against your preference, what makes the verdict feel fair vs. unfair? What would make a "loser" still commit?

Why it matters: [[north-star|follow-through metric]] depends on the whole group going, not just the majority. Procedural-justice research (Tyler, Lind) suggests perceived fairness predicts compliance better than outcome favorability.

Output: principles list — what the verdict screen, reroll flow, and explanation copy must do to keep dissenters bought in.

## Lower priority — quiz length validation

**Question:** is 5 the right number of questions? How does completion rate / abandonment scale with quiz length?

Defer to A/B testing post-launch. 5 is a reasonable starting bet.

## Method

- Literature scan (academic + popular). Goodreads / Google Scholar / domain-relevant blogs.
- One-page synthesis per priority into [[01_raw/_index|01_raw]] first, then `compile` into this folder once organized.
- Surface contradictions and unknowns explicitly — do not paper over them.

## Outputs that update the 0.1.0 design

When research closes:

1. Lock final quiz length (likely 4–6).
2. Lock signal type (one primary, others as sub-signals or future-version).
3. Lock tiebreaker rule for [[decision-model|aggregation]].
4. Define verdict-explanation copy framework (procedural-justice driven).

## Related

- [[north-star]]
- [[decision-model]]
- [[0.1.0-scope]]
