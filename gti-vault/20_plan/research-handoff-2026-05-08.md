---
title: Research Handoff — Decision Simplification (P1 + P2 + P3 complete)
description: Superseded 2026-05-08. Decision-simplification research is closed; 0.1.0 design locks shipped to 50_product/.
type: handoff
status: superseded
superseded_by: "[[50_product/0.1.0-design-locks]]"
created: 2026-05-08
updated: 2026-05-08
closed: 2026-05-08
related:
  - "[[50_product/research-brief]]"
  - "[[50_product/0.1.0-design-locks]]"
  - "[[50_product/framework-comparison]]"
  - "[[50_product/paralysis-cause-priority]]"
  - "[[50_product/verdict-screen-spec]]"
  - "[[50_product/decision-model]]"
  - "[[50_product/north-star]]"
  - "[[50_product/0.1.0-scope]]"
---

> **Superseded 2026-05-08.** Synthesis is closed. The four 0.1.0 design lock-ins live in [[50_product/0.1.0-design-locks]]; cross-priority syntheses live in [[50_product/framework-comparison]], [[50_product/paralysis-cause-priority]], and [[50_product/verdict-screen-spec]]. Mechanical layer-1 reports remain at `01_raw/*/report.md`. The body below is preserved for archival reference of the pre-synthesis state.


# Research Handoff — 2026-05-08 (post-P3)

All three priorities in `[[50_product/research-brief]]` are complete. 19 raw research JSONs validated 100% coverage. Only synthesis remains.

## Project context (one paragraph)

GetToIt is a group decision-paralysis killer. 0.1.0 ships food vertical only, no ML. Use case is 2–6 friends deciding where to eat / what to do, often end-of-workday timing, mid-stakes social decision. The product runs a short (~5 question) parallel quiz per member and produces a single committed verdict the whole group commits to. The north-star metric is verdicts followed-through (whole group shows up), not just majority agreement. The quiz mechanic — exact question count, signal type, aggregation tiebreaker, verdict-screen copy — is gated on the research described below.

## Status

- **Priority 1 (frameworks)**: complete. 6 frameworks, all validated 100%.
- **Priority 2 (paralysis causes)**: complete. 6 causes, all validated 100%. Three (Decision_Fatigue, Fear_of_Regret_FOMO, Social_Friction) re-run 2026-05-08 with WebSearch evidence — uncertain markers reduced from 3/6/3 → 1/1/1.
- **Priority 3 (group fairness / procedural justice)**: complete (2026-05-08). 7 constructs, all validated 100%.
- **Synthesis / compile to `50_product/`**: not started. **This is the next move.**

## P1 outputs — `01_raw/decision-simplification-frameworks/`

`outline.yaml`, `fields.yaml`, `results/*.json` (6 files).

| Framework | Verdict | Note |
|---|---|---|
| Elimination_by_Aspects | **primary candidate** | Sequential filter ↔ 5-Q chain. Veto-union for hard constraints. Single verdict by construction. |
| Satisficing | **primary candidate** | Threshold/veto per Q. Intersection of acceptable sets → pre-accepted verdict. |
| Maximizer_Satisficer_Scale | secondary / sub-signal | Trait diagnostic. Onboarding 1–2 item Nenkov short-form to tune option-set size + stopping rule + post-verdict copy. |
| Pre_Mortem_Regret_Minimization | secondary / sub-signal | Regret-of-omission slider per option captures preference intensity + asymmetry. |
| Choice_Architecture_Nudge | secondary / sub-signal | Verdict-screen UX layer. Effect contested (Mertens 2022 d=0.43 vs Maier/Hu post-2022 ~0). Defaults still robust. |
| WRAP | secondary / sub-signal | Adapt premortem and 10/10/10 distance step as quiz items. Reject as engine — sequential reflective, no aggregation. |

EBA + Satisficing hybrid is the working 0.1.0 engine: EBA-style attribute-veto pruning followed by Satisficing-style threshold acceptance.

## P2 outputs — `01_raw/paralysis-causes/`

`outline.yaml`, `fields.yaml`, `results/*.json` (6 files).

