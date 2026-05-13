---
title: Verdict-Screen Spec — P3 Synthesis
description: Cross-construct synthesis of group-fairness / procedural-justice constructs into the verdict-screen copy framework, ratification UX, and distribution rule
type: synthesis
status: closed
created: 2026-05-08
related:
  - "[[research-brief]]"
  - "[[decision-model]]"
  - "[[framework-comparison]]"
  - "[[paralysis-cause-priority]]"
  - "[[v1-design-locks]]"
sources:
  - "01_raw/group-fairness-procedural-justice/results/Tyler_Group_Value_Model.json"
  - "01_raw/group-fairness-procedural-justice/results/Voice_Effect.json"
  - "01_raw/group-fairness-procedural-justice/results/Leventhal_Six_Rules.json"
  - "01_raw/group-fairness-procedural-justice/results/Outcome_Favorability_Interaction.json"
  - "01_raw/group-fairness-procedural-justice/results/Informational_Justice_Explanation.json"
  - "01_raw/group-fairness-procedural-justice/results/Public_Commitment_Ratification.json"
  - "01_raw/group-fairness-procedural-justice/results/Distributive_Justice_Equity.json"
  - "01_raw/group-fairness-procedural-justice/report.md"
---

# Verdict-Screen Spec — P3 Synthesis

Cross-construct synthesis of seven group-fairness / procedural-justice constructs into a single verdict-screen specification. Closes the [[research-brief]] question of what the verdict surface must do to keep the loser bought in and to convert *agreed verdicts* into *followed-through verdicts* (the [[north-star]] metric).

This is the framework, not final copy. Final copy belongs to `40_marketing_branding/` in a later session.

## Verdict matrix

| Construct | Role | What the verdict screen must do |
|---|---|---|
| Outcome Favorability × Procedural Justice (Brockner & Wiesenfeld 1996) | **Must-have** — prime mover | Make procedural justice visible *for the loser specifically*. Procedural justice matters most when outcome is unfavorable — the loser is the rate-limiting follow-through reader. |
| Informational Justice / Accounts (Bies & Moag; Colquitt 2001) | **Must-have** — defuses retaliation | Name the inputs in plain language, name the rule (not the algorithm), give an account every loser can read at a glance. ~43% retaliation reduction in Shaw, Wild & Colquitt 2003 (54-sample meta-analysis). |
| Voice Effect (Thibaut & Walker 1975; Folger 1977; Lind 1990) | **Must-have** — receipt mechanic | Visibly receipt every member's input. Quiz IS structured voice; the screen must show that the voice was heard. Mute-effect (selective receipt) is the worst failure. |
| Tyler Group Value Model (Tyler 1989; Tyler & Blader 2003) | **Must-have** — relational signal | Telegraph respect / neutrality / trustworthy motives in a friend-group register. Relational signals drive acceptance independent of outcome. |
| Public Commitment / Ratification (Lewin 1947; Cialdini 1984; Gollwitzer & Sheeran 2006) | **Must-have** — close the gap | Pre-commit ratification ("I'm in") + mutual-state visibility + hard close + if-then specification. The mechanic that turns agreement into follow-through. |
| Distributive Justice — Need / Equality / never Equity (Deutsch 1975; Adams 1965) | **Must-have** — distribution rule | Need-rule veto pass for hard constraints, equality across sessions for soft preferences, **suppression of equity framing in copy**. Equity converts communal to exchange relationship in friend-group context. |
| Leventhal's Six Rules (Leventhal 1980) | Should-have — checklist | Audit the surface against consistency, bias-suppression, accuracy, correctability, representativeness, ethicality. Resolves the correctability/hard-close tension via friction-bearing quorum-redo. |

## The five-second test the screen must pass

The verdict screen has roughly five seconds of attention from each member. In those five seconds, the loser must see (in priority order from `Outcome_Favorability_Interaction.json` `design_signal_to_express`):

1. **The verdict** — winner shown, single option, no negotiation surface.
2. **The rule that produced it** — one short sentence, not a paragraph.
3. **Their voice was counted** — visible per-member input receipt.
4. **A path to ratify** — pre-commit "I'm in" tap before the meet-up plan reveals.
5. **A correctability path** — friction-bearing, not free.

Each of those five elements maps to one or more of the seven constructs. None of them is optional.

