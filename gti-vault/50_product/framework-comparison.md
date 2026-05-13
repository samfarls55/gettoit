---
title: Framework Comparison — P1 Synthesis
description: Cross-framework synthesis of decision-simplification frameworks; locks the v1 engine as an EBA + Satisficing hybrid and assigns sub-signal roles to the rest
type: synthesis
status: closed
created: 2026-05-08
related:
  - "[[research-brief]]"
  - "[[decision-model]]"
  - "[[paralysis-cause-priority]]"
  - "[[verdict-screen-spec]]"
  - "[[v1-design-locks]]"
sources:
  - "01_raw/decision-simplification-frameworks/results/Elimination_by_Aspects.json"
  - "01_raw/decision-simplification-frameworks/results/Satisficing.json"
  - "01_raw/decision-simplification-frameworks/results/Maximizer_Satisficer_Scale.json"
  - "01_raw/decision-simplification-frameworks/results/Pre_Mortem_Regret_Minimization.json"
  - "01_raw/decision-simplification-frameworks/results/Choice_Architecture_Nudge.json"
  - "01_raw/decision-simplification-frameworks/results/WRAP.json"
  - "01_raw/decision-simplification-frameworks/report.md"
---

# Framework Comparison — P1 Synthesis

Cross-framework synthesis of the six decision-simplification frameworks surveyed in P1. Closes the [[research-brief]] question of which framework adapts cleanest to a fixed-length parallel-group quiz and what role each remaining framework plays.

## Verdict matrix

| Framework | Role in v1 | Why |
|---|---|---|
| Elimination by Aspects (Tversky 1972) | **Primary engine — pruning stage** | Sequential attribute-veto filter is the closest structural match to a 5-question quiz. Group-aggregates via union of vetoes (intersection of survivor sets), which is mathematically trivial and intuitively fair. Single verdict by construction. Empirically validated on consumer choice from large assortments. Low implementation cost. |
| Satisficing (Simon 1957) | **Primary engine — acceptance stage** | Threshold/veto per question with intersection-of-acceptable-sets aggregation. Produces a committed verdict the whole group has implicitly pre-accepted, directly serving follow-through. Quiz format is native ("max walk", "max price", "must have vegetarian"). |
| Maximizer–Satisficer Scale (Schwartz 2002) | Sub-signal — onboarding trait | Nenkov short-form 1–2 items at signup; tunes option-set size, stopping rule, and post-verdict copy per group composition. Maximizers are the follow-through-killer profile; if any group member is a maximizer, surface fewer finalists and lock harder. |
| Pre-mortem / Regret Minimization (Klein 2007; Bezos) | Sub-signal — intensity capture | Regret-of-omission slider per surviving option captures preference intensity and asymmetry that EBA's binary vetoes drop. One pre-mortem-lite "what could go wrong" multi-select can act as a soft veto channel before final lock. |
| Choice Architecture / Nudge (Thaler & Sunstein 2008) | Sub-signal — verdict-screen UX layer | No aggregation rule of its own. Defaults remain robust under publication-bias correction; broader nudge effects collapse toward null in Maier 2022 reanalysis (d ≈ 0.08 vs. Mertens 2022 d ≈ 0.43). Adopt for default-design on the verdict screen, social-proof framing of partial group answers, and friction tuning on ratification. |
| WRAP (Heath & Heath 2013) | Sub-signal — borrow tactics only | **Reject as engine.** Sequential-reflective, no aggregation rule, designed for consequential individual decisions. Borrow the premortem question and the 10/10/10 distance prompt as quiz items where they earn their slot. |

## The hybrid engine — EBA + Satisficing

The two primary candidates are not in competition. They sequence cleanly:

1. **EBA pruning stage.** Each quiz question elicits a hard constraint or veto on one attribute (allergy/dietary, hard budget cap, distance/time/open-now, cuisine veto, vibe veto). Group-level survivor set is the intersection of individual survivor sets — if any one member treats an aspect as a deal-breaker, the option is cut. Maps directly onto the [[decision-model|veto-respecting]] aggregation we already committed to.
2. **Satisficing acceptance stage.** Among survivors, the verdict is the first option that clears every member's threshold on the remaining axes. No compensatory ranking, no compromise math.

This sequencing inherits the strengths of both:

- **Single committed verdict by construction** (both frameworks produce one option, not a ranked list — directly serves [[north-star|follow-through %]]).
- **Group aggregation is set-theoretic** (union of vetoes / intersection of acceptable sets). No utility theory, no ML, no Likert calibration.
- **Procedurally legible.** The verdict screen can name the rule that cut each option (`"budget cap cut Sushi Ren; distance cut Tartine"`), which the [[verdict-screen-spec|P3 synthesis]] requires for informational justice.
- **Quiz length aligns with EBA's empirical claim** that 3–4 attributes drive a real consumer decision; a 4–5 question budget is not artificially truncated.

Source: `Elimination_by_Aspects.json` (`fit_for_fixed_length_quiz`, `aggregation_strategy`, `tiebreaker_rule_implication`); `Satisficing.json` (`aggregation_strategy`, `question_design_implications`).

## Where the hybrid leaves gaps