| Cause | Dominance | Priority | Role |
|---|---|---|---|
| Misaligned_Preferences | high | **primary** | Only intrinsically group-defined cause (Arrow needs ≥2 differing agents). |
| Social_Friction | high | **primary** | "Where do you wanna eat?" / "I don't care, you pick" loop. Bond 2005 conformity d=0.89, Lu/Yuan/McLeod 2012 hidden-profile d≈1.38, Kim et al. 2023 no-preference backfire experiments. |
| Fear_of_Regret_FOMO | high | **primary** | Brewer et al. 2016 meta-analysis k=81 r+=.50 intentions / .29 behavior. Han et al. 2023 status-quo g=−0.45. White et al. groups defer 3.5× more than individuals. Explains agree-but-don't-commit gap. |
| Paradox_of_Choice | medium-high | **primary** | Effect real only under moderators; GetToIt sits in worst-case moderator zone. |
| Cognitive_Load | medium-high | **architectural primary** | Treat as constant design constraint. Every option count, Q count, UI density choice is a load decision. |
| Decision_Fatigue | (mechanism ≈ 0) | **state-multiplier** | Vohs 2021 (36 labs, Bayesian 4:1 null), Lindh 2025 (BF₀+ > 22 null), Inzlicht 2021 motivation/attention reframe now dominant. Phenomenology real, mechanism wrong. Use to shape quiz form, not content. |

## P3 outputs — `01_raw/group-fairness-procedural-justice/`

`outline.yaml`, `fields.yaml`, `results/*.json` (7 files). Generated 2026-05-08 with WebSearch enabled.

| Construct | Verdict | Mechanism / Note |
|---|---|---|
| Tyler_Group_Value_Model | **must-have** | Relational signals (respect, neutrality, trustworthy motives) drive acceptance independent of outcome. Boundary: hierarchical-authority literature, lateral friend-group is extrapolation. |
| Voice_Effect | **must-have** | Quiz IS structured voice. Verdict screen must visibly receipt each member's inputs (value-expressive channel). Mute-effect is worst case — never receipt some without others. Avoid post-decisional voice (backfires). |
| Leventhal_Six_Rules | should-have | Checklist: consistency, bias-suppression, accuracy, correctability, representativeness, ethicality. Correctability tensions the "hard close / no re-open" P2 prescription — resolve via friction-bearing quorum-redo, not free re-open. |
| Outcome_Favorability_Interaction | **must-have** | Brockner & Wiesenfeld 1996 meta-analysis (45 samples). Procedural justice matters MOST when outcome unfavorable — directly addresses the loser, the rate-limiting step in every n>1 group decision. Skitka & Mullen moral-mandate boundary: dietary/allergy constraints must be upstream hard filters, never preferences that can lose. |
| Informational_Justice_Explanation | **must-have** | Shaw, Wild & Colquitt 2003 meta-analysis (54 samples) ~43% retaliation reduction. Colquitt 2013 ρ=−.29 with counterproductive behaviors. Default to **aggregate-rule attribution** ("budget constraint cut Sushi") over **personal-causal attribution** ("Alex said no") in friend-group register. EBA's elimination chain is structurally near-free explanation material. |
| Public_Commitment_Ratification | **must-have** | Empirically supported 0.1.0 stack: pre-commit ratification + mutual-state visibility + hard close + if-then specification. Gollwitzer & Sheeran 2006 implementation-intention d≈0.65; Rogers/Milkman 2014 commitment device g≈0.68; Lewin housewives ~5× adoption vs lecture. Watch reactance — button must feel optional. |
| Distributive_Justice_Equity | **must-have** | NEED-then-EQUALITY hybrid. Hard-constraint vetoes (need rule) prune option space first; equality-balanced selection across sessions; **never EQUITY** (no win-counts, no "your turn" copy) — equity converts communal relationship to exchange relationship (Clark & Mills 1979) in friend-group solidarity context (Deutsch 1975). EBA's veto-first design natively implements need rule. |

## Convergent verdict-screen prescriptions (P3 cross-construct)

Strong signal, multiple constructs:

