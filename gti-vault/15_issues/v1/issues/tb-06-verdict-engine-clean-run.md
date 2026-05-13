---
issue: tb-06
title: VerdictEngine clean run + Verdict default surface
github_issue: 7
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
---

# TB-06 — VerdictEngine clean run + Verdict default surface

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The server-authoritative VerdictEngine for the **clean-run path only** — EBA pruning chain on Q1–Q4 vetoes followed by the Q5 regret-of-omission tiebreaker. No soft-pref relax, no hard-need terminal, no no-survivor handling (those land in TB-09). The result is written to `verdicts` plus `option_cuts` rows. iOS renders the S05 Verdict surface in `default` mode with the locked choreography.

- **Schema** — `verdicts (id uuid, room_id uuid, option_id uuid, computed_at timestamptz, method text, rule_text text)` and `option_cuts (verdict_id uuid, option_id uuid, cut_reason text, cut_text text)`.
- **VerdictEngine** — single canonical implementation server-side. Implementation choice (pure SQL with trigger vs. TypeScript Edge Function) is the engineer's call; the interface contract is the public API. For TB-06, the engine is invoked via a `compute_verdict(room_id)` RPC for manual testing — auto-triggers land in TB-07.
- **Engine spec** —
  1. Pull `votes` rows for the room. Pull candidate `options` from the room snapshot (populated by TB-05 when the room is created or seeded for manual testing).
  2. EBA pruning: intersect each member's veto set across Q1 (dietary as menu-compliance filter — `vegan_friendly` tag presence etc.), Q2 (price tier ≤ each member's cap), Q3 (walk-minutes estimate ≤ each member's threshold), Q4 (vibe veto on cuisine + vibe floor).
  3. Q5 regret tiebreaker: sum `q5_regret[option_id]` across all members; pick the maximum-sum option.
  4. Random fallback within survivors if Q5 variance is below a flat-signal threshold.
  5. Write `verdicts` row with `method ∈ {'manual'}` for TB-06 and `rule_text` generated per [[../../../50_product/verdict-screen-spec|verdict-screen-spec]] §2 (aggregate-rule attribution, never names a person).
  6. Write `option_cuts` rows for every eliminated option with the cut reason and cut text.
- **S05 default mode** — SwiftUI port of [[../../../../design-system/surfaces/05-verdict|S05]] `default` mode with locked choreography per `VERDICT_CHOREO` in `ScreenVerdict.jsx`. Hero + meta + time badge + rule chip + 4 voice receipts. Cuts drawer collapsed by default; expand renders `option_cuts` rows. CTA reads `"I'm in"` — non-functional in TB-06 (ratification wiring lands in TB-08).
- **Tests** — fixture-based VerdictEngine tests: a clean-run fixture returns the correct verdict; a single-survivor fixture short-circuits Q5; regret tiebreaker picks max-sum; flat-regret falls back to random within survivors; rule_text never names a person; private-constraint anonymization produces attribute attribution. SwiftUI snapshot test for the verdict default state.

## Acceptance criteria

- [ ] `verdicts` and `option_cuts` migrations land with RLS.
- [ ] VerdictEngine `compute_verdict(room_id)` RPC produces correct verdict + cuts for fixture rooms.
- [ ] Engine fixture tests cover: clean run, single survivor, regret tiebreaker, flat-regret random, rule_text aggregate attribution, anonymized private constraints.
- [ ] S05 SwiftUI view renders the verdict in `default` mode with the locked choreography.
- [ ] Snapshot test for S05 default state passes.
- [ ] iOS never recomputes the verdict — it only reads `verdicts` + `option_cuts`.

## Blocked by

- [[tb-04-full-quiz|TB-04]]
- [[tb-05-foursquare-placesproxy|TB-05]]