## Convergent prescriptions across constructs

Every construct in the package independently produces the same eight prescriptions. The convergence is the strongest evidence in the synthesis — when seven constructs agree across very different theoretical traditions (procedural-justice, social exchange, social influence, group dynamics), the prescription is robust.

### 1. Receipt member inputs explicitly

**From Voice, Tyler, Informational Justice, Leventhal.** Every member sees concrete evidence their specific quiz inputs were registered.

- Per-member voice-receipt card on the verdict screen — small chip or row per member showing one or two concrete inputs they registered.
- Default-on, not "show details" toggle (Tyler `ux_mechanic_implications`: "Optional toggle to 'show details' is too weak — it must be the default").
- Anonymized if necessary, **never silent**. Mute-effect (selective receipt) is worst case (Voice `failure_mode_if_ignored`).

### 2. Name the rule, not the picker

**From Informational Justice, Distributive Justice, Tyler.** Aggregate-rule attribution; algorithm as decider; never personal-causal.

- "Budget constraint cut Sushi Ren" beats "Alex said no."
- "We picked the place that everyone could eat at, that fit the budget cap, and that the most people had as a top pick."
- One short sentence stating the rule. Tappable for detail.
- For private constraints (allergies one member would not want named), default to attribute-level attribution: "filtered for celiac-safe kitchens" rather than naming the constrained member.

### 3. Pre-commit ratification with hard close

**From Public Commitment, Outcome Favorability, Fear of Regret synthesis (P2).**

- Each member taps "I'm in" *before* the venue is revealed.
- The commitment is to the procedure / verdict-mechanism, not to the specific outcome — so the loser is bound by procedural commitment, which generalizes (Public Commitment `ux_mechanic_implications`).
- Hard close after ratification window — no free re-open.
- Mutual-state visibility: members see *who else has tapped* in real time. Solidarity pressure is the lever, not enforcement.
- Watch reactance — button must feel optional, not required.

### 4. Loser-targeted copy as the default

**From Outcome Favorability, Tyler, Informational Justice.** The losing member is the rate-limiting reader; verdict copy should address them by default.

- Brockner & Wiesenfeld 1996 meta-analysis (45 samples): procedural justice matters most when outcomes are unfavorable.
- Skitka & Mullen moral-mandate boundary: dietary/allergy constraints must be upstream hard filters, *never* preferences that can lose. (See [[paralysis-cause-priority]] — this couples to Cognitive Load as architecture and Distributive Justice as need-rule.)
- Don't write copy that celebrates the winner. Write copy that includes the loser.

### 5. Need-rule for vetoes, equality-rule for soft preferences, never equity

**From Distributive Justice (sole source, with downstream Tyler / Outcome alignment).**

- Need rule: hard-constraint vetoes (allergies, dietary, religious, hard budget cap) prune the option space first. The constrained member's option is *never* a candidate that could lose.
- Equality across sessions: soft preferences balance over multiple sessions invisibly (no member tracking, no win-counts).
- **Active suppression of equity framings**: no "your turn" copy, no win-count display, no "you got your way last time so this is fair." Equity converts communal to exchange relationship (Clark & Mills 1979) and damages the friend-group frame (Distributive Justice `fit_to_use_case`).

This is also a tight P1 fit: EBA's veto-first design *natively implements the need rule* (Distributive Justice `interaction_with_p1_p2`).

### 6. Friction-bearing correctability

**From Leventhal (correctability rule), P2 (hard close).** Real design tension; resolution preserves both.

- Redo path exists but costs — quorum required to re-open (e.g., majority of group must tap "let's re-roll").
- Preserves Leventhal's correctability rule without inviting re-litigation that re-opens paralysis.
- Implementation: 30–90 second time-boxed correctability window after ratification; after window closes, redo requires explicit quorum.

### 7. Implementation-intention copy

**From Public Commitment.** Gollwitzer & Sheeran 2006 implementation-intention d ≈ 0.65; Rogers/Milkman 2014 commitment device g ≈ 0.68.

- "We meet at Sushi Ren at 7pm" beats "We picked Sushi Ren."
- The verdict copy must include the if-then: where, when, who.
- Couples to the [[decision-model|post-decision check-in]] — implementation intention raises the show-up rate that the check-in measures.

### 8. Avoid reactance

**From Public Commitment.** Ratification must feel voluntary.