1. **Receipt member inputs explicitly** (Voice, Tyler, Informational Justice). Show what each member said. Anonymized if necessary, never silent.
2. **Name the rule, not the picker** (Informational Justice, Distributive Justice, Tyler). Aggregate-rule attribution; algorithm as decider.
3. **Pre-commit ratification with hard close** (Public Commitment, Outcome Favorability, Fear_of_Regret synthesis). Each member taps "I'm in" before reveal; no re-open without quorum.
4. **Loser-targeted copy** (Outcome Favorability, Tyler, Informational Justice). The losing member is the rate-limiting reader. Verdict copy should address them by default.
5. **Need-rule for vetoes, equality-rule for soft preferences, never equity** (Distributive Justice). No win-counts, no "your turn."
6. **Friction-bearing correctability** (Leventhal, P2 hard-close). Redo-path exists but costs (quorum required) — preserves correctability rule without inviting re-litigation.
7. **Implementation intention copy** (Public Commitment). "We meet at X at 7pm" beats "We picked X."
8. **Avoid reactance** (Public Commitment). Ratification must feel voluntary.

## Convergent UX prescriptions (P1 + P2, carried forward)

1. Parallel + private input.
2. Vetoes / hard constraints first.
3. Cardinal preference intensity, not ranking.
4. Single verdict, not top-3 list.
5. Responsibility laundering — algorithm picks.
6. Pre-commit ratification + hard close.
7. Option compression to 2–3 finalists.
8. Short, fast, low-effort quiz form.

## Quiz signal lock-in (the research-brief output)

P1 + P2 already converged on:

1. **Constraints / vetoes** (hard dealbreakers).
2. **Cardinal mood / intensity on one axis** (energy, vibe, adventurous↔familiar).
3. **Commitment lock** (explicit ratification — now empirically reinforced by P3 Public_Commitment).

Reject: preference ranking (re-imports Arrow), open text (re-imports cognitive load).

## Decisions still pending in 0.1.0 design (post-synthesis)

After `/research-report` synthesizes the 19 JSONs, these lock per research-brief §"Outputs that update the 0.1.0 design":

1. Final quiz length (likely 4–6).
2. Signal type (one primary, others as sub-signals).
3. Tiebreaker rule for aggregation.
4. Verdict-explanation copy framework — P3 makes this concrete: aggregate-rule attribution + voice receipt + ratification button + need-vs-equality rule reveal.

## Open issues / boundary conditions to flag in synthesis

- **Friend-group lateral extrapolation.** Most procedural-justice literature is hierarchical (police, courts, employers). Tyler, Leventhal, Voice all flagged this in `ingroup_friend_specificity`. 0.1.0 should A/B test register (warm vs court-formal copy) post-launch.
- **Correctability vs hard close** is a real design tension. Recommended resolution: quorum-redo (friction-bearing). Needs explicit sign-off in the 0.1.0 PRD.
- **Algorithm-as-decider.** Most empirical voice / fairness work uses human authority figures. Whether the algorithm itself can carry the relational signal is the central untested assumption. Verdict-screen tone is the lever.
- **Aggregate-rule vs personal-causal attribution** boundary the literature does not resolve — needs in-product test.
- **Decision_Fatigue group-level effects** still genuinely under-studied (literature gap, not search gap — won't resolve without primary research).

## Recommended next move

**`/research-report`** — synthesize all 19 JSONs (P1 + P2 + P3) into compiled markdown comparison docs in `50_product/`. Closes all three research-brief priorities. Compresses 19 JSON files into ~3 readable comparison docs + 1 synthesis verdict that pins the 0.1.0 quiz mechanic, signal type, tiebreaker, and verdict-screen copy framework.

## File pointers

- `[[50_product/research-brief]]` — driving questions
- `[[50_product/decision-model]]` — quiz mechanic the research feeds
- `[[50_product/north-star]]` — follow-through metric
- `[[50_product/0.1.0-scope]]` — scope constraints
- `01_raw/decision-simplification-frameworks/` — P1 raw outputs (6 JSONs)
- `01_raw/paralysis-causes/` — P2 raw outputs (6 JSONs, 3 re-run 2026-05-08)
- `01_raw/group-fairness-procedural-justice/` — P3 raw outputs (7 JSONs, generated 2026-05-08)

## Working-style reminders for the next session

- Caveman mode (full) is the default voice. Code/commits/security/vault docs written normally.
- Strict scope. Flag adjacencies as separate notes.
- Auto-place vault docs and report path + one-line summary in turn output.
- Documentation duty: every decision and finding gets a vault note.
- Verification: run things end-to-end before claiming done.
- Vault rules: read `[[gti-vault/_index]]` and the relevant folder `_index.md` first.
- Validator path: `C:/development/GetToIt/.claude/skills/research/validate_json.py`. JSONs MUST be flat (top-level keys = field names, no nested category objects).
