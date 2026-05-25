---
title: Research-Report Handoff — Synthesize P1 + P2 + P3 into 50_product/
description: Superseded 2026-05-08. Layer-1 reports and four layer-2 deliverables shipped.
type: handoff
status: superseded
superseded_by: "[[50_product/0.1.0-design-locks]]"
created: 2026-05-08
closed: 2026-05-08
related:
  - "[[research-handoff-2026-05-08]]"
  - "[[50_product/research-brief]]"
  - "[[50_product/0.1.0-design-locks]]"
  - "[[50_product/framework-comparison]]"
  - "[[50_product/paralysis-cause-priority]]"
  - "[[50_product/verdict-screen-spec]]"
  - "[[50_product/decision-model]]"
  - "[[50_product/north-star]]"
  - "[[50_product/0.1.0-scope]]"
---

> **Superseded 2026-05-08.** Layer-1 reports written to `01_raw/decision-simplification-frameworks/report.md`, `01_raw/paralysis-causes/report.md`, `01_raw/group-fairness-procedural-justice/report.md`. Layer-2 deliverables live in [[50_product/framework-comparison]], [[50_product/paralysis-cause-priority]], [[50_product/verdict-screen-spec]], and [[50_product/0.1.0-design-locks]]. Body preserved for archival reference of the work plan that produced them.


# Research-Report Handoff — 2026-05-08

You are picking this up in a fresh context window. Read this file end-to-end before doing anything. It is self-contained — you do not need to read prior conversation memory.

## Project context (one paragraph)

GetToIt is a group decision-paralysis killer. 0.1.0 ships food vertical only, no ML. Use case: 2–6 friends decide where to eat, often end-of-workday timing, mid-stakes social decision. Product runs a short (~5 question) parallel quiz per member and produces a single committed verdict the whole group commits to. North-star metric is verdicts followed-through (whole group shows up), not just majority agreement. The quiz mechanic — exact question count, signal type, aggregation tiebreaker, verdict-screen copy — is gated on the research described below.

## What is already done

Three deep-research batches complete. All 19 JSONs validated 100% field coverage by `C:/development/GetToIt/.claude/skills/research/validate_json.py`.

| Batch | Topic | Items | Path |
|---|---|---|---|
| P1 | Decision-simplification frameworks | 6 | `gti-vault/01_raw/decision-simplification-frameworks/` |
| P2 | Paralysis causes | 6 | `gti-vault/01_raw/paralysis-causes/` |
| P3 | Group fairness / procedural justice | 7 | `gti-vault/01_raw/group-fairness-procedural-justice/` |

Each batch directory contains `outline.yaml`, `fields.yaml`, and `results/*.json`. JSONs are flat-structured (top-level keys = field names; no nested category objects).

Prior-state handoff with full per-item verdicts: `[[research-handoff-2026-05-08]]`. Read it for the executive summary if you want orientation before running the skill.

## Your job

Two layers of work. The `/research-report` skill only handles layer 1.

### Layer 1 — Mechanical compile (run `/research-report` 3 times)

The `/research-report` skill (at `C:/development/GetToIt/.claude/skills/research-report/SKILL.md`) reads ONE `outline.yaml` + the matching `results/*.json` and produces ONE `report.md` of every field for every item. It does NOT cross-synthesize.

Run it three times, once per batch directory. Each run will:

1. Ask via `AskUserQuestion` which optional summary fields to display in the TOC. Pick judgement-relevant ones — for GetToIt these are likely:
   - P1: `adoption_verdict`, `signal_type`, `implementation_complexity`
   - P2: `priority_for_v1`, `dominance_estimate`
   - P3: `priority_for_v1`, `dominance_estimate`
2. Generate a `generate_report.py` script in the batch directory.
3. Write `report.md` in the batch directory.

Outputs after layer 1:
- `gti-vault/01_raw/decision-simplification-frameworks/report.md`
- `gti-vault/01_raw/paralysis-causes/report.md`
- `gti-vault/01_raw/group-fairness-procedural-justice/report.md`

These three reports are mechanical — every field, every item, no judgement. They are the source material for layer 2, not the deliverable.

### Layer 2 — Cross-priority synthesis (manual, judgment work)

The `/research-brief` (`gti-vault/50_product/research-brief.md`) names four §"Outputs that update the 0.1.0 design" deliverables that lock when research closes:

1. **Final quiz length** (likely 4–6).
2. **Signal type** (one primary, others sub-signals or future-version).
3. **Tiebreaker rule** for aggregation.
4. **Verdict-explanation copy framework** (procedural-justice driven).

Layer 2 is the work that produces these locks. Skill cannot do this — you write it by hand, drawing on the three layer-1 reports plus the prior handoff's convergent prescriptions.

Recommended layer-2 deliverables (write to `gti-vault/50_product/`):

| File | Contents |
|---|---|
| `framework-comparison.md` | Cross-P1 comparison: which framework wins, why, and what the hybrid (EBA + Satisficing) looks like concretely. |
| `paralysis-cause-priority.md` | Cross-P2: dominant causes, state-multiplier (Decision_Fatigue), how each cause maps to a quiz mechanic. |
| `verdict-screen-spec.md` | Cross-P3: verdict-screen copy framework, ratification UX, distribution-rule choice, what loser-targeted copy looks like. |
| `0.1.0-design-locks.md` | The four research-brief deliverables, explicit and dated. Quiz length: N. Signal type: X. Tiebreaker: Y. Verdict-screen framework: Z. Each with citation back to the research that justifies it. |