Three real gaps the engine does not resolve on its own. Each is closed by a sub-signal or a downstream design choice:

### Empty survivor set

Five members each contributing hard constraints can collapse the survivor set to zero. Pure EBA has no answer; Satisficing prescribes aspiration relaxation but leaves the rule unspecified.

**Resolution.** Build a relax-veto fallback. If survivors = 0 after the elimination chain, surface the most-cited veto and ask for one volunteer to flex. If still empty, widen the geographic radius. If still empty, exit with no verdict (better than a fake one). This is real engineering, not free, and must be costed into v1.

### No native tiebreaker among survivors

If survivor set has more than one option after the chain, neither framework prescribes the pick. Three candidates from `Satisficing.json` `tiebreaker_rule_implication`:

1. Random pick within survivor set (most fair, surprises the group).
2. Order by neutral signal — distance or popularity.
3. Order by a single soft preference aggregated across the group.

Recommended starting bet: **regret-of-omission scalar** (Pre-mortem sub-signal) summed across members. This uses the intensity signal EBA's binary vetoes throw away and protects the loser whose anticipated regret is highest. Falls back to random if the regret signal is flat. See [[v1-design-locks]] for the locked tiebreaker.

### Strategic gaming of thresholds

`Satisficing.json` `weaknesses_for_GetToIt`: members may state inflated thresholds to bias the outcome. EBA inherits the same risk on attribute importance.

**Resolution.** Anonymize per-member inputs in the verdict-screen receipt (members see *that* a constraint cut an option, not *who* set it) — this aligns with the [[verdict-screen-spec|aggregate-rule attribution]] rule from P3. Anti-collusion is out of v1 scope; flag as monitor-only.

## Why WRAP loses as engine

`WRAP.json` `aggregation_strategy`: "No explicit aggregation rule. WRAP assumes a final decider (individual, CEO, leader) who runs the four steps and ultimately picks."

WRAP is sequential-reflective on a single decider's timeline. GetToIt is parallel-collective on a single shared verdict. The mismatch is structural, not tunable. Borrow the premortem and 10/10/10 prompts where they earn their quiz slot; reject the framework as an engine.

## Why Nudge loses as engine

`Choice_Architecture_Nudge.json` `known_limitations`: "The framework is descriptive about 'how to design' but underspecified about how groups should aggregate preferences; it implicitly assumes a single architect and a single chooser."

Nudge has no aggregation rule. Effect sizes outside defaults collapse under publication-bias correction (`empirical_support`: Maier 2022 d ≈ 0.08; Hu 2025 second-order meta-analysis directionally similar). Adopt as verdict-screen UX layer where defaults still earn their evidence; do not let it carry the verdict.

## Maximizer trait — why it earns sub-signal status

`Maximizer_Satisficer_Scale.json` `strengths_for_GetToIt`: "The maximizer trait is essentially a follow-through-killer profile: maximizers reopen decisions, second-guess, and suffer post-decision regret, all of which reduce 'whole group commits.'"

Trait moderates how aggressively the engine prunes and how firmly the verdict locks:

- **Group with ≥1 maximizer** → tighter survivor caps (≤2 finalists), harder ratification copy ("no take-backs"), reroll cap reduced.
- **All-satisficer group** → more relaxed defaults, friendlier reroll affordance.

Cost: one onboarding screen with 2–6 Likert items (Nenkov short-form), stored on the user. Data instrumented from day one even if the moderator effect is wired in v1.1.

## Pre-mortem — earned slots in the quiz

Two specific items survive into v1 candidate quiz designs:

1. **Regret-of-omission slider** — one item per surviving option (post-pruning), used as the satisficing tiebreaker scalar. Captures intensity EBA's binary vetoes drop.
2. **Pre-mortem-lite multi-select** — "what could go wrong with this pick?" with vertical-specific options (loud, slow, expensive surprise, dietary risk). Acts as a final soft-veto channel before ratification, and feeds the reroll taxonomy if the verdict is rejected.

These are conditional slots — earned only if v1 quiz length budget allows after the EBA elimination chain claims its 3–4 questions. See [[v1-design-locks]] for the final allocation.

## What this synthesis closes

- **Engine identity:** EBA (pruning) + Satisficing (acceptance), sequenced.
- **Aggregation rule:** intersection of survivor sets / union of vetoes — locks the [[decision-model|veto-respecting]] philosophy as the primary mechanic, not the secondary.
- **Sub-signal roster:** Maximizer trait (onboarding moderator), regret-of-omission (tiebreaker scalar), pre-mortem-lite (final soft-veto), nudge defaults (verdict-screen UX).
- **Rejected as engine, retained as tactics:** WRAP, Nudge.

Tiebreaker rule, exact quiz length, and signal type lock in [[v1-design-locks]]. Verdict-screen copy framework locks in [[verdict-screen-spec]] (P3-driven, references this doc for the rule the screen names).

## Open questions deferred past v1

- Whether anti-collusion / strategic-threshold detection is needed at the scale we ship at. Monitor only.
- Empty-survivor-set relaxation UX. Engineering ticket, not a research question.
- Whether the regret-of-omission scalar outperforms random pick on follow-through. A/B test post-launch.
