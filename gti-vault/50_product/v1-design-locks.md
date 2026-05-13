---
title: v1 Design Locks
description: The four research-brief deliverables locked — quiz length, signal type, tiebreaker rule, verdict-screen copy framework. Each with citation.
type: decision-record
status: locked
created: 2026-05-08
related:
  - "[[research-brief]]"
  - "[[decision-model]]"
  - "[[v1-scope]]"
  - "[[north-star]]"
  - "[[framework-comparison]]"
  - "[[paralysis-cause-priority]]"
  - "[[verdict-screen-spec]]"
---

# v1 Design Locks

The four deliverables `[[research-brief]]` named under "Outputs that update the v1 design." Each is locked as of 2026-05-08, with a one-line rationale and citations back to the synthesis docs and raw research.

These supersede every "TBD pending research" placeholder in [[decision-model]] and [[v1-scope]]. Update those docs to reference this one.

## Lock 1 — Quiz length

**Locked: 5 questions.** Re-evaluate after first beta cohort.

Composition (best-fit allocation, subject to copy work):

1. Hard dietary deal-breakers (allergy / vegan / halal / kosher / gluten-free) — EBA veto on **menu compliance**, not restaurant type. Filter to restaurants that *offer* compliant options, not restaurants that exclusively serve that diet. "Vegan" means "restaurant has vegan options on its menu," not "vegan-only restaurant." This is a 2026-05-12 PRD-grill clarification of the original wording. Need-rule pass — never silently relaxed during no-survivor fallback.
2. Hard budget cap — EBA veto, threshold. Need-rule, never silently relaxed.
3. Hard logistics constraint (distance / time / open-now) — EBA veto, threshold. Radius is silently relaxed during no-survivor fallback (soft signal in practice).
4. Cuisine veto OR vibe-floor (one cardinal axis: low-key ↔ lively, or familiar ↔ adventurous) — EBA veto + Satisficing threshold. Soft signal; silently relaxed (most-cited veto first) during no-survivor fallback.
5. Tiebreaker preference signal — regret-of-omission scalar over surviving options OR a single soft preference vote, depending on engineering cost (see Lock 3).

**Rationale.** Three independent reasons converge on five:

- **Cognitive Load ceiling.** Cowan working-memory bound is ~4 chunks; five questions with one decision per question respects the bound (`paralysis-causes/results/Cognitive_Load.json` `mitigation_strategy`).
- **EBA empirical claim.** Tversky-tradition consumer-choice work shows 3–4 attributes drive a real decision. Five is right-sized, not artificially truncated (`decision-simplification-frameworks/results/Elimination_by_Aspects.json` `fit_for_fixed_length_quiz`).
- **Decision Fatigue tolerance.** End-of-workday users tolerate short quizzes only; under-60-second total budget. Five questions × ~10s each fits (`paralysis-causes/results/Decision_Fatigue.json` `mitigation_strategy`).

**Why not 4.** Loses the tiebreaker slot, which forces random or distance-based pick — leaves intensity signal on the floor.

**Why not 6+.** Crosses Cowan ceiling; pushes total time past 60s; no construct in P1 or P2 demands a sixth signal.

**Sources.** [[framework-comparison]], [[paralysis-cause-priority]], `01_raw/decision-simplification-frameworks/results/Elimination_by_Aspects.json`, `01_raw/paralysis-causes/results/Cognitive_Load.json`.

**Open.** Exact question copy. A/B test of 4 vs 5 vs 6 post-launch — `[[research-brief]]` lower-priority deferral; preserved as defer-to-A/B-testing.

## Lock 2 — Signal type

**Locked: constraints / vetoes (primary) → cardinal mood/intensity on one axis (secondary) → commitment lock (tertiary).**

In quiz order:

1. Hard vetoes / dealbreakers (binary per attribute) — Q1, Q2, Q3.
2. Cardinal preference intensity on one axis (cuisine veto or vibe floor) — Q4.
3. Tiebreaker scalar (regret-of-omission per surviving option) — Q5.
4. Commitment lock (pre-commit ratification "I'm in") — verdict screen, post-quiz.

**Rejected signal types and why.**

- **Preference ranking** — re-imports Arrow impossibility. Cardinal scoring evades it; ordinal does not (`paralysis-causes/results/Misaligned_Preferences.json` `signal_to_extract`).
- **Open text input** — re-imports cognitive load; impossible to aggregate.
- **Likert-rate-each-option** — Maximizer signature. Forces simultaneous holding of multiple options in working memory; violates Cognitive Load ceiling.
- **Pairwise comparisons** — explodes question count beyond budget; not friend-group register.

**Why this stack.**