Each layer-2 file should cite specific JSON outputs by path so the trail back to source is preserved.

After writing layer-2, update `[[gti-vault/50_product/research-brief]]` status from `open` to `closed` and link to the four deliverables. Update `[[gti-vault/50_product/_index]]` to list the new files.

## Key facts already locked (do not re-litigate in synthesis)

These survived all three batches and the prior handoff already committed to them. Use as anchors, do not re-derive:

- **Engine candidate: EBA + Satisficing hybrid.** EBA-style attribute-veto pruning followed by Satisficing-style threshold acceptance. WRAP rejected as engine (sequential reflective, no aggregation). Choice_Architecture and Pre_Mortem are sub-signals.
- **Primary paralysis causes to defuse: Misaligned_Preferences, Social_Friction, Fear_of_Regret_FOMO, Paradox_of_Choice.** Cognitive_Load is architectural-primary (design constraint). Decision_Fatigue is state-multiplier, not standalone cause.
- **Quiz signal stack: constraints/vetoes → cardinal mood/intensity on one axis → commitment lock.** Reject preference ranking (re-imports Arrow), reject open text (re-imports cognitive load).
- **P3 must-haves for verdict screen:** Tyler_Group_Value, Voice_Effect, Outcome_Favorability_Interaction, Informational_Justice_Explanation, Public_Commitment_Ratification, Distributive_Justice_Equity. Leventhal_Six_Rules = should-have.
- **Distribution rule: NEED-then-EQUALITY hybrid.** Need rule for hard constraints (vetoes), equality across sessions for soft preferences. Never EQUITY (no win-counts, no "your turn" copy) — converts solidarity context to exchange relationship.
- **Attribution style: aggregate-rule, not personal-causal.** "Budget constraint cut Sushi" beats "Alex said no" in friend-group register.
- **Ratification UX: pre-commit + mutual-state visibility + hard close + if-then specification.** Each member taps "I'm in" before reveal; redo-path requires quorum (friction-bearing correctability), no free re-open.

## Open boundary conditions to flag in synthesis (do not gloss)

- **Hierarchical → lateral extrapolation.** Most procedural-justice empirical base is hierarchical (police, courts, employers). Friend-group lateral context is extrapolation. Tyler, Voice, Leventhal flagged this. 0.1.0 should A/B test register (warm vs court-formal copy) post-launch.
- **Algorithm-as-decider.** Empirical work uses human authority figures. Whether the algorithm itself can carry the relational signal is the central untested assumption. Verdict-screen tone is the lever.
- **Correctability vs hard close.** Real design tension. Resolution: friction-bearing quorum-redo. Synthesis must call this out, not bury it.
- **Aggregate-rule vs personal-causal attribution boundary.** Literature does not resolve. Needs in-product test post-launch.
- **Group-level Decision_Fatigue.** Genuine literature gap. Don't claim more than the evidence supports.

## File pointers (everything you need)

- **Source-of-truth research brief:** `[[gti-vault/50_product/research-brief]]`
- **Prior-state handoff (verdicts table per item):** `[[gti-vault/20_plan/research-handoff-2026-05-08]]`
- **Skill spec:** `C:/development/GetToIt/.claude/skills/research-report/SKILL.md`
- **Validator (use to re-verify any new JSON if you write any):** `C:/development/GetToIt/.claude/skills/research/validate_json.py`
- **Other 50_product anchors:** `[[decision-model]]`, `[[north-star]]`, `[[0.1.0-scope]]`

## Working-style reminders

- Caveman mode (full) is the default voice in chat. Vault documents (this file, all `50_product/` outputs) are written in normal grammatical English — they have other readers.
- Strict scope. Touch only what was asked. Flag adjacencies as separate notes.
- Auto-place vault docs in the correct folder; report path + one-line summary in the turn output. Don't ask first.
- Documentation duty: every decision and finding gets a vault note. Especially layer-2 — the synthesis IS the deliverable.
- Verification: layer-1 skill outputs auto-generated; spot-check the three `report.md` files render correctly.
- Vault rules: read `[[gti-vault/_index]]` and the relevant folder `_index.md` first; never speculative-scan.
- Memory: auto-save user / feedback / project / reference memories as you learn them. Note what was saved in the turn summary.

## Recommended turn sequence

1. Read this file. Read `[[research-handoff-2026-05-08]]`. Read `[[50_product/research-brief]]` to confirm the four lock-in deliverables.
2. Run `/research-report` three times (P1, P2, P3 directories). Approve the suggested TOC fields when prompted.
3. Spot-check the three generated `report.md` files.
4. Draft the four layer-2 files in `50_product/`. Cite raw JSONs by path.
5. Update `[[50_product/research-brief]]` status to `closed`.
6. Update `[[50_product/_index]]` to list new files.
7. Update `[[20_plan/_index]]` to mark this handoff superseded; link forward to whichever doc captures the 0.1.0 design state.
8. Update or replace `[[research-handoff-2026-05-08]]` to reflect closed-research state.
9. End-of-turn summary: list every file written/updated with path + one-line description.

## Out of scope for this session

- Building any actual product code. Vault is documentation, never built from.
- Re-running any P1/P2/P3 research items. The 19 JSONs are the source. If you find a critical gap, flag it as a follow-up note in `01_raw/` — do not re-research inline.
- Writing copy strings for the actual product. The verdict-screen-spec captures the framework, not final copy. Copy work is `40_marketing_branding/` and a separate session.
- Quiz length validation. Research-brief defers this to A/B testing post-launch. Lock a starting bet (likely 4 or 5) and move on.
