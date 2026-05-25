---
title: Paralysis-Cause Priority — P2 Synthesis
description: Cross-cause synthesis of decision-paralysis drivers; ranks causes for 0.1.0 defuse, separates state-multipliers from causes, maps each to a quiz mechanic
type: synthesis
status: closed
created: 2026-05-08
related:
  - "[[research-brief]]"
  - "[[decision-model]]"
  - "[[framework-comparison]]"
  - "[[verdict-screen-spec]]"
  - "[[0.1.0-design-locks]]"
sources:
  - "01_raw/paralysis-causes/results/Misaligned_Preferences.json"
  - "01_raw/paralysis-causes/results/Social_Friction.json"
  - "01_raw/paralysis-causes/results/Fear_of_Regret_FOMO.json"
  - "01_raw/paralysis-causes/results/Paradox_of_Choice.json"
  - "01_raw/paralysis-causes/results/Cognitive_Load.json"
  - "01_raw/paralysis-causes/results/Decision_Fatigue.json"
  - "01_raw/paralysis-causes/report.md"
---

# Paralysis-Cause Priority — P2 Synthesis

Cross-cause synthesis of the six paralysis drivers surveyed in P2. Closes the [[research-brief]] question of which cause(s) the [[decision-model|quiz]] must primarily defuse for GetToIt's specific regime: 2–6 friends, mid-stakes, food vertical, often end-of-workday timing.

## Verdict matrix

| Cause | Role in 0.1.0 | Dominance | What the quiz must do |
|---|---|---|---|
| Misaligned Preferences (Arrow / social choice) | **Primary defuse** | High | Parallel private input + cardinal preference intensity + score-based aggregation that mathematically evades Arrow (range/score voting). |
| Social Friction (face-work / taste-imposition aversion) | **Primary defuse** | High | Anonymous parallel input + single aggregated verdict (no individual-vote reveal) + responsibility laundering through the algorithm. |
| Anticipated Regret / FOMO | **Primary defuse** | High | Option compression (one verdict, foregone options not displayed) + responsibility laundering + irreversibility framing + pre-commitment ratification. |
| Paradox of Choice / Choice Overload | **Primary defuse** | Medium-high | Aggressive option-space compression to 3–5 finalists, hidden option set during quiz, single verdict output, hard constraints prune before preferences. |
| Cognitive Load / Working memory | **Architectural primary** (design constraint) | Medium-high (proximal contributor in nearly every episode) | Treat as a constant constraint on every UX decision: option count, question count, question form, UI density. Not a content target. |
| Decision Fatigue / Ego Depletion | **State-multiplier**, not standalone cause | Mechanism ≈ 0 in post-2020 replications; phenomenology real | Veto-first questions, low-effort UX, single verdict, fast commit window. Respect the state, do not try to debunk it via quiz content. |

## Why this ranking — the dominance argument

The handoff already committed to the four primary causes; the synthesis defends the ordering against the temptation to flatten them into a single bucket.

### Misaligned Preferences is the structural floor

Arrow (1951) is the only cause on the list that is *intrinsically group-defined* — it requires ≥2 differing agents. Solo-decision paralysis frames (Schwartz, Cognitive Load) do not apply to GetToIt's [[north-star|group-first positioning]]. From `Misaligned_Preferences.json` `dominance_estimate`:

> "For groups of 3+ with mixed cuisine preferences and no clear organizer, misaligned preferences is plausibly the single dominant cause of food-decision paralysis — more dominant than choice overload (which targets solo deciders) or decision fatigue (which afflicts any decider)."

If the quiz solves only one cause, this is the cause. The chosen aggregation (intersection of survivor sets / range-style scoring on survivors) defeats Arrow's impossibility through cardinal information rather than ordinal — precisely the workaround `Misaligned_Preferences.json` `signal_to_extract` prescribes.

### Social Friction is the use-case-specific cause

The "where do you wanna eat? / I don't care, you pick" loop is *literally* this construct's signature. From `Social_Friction.json` `dominance_estimate`:

> "the canonical 'where do you want to eat?' / 'I don't know, you pick' loop is precisely this construct."

It directly threatens [[north-star|follow-through]] via the Kim et al. 2023 backfire mechanism: members who under-report constraints publicly defect post-verdict when the constraint surfaces.

The mitigation (parallel private input + algorithm-as-decider + single aggregated verdict) is **the same mitigation that defeats Misaligned Preferences**. The two causes share a single architectural defuse — which is why both can be primary without forcing trade-offs in the quiz design.

### Fear of Regret / FOMO closes the agree-but-don't-commit gap

The strongest meta-analytic effect among the six. From `Fear_of_Regret_FOMO.json` `dominance_estimate` (uncertain marker on exact size, included verbatim only as quoted evidence):

> "Brewer 2016 r+=.50 for intentions, Sandberg & Conner 2008 ~7% incremental variance"

Plus `White et al. groups defer 3.5× more than individuals` — the group-amplification multiplier is the specific reason this cause matters more for GetToIt than for a solo-decision app. It explains the gap between *agreed verdicts* and *followed-through verdicts*: the group converges, then somebody defects on the way to the door because the un-chosen option becomes salient post-decision.