- Vetoes (constraints) defuse Choice Overload, Anticipated Regret, Decision Fatigue, and Cognitive Load simultaneously — see [[paralysis-cause-priority]] cause→mechanic table.
- Cardinal intensity defuses Misaligned Preferences (Arrow workaround) and Social Friction (anonymous parallel input gives honest signal).
- Commitment lock defuses Anticipated Regret (foregone option not salient at commit), Public Commitment construct (Lewin → Cialdini → Gollwitzer pipeline), and the "agree-but-don't-commit" gap that the [[north-star|follow-through metric]] measures.

**Sources.** [[paralysis-cause-priority]], [[framework-comparison]], [[verdict-screen-spec]] §"Pre-commit ratification with hard close".

**Open** (resolved 2026-05-12). Cardinal axis locked to **vibe/energy** with the canonical vocabulary `HUSHED → ROWDY`. See `design-system/code/screens/ScreenQ4Vibe.jsx` (the live spec) and `design-system/surfaces/03-quiz.md`. A/B test of alternative axes (cuisine, adventurous-vs-familiar) preserved as post-launch experiment.

## Lock 3 — Tiebreaker rule

**Locked starting bet: regret-of-omission scalar summed across members; fall back to random pick within survivor set if regret signal is flat.**

Concretely:

1. Run EBA elimination chain on Q1–Q4 vetoes/thresholds. Survivor set = options that cleared every member's threshold.
2. If survivor set has exactly one option, that is the verdict.
3. If survivor set has zero options, run relax-veto fallback (most-cited veto first); if still zero, widen geographic radius; if still zero, exit with no verdict.
4. If survivor set has more than one option, ask Q5: regret-of-omission slider per surviving option per member ("how much would you regret NOT going to this one?"). Sum scalar across members; pick maximum.
5. If Q5 signal is flat (variance below threshold), fall back to random pick within survivor set.

**Why this rule and not the alternatives.**

| Candidate | Rejected because |
|---|---|
| Pure random within survivor set | Wastes the intensity signal that EBA's binary vetoes throw away. Acceptable as *fallback*, weak as *primary*. |
| Order by neutral signal (distance, popularity) | Reproduces "the app picks the closest one" perception — violates Tyler neutrality signal in copy if the signal is too transparent. |
| Order by single soft preference vote | Re-imports Arrow on the tiebreaker step. |
| Compensatory weighted score | Violates non-compensatory premise of EBA + Satisficing engine; high implementation cost. |

The regret scalar uses Pre-mortem `signal_type` (`regret-asymmetry signal — a signed scalar that captures preference intensity weighted by loss-aversion`) and protects the loser whose anticipated regret would be highest — directly serving Outcome Favorability × Procedural Justice from [[verdict-screen-spec]].

**Procedural-justice consistency.** Tiebreaker rule is *named on the verdict screen* per Informational Justice ("we picked among the 3 that everyone could eat at, the one nobody would regret most"). Members can audit the rule.

**Sources.** [[framework-comparison]] §"No native tiebreaker among survivors", `01_raw/decision-simplification-frameworks/results/Pre_Mortem_Regret_Minimization.json`, `01_raw/decision-simplification-frameworks/results/Satisficing.json` `tiebreaker_rule_implication`.

**Open.** Whether regret-of-omission outperforms random pick on follow-through. A/B test post-launch — first hypothesis to test once cohort data exists.

## Lock 4 — Verdict-screen copy framework

**Locked: aggregate-rule attribution + voice-receipt + need/equality distribution rule + pre-commit ratification + loser-targeted defaults.**

The framework, not the strings. Final copy work belongs to `40_marketing_branding/` in a separate session.

### Locked elements (priority order, top-down)

1. **Verdict** — one option, named, with implementation-intention slot (where + when + who).
2. **Rule chip** — one short sentence stating the rule that produced the verdict. Aggregate-rule attribution, never personal-causal. Tappable for detail.
3. **Voice-receipt row** — per-member input chip (top pick, veto, key constraint). Anonymized for private constraints (allergies → "filtered for celiac-safe kitchens", not "filtered because Sarah has celiac").
4. **Eliminated-options affordance** — collapsed by default; expanding shows the elimination chain.
5. **Pre-commit ratification button** — "I'm in" with mutual-state visibility. Voluntary register, not coercive.
6. **Correctability window** — 30–90s time-boxed; after window, redo requires quorum (friction-bearing).
7. **Hard-close artifact** — the verdict screen visibly closes after ratification window.

### Locked register

- **Aggregate-rule attribution.** "Budget cap cut Sushi Ren" beats "Alex said no."
- **Algorithm as decider.** No "Maya picked this" copy. The rule + the inputs are the decider.
- **Loser-targeted defaults.** Copy addresses the member whose preference lost, not the winner.
- **Implementation intentions in the verdict.** "We meet at X at 7pm." Not "We picked X."
- **Distribution rule: NEED-then-EQUALITY.** Hard-constraint vetoes prune first (need rule, visible). Soft preferences balance across sessions invisibly (equality). **Never EQUITY** — no "your turn" copy, no win-counts, no exchange-relationship framing.