- "I'm in" not "Confirm".
- No "you must commit before continuing" copy.
- Friction is on the redo path, not the ratification path.

## Verdict screen — element checklist (priority order)

The minimum viable verdict screen contains these elements, ordered top-to-bottom:

1. **Verdict** — one option, named, with implementation-intention slot ("Sushi Ren · 7pm · 0.4mi from Mission").
2. **Rule chip** — one short sentence stating the rule that produced the verdict ("Highest combined score among options nobody vetoed"). Tappable for detail.
3. **Voice receipt row** — per-member input chip (top pick, veto, key constraint), anonymized for private constraints.
4. **Eliminated-options affordance** — collapsed by default; expanding shows the elimination chain ("Cut for budget: …; cut for distance: …; cut for vegetarian: …").
5. **Pre-commit ratification button** — "I'm in" with mutual-state visibility (who else has tapped).
6. **Correctability window** — time-boxed friction-bearing redo path, gated on quorum after window closes.
7. **Hard-close artifact** — the screen visibly closes once the ratification window expires; the verdict is not editable from this screen after.

## Failure modes if ignored

Each construct's `failure_mode_if_ignored` predicts the same north-star failure with different mechanism stories:

- **Outcome Favorability × Procedural Justice ignored**: the loser nominally agrees, then ghosts the meet-up, brings up the loss next session as grievance.
- **Informational Justice ignored**: the loser fills the explanation gap with attribution to bias / randomness / favoritism — the retaliation-driver Shaw, Wild & Colquitt 2003 identified (~2× retaliation rate without explanation).
- **Voice ignored**: outcome-loser perceives verdict as algorithmically imposed; degraded follow-through (no-show, late, low-energy).
- **Tyler ignored**: STAGE 1 lower follow-through on this verdict; STAGE 2 (repeated) members start lobbying outside the app.
- **Public Commitment ignored**: precisely the failure mode the product exists to prevent — verdict produced, group says "sounds good", nobody actually goes.
- **Distributive Justice ignored**: worst case is verdict serves an option that violates a stored hard constraint (vegan member sent to a steakhouse). Trust frame damaged for several sessions.
- **Leventhal ignored**: grudging acceptance, late arrival, complaints en route, future-session vetoes, product abandonment.

The convergence is the synthesis: every construct points at the same failure (loser-driven follow-through collapse) with overlapping but non-identical defuses. Implementing all eight prescriptions covers every construct.

## Open boundary conditions to flag

These survive into v1 as known unresolved tensions, not as gaps to be closed by more research.

- **Hierarchical → lateral extrapolation.** Most procedural-justice empirical base is hierarchical (police, courts, employers). Friend-group lateral context is extrapolation. Tyler, Voice, and Leventhal all flagged this in `ingroup_friend_specificity`. v1 should A/B test register (warm-friend vs court-formal copy) post-launch.
- **Algorithm-as-decider.** Empirical work uses human authority figures. Whether the algorithm itself can carry the relational signal (respect, neutrality, trustworthy motives) is the central untested assumption. Verdict-screen tone is the lever; copy work owns this.
- **Aggregate-rule vs personal-causal attribution boundary.** Literature does not resolve when naming the constrainer is welcome ("Maya can't do meat" — explicit) vs. attribute-only ("filtered for vegetarian options"). In-product test post-launch.
- **Reactance threshold on ratification.** Public Commitment's effect persists only if the button feels voluntary. The exact copy that crosses from voluntary to coercive is empirically untested in friend-group context — needs a copy A/B.
- **Correctability cost.** Quorum-redo prevents free re-litigation but the exact quorum threshold (majority? supermajority?) is a tunable, not a research finding.

## What this synthesis closes

- **Verdict-screen element checklist** is locked (seven elements, priority order).
- **Eight cross-construct prescriptions** are the spec the design must satisfy.
- **Distribution rule is locked** — NEED-then-EQUALITY hybrid, EQUITY suppressed in copy.
- **Ratification UX is locked** — pre-commit + mutual-state visibility + hard close + if-then specification + friction-bearing quorum-redo.
- **Loser-targeted copy** is the default voice for the verdict surface.

Quiz length, signal type, and tiebreaker rule lock in [[v1-design-locks]] using this synthesis plus [[framework-comparison]] and [[paralysis-cause-priority]].