The defuse is the verdict-screen UX, not the quiz content: **don't show the foregone options at commit time**. See [[verdict-screen-spec]] for the loser-targeted copy framework that addresses the regret directly.

### Paradox of Choice is real but secondary in this regime

Schwartz-style choice overload effect is contested at the broad level (`Paradox_of_Choice.json` references the meta-analytic noise) but GetToIt's parameter space is the worst-case moderator zone: large option sets (every restaurant in a city), high attribute count per option, time pressure. The product's core mechanic *is* a choice-overload defuser — option compression to 3–5 finalists, hidden option set during the quiz, single-verdict output. Designing against this cause is not optional, but it does not require a dedicated *signal* — the engine architecture already does the work.

### Cognitive Load is architectural, not content

`Cognitive_Load.json` `priority_for_v1` makes the framing precise:

> "Cognitive load is not the headline narrative cause but it sets the ceiling on what the quiz mechanic can do; every product decision (option count, question count, question form, UI density) is a cognitive-load decision."

Not something the quiz extracts a signal *for*; something every UX decision is constrained *by*. Concretely: 4–5 question budget (Cowan ~4-chunk capacity), one decision per question, no Likert-rating sliders that ask the chooser to hold multiple options simultaneously, no scrolling option lists.

### Decision Fatigue is state, not cause

`Decision_Fatigue.json` `priority_for_v1`: "Secondary defuse target — frame as a state/context the quiz must respect." The post-2020 replication record is decisive — Vohs 2021 (36 labs, Bayesian 4:1 null), Lindh 2025 (BF₀+ > 22 null), Inzlicht 2021 motivation/attention reframe. Phenomenology is real (people *feel* depleted at end of workday), mechanism is wrong (the construct does not predict performance after controlling for motivation/attention).

Implication: do not build a feature that "remediates" fatigue. Build for the timing instead: short quiz, low effort per question, single-verdict output, fast commit. From `Decision_Fatigue.json` `dependency_on_other_causes`:

> "Acts as a state-multiplier rather than an independent cause. Amplifies: Social Friction, Misaligned Preferences, Choice Overload, Cognitive Load."

Treat as the multiplier on whichever cause is actually dominant in the session.

## Cause → mechanic map

The full mapping the quiz design must satisfy:

| Cause | Quiz mechanic |
|---|---|
| Misaligned Preferences | Parallel private input. Cardinal preference intensity (not ordinal ranking) on at least one axis. Score-based aggregation across survivors. |
| Social Friction | Same parallel private input. Verdict screen surfaces aggregated verdict, not per-member votes. Algorithm framed as decider in copy. |
| Anticipated Regret | One-verdict output (no top-3). Foregone options not shown at commit. Pre-commitment ratification ("I'm in") before reveal. |
| Choice Overload | Option compression to 3–5 finalists before any preference question. Hidden option set during quiz. Hard constraints prune before preferences. |
| Cognitive Load | 4–5 question budget. One decision per question. No multi-option simultaneous comparison. UI density bounded. |
| Decision Fatigue | Total quiz under 60–90 seconds. Veto-first questions (lower cognitive cost than preferences). Smart default if signal is weak. Single verdict, hard close. |

The mechanics overlap heavily. Three observations:

1. **Parallel private input** defuses both Misaligned Preferences and Social Friction simultaneously. One mechanic, two causes.
2. **Option compression + single verdict** defuses Anticipated Regret, Choice Overload, and Cognitive Load simultaneously. One architectural decision, three causes.
3. **The [[framework-comparison|EBA + Satisficing engine]]** is the natural carrier of veto-first / threshold-first questions, which is what Decision Fatigue's state-multiplier role recommends.

The four "primary defuse" causes do not pull in different directions. They converge on the same quiz architecture.

## What this synthesis closes

- **Cause hierarchy is locked.** Four primary defuses (Misaligned Preferences, Social Friction, Fear of Regret, Choice Overload) + one architectural primary (Cognitive Load) + one state-multiplier (Decision Fatigue).
- **Signal type the quiz extracts** falls out of this: constraints/vetoes (defeats overload + regret + fatigue) → cardinal preference intensity on one axis (defeats misalignment + arrow) → commitment lock (defeats regret + fatigue residual). See [[0.1.0-design-locks]] for the exact lock.
- **Decision Fatigue is not a feature target.** No "tired-mode" UI. The whole product respects the state by default.
- **Cognitive Load is a constraint, not a target.** Every quiz design choice gets cost-checked against the 4-chunk ceiling.

## Open boundary conditions to flag

- **Group-level Decision Fatigue.** Genuine literature gap (`Decision_Fatigue.json` `known_limitations`). The construct's evidence base is individual; whether groups exhibit collective fatigue at the same threshold is not resolved. Don't claim more than the evidence supports in product copy.
- **Choice-overload moderator zone.** Schwartz-style effect is contested at the broad level. GetToIt sits in the worst-case zone (large set, high attribute count, time pressure) so we are designing against a real-in-our-regime effect, not a universal one. Re-evaluate post-launch with cohort data.
- **Pluralistic ignorance vs Social Friction overlap.** Some literature treats them as a single family (Frontiers 2023 century review per `Social_Friction.json`). Distinction does not change the 0.1.0 defuse but matters if we measure post-launch.