### Suppressed copy patterns

These are *not* in the v1 register and require explicit decision to introduce:

- "Your turn", "you got your way last time", "owed", "in return" — equity register, breaks communal frame.
- "The algorithm chose…", "the app picked…" — depersonalizes the rule and damages Tyler relational signals.
- "Confirm", "Accept" — coercive register; reactance lever. Use "I'm in".
- "Top 3" / ranked list reveal — re-imports Anticipated Regret and Choice Overload at commit time.
- Per-member vote tally on the verdict screen — equity-by-tracking; converts communal to exchange.

**Sources.** [[verdict-screen-spec]] (full cross-construct synthesis), `01_raw/group-fairness-procedural-justice/results/*.json` — every construct in the package converges on these elements.

**Open.**
- Final string library. Owned by `40_marketing_branding/`.
- Warm-friend vs court-formal register. Friend-group lateral extrapolation from hierarchical-authority literature is the open boundary; A/B test post-launch.
- Whether the algorithm-as-decider can carry the relational signal that human authority figures carry in the empirical base. Untested assumption; verdict-screen tone is the lever.

## What is *not* locked here

These remain open and the [[research-brief]] explicitly defers them:

- Quiz length validation against follow-through. Defer to A/B testing post-launch.
- Activities and bars verticals. [[v1-scope]] defers.

## Resolved 2026-05-12 (out of band)

- **Reroll cap.** Locked at 3 in `design-system/surfaces/07-reroll.md`. Was listed as `~3` in [[v1-scope]].
- **Auth / identity model.** [[../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]].
- **Privacy posture.** [[../60_engineering/adr/0006-privacy-posture-v1|ADR 0006]].
- **Monetization.** Free, no IAP in v1. Revisit post-thesis.

See [[v1-scope]] §Resolved in 2026-05-12 grill for the full list.

## Resolved 2026-05-12 (PRD grill — pre-PRD session)

A second grill on 2026-05-12 closed the remaining mechanics-level opens before drafting `10_prds/v1-prd.md`. Lock 1 wording above was updated in-place; the rest are mechanic decisions that live in `v1-scope.md` and feed the PRD. Summary, full detail in [[v1-scope#Resolved in 2026-05-12 PRD grill]]:

- **Group size, fire trigger, timer.** No fixed N. Verdict fires on initiator tap OR initiator-set timer (default 10 min). Min quorum 2.
- **Late-joiner.** Read-only verdict + re-invite CTA.
- **No-survivor cascade.** Silent for soft prefs (cuisine, vibe, radius). Hard NEED vetoes (dietary, budget, allergy) never relax — terminal "no spot fits" screen.
- **Dietary semantics.** Menu-compliance filter, not restaurant-type filter. Lock 1 above updated.
- **Radius.** 2 mi default, initiator slider 0.5–5 mi on S01.
- **Persistent groups.** Cut from v1. Group-chat thread is the persistent group.
- **Decision history.** Backend-only, no UI surface.
- **Check-in.** iOS push only, opt-in via pre-permission ask on S05.
- **Beta success.** Learn-the-baseline first; retroactive target from cohort 1.
- **Public-release gates.** Four signals required: follow-through %, repeat use, stability, viral spread.
- **Seed recruitment.** Founder's friend groups for cohort 1.
- **Quiz copy in PRD.** Placeholders, replaced in `40_marketing_branding/` pass.
- **Privacy Policy + TOS.** Template-generated before external TestFlight.
- **Apple Developer account.** Individual now, LLC later if monetization lands.

## Spec gaps queued for `design-system/`

PRD-grill answers introduce four surface-level changes the locked spec does not yet carry. Each is a separate `design-system/` issue. Full text in [[v1-scope#Design-system spec gaps from the PRD grill]]:

- S01 — add timer chip + radius slider; document the "no optional fields" exception.
- S04 — add initiator "Decide now" button + timer countdown; retire the v2-deferral of force-verdict.
- S05 — add read-only mode for late-joiners.
- S05 — add terminal no-survivor state.

Plus a research task: confirm Foursquare exposes the dietary tags the new Lock 1 wording requires (`vegan_friendly`, `gluten_free_options`, `halal`, `kosher`).

## What this lock document closes

The four `[[research-brief]]` "Outputs that update the v1 design":

| Brief deliverable | Locked as |
|---|---|
| Final quiz length | 5 questions (Lock 1) |
| Signal type | constraints/vetoes → cardinal intensity → commitment lock (Lock 2) |
| Tiebreaker rule | regret-of-omission scalar with random fallback (Lock 3) |
| Verdict-explanation copy framework | aggregate-rule + voice-receipt + need/equality + ratification + loser-targeted (Lock 4) |

Brief is closed. See [[research-brief]] header and §"Related" for forward links.
