---
issue: tb-09
title: VerdictEngine soft-pref relax cascade + no-survivor terminal
github_issue: 10
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
implements_spec_gap: 04-s05-no-survivor-terminal
---

# TB-09 — Soft-pref relax cascade + no-survivor terminal

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

Extend the VerdictEngine with the empty-survivor fallback cascade (cuisine veto → vibe floor → radius widen, silent for soft prefs; never for hard-need vetoes). Add the S05 terminal `no-survivor` mode for when even after exhausting soft-pref relax the survivor set is empty.

This implements [[04-s05-no-survivor-terminal|spec-gap issue 04]] plus the engine cascade behind it.

- **VerdictEngine cascade** (additions to TB-06's clean-run path):
  1. After the EBA pruning chain, if survivors > 0 → continue to the regret tiebreaker (existing TB-06 path).
  2. If survivors = 0 AND any soft preferences are active, relax in order: most-cited cuisine veto first; if still 0, relax the vibe floor by 1 stop; if still 0, widen radius by 0.5 mi (capped at 5 mi); re-run pruning. Silent — no UI update.
  3. Hard-need vetoes (Q1 dietary as menu-compliance, Q2 budget cap) never relax.
  4. If after exhausting soft-pref relax survivors are still 0 → write `verdicts` row with `method = 'no_survivor'`, `option_id = null`, `rule_text` describing which hard-need vetoes survived without naming a person.
- **S05 no-survivor mode** — apply the changes in [[04-s05-no-survivor-terminal|spec-gap 04]] to the design-system spec + JSX, then port to SwiftUI. Visible: eyebrow `"Tonight"`, hero `"NO SPOT / FITS"`, hard-need meta line, rule chip in aggregate-rule register, "Widen radius" sun-pill CTA (inline expansion), ghost "Start over" secondary. Suppressed: voice receipts, ratification, reroll, "Start over" primary path.
- **Widen-radius inline expansion** — tapping the CTA expands a radius slider inline (current value + 1.0 mi default, range 1–10 mi). On commit, the engine re-runs with the new radius. Does not consume a reroll.
- **Tests** — engine fixture tests: cascade order (cuisine → vibe → radius); hard-need never relaxes; terminal `no_survivor` when exhausted; rule_text never names a person; widen-radius commit re-runs the engine with new radius. SwiftUI snapshot for the no-survivor mode.

## Acceptance criteria

- [ ] All [[04-s05-no-survivor-terminal|spec-gap 04]] acceptance criteria pass.
- [ ] VerdictEngine cascade fixture tests cover soft-pref relax order, hard-need preservation, terminal no-survivor.
- [ ] S05 SwiftUI view supports the `no-survivor` mode with all suppressed and substituted elements.
- [ ] Widen-radius inline expansion re-runs the engine and either returns a verdict or stays in the terminal state with a wider radius reflected.
- [ ] Engine rule_text for no_survivor uses aggregate-rule attribution with anonymized constraints.
- [ ] Snapshot test for the no-survivor mode passes.

## Blocked by

- [[tb-06-verdict-engine-clean-run|TB-06]]
