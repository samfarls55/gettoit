---
issue: tb-09
title: VerdictEngine soft-pref relax cascade + no-survivor terminal
github_issue: 10
status: done
completed: 2026-05-14
type: AFK
created: 2026-05-12
prd: 0.1.0-prd
implements_spec_gap: 04-s05-no-survivor-terminal
---

# TB-09 — Soft-pref relax cascade + no-survivor terminal

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

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

- [x] All [[04-s05-no-survivor-terminal|spec-gap 04]] acceptance criteria pass (landed 2026-05-12).
- [x] VerdictEngine cascade fixture tests cover soft-pref relax order, hard-need preservation, terminal no-survivor (`supabase/functions/_shared/verdict-engine-relax.test.ts` — 14 tests).
- [x] S05 SwiftUI view supports the `no-survivor` mode with all suppressed and substituted elements (`ios/Sources/App/VerdictScreen.swift` — eyebrow "Tonight", hero "NO SPOT / FITS", meta line, rule chip, "Widen radius" CTA, inline 1..10 mi slider, "Start over" ghost; suppressed: time badge, receipts, cuts drawer; initiator-only widen).
- [x] Widen-radius inline expansion re-runs the engine and either returns a verdict or stays in the terminal state with a wider radius reflected (`compute-verdict` handler accepts `radius_meters_override`; drops prior no_survivor verdict; re-runs the engine; surfaces fresh verdict or another no_survivor with the new radius).
- [x] Engine rule_text for no_survivor uses aggregate-rule attribution with anonymized constraints (`buildNoSurvivorRuleText` — "Vegan options left no candidates within walking distance tonight."; tests assert names of voters never appear in rule_text).
- [x] Snapshot test for the no-survivor mode passes (`ios/Tests/VerdictScreenNoSurvivorTests.swift` — 12 tests).

## Blocked by

- [[tb-06-verdict-engine-clean-run|TB-06]]

## Adjacencies

- **`votes.soft_cuisine_vetoes` column** — the engine accepts a `soft_cuisine_vetoes: string[]` field on `MemberVote` but the 0.1.0 schema has no corresponding column. The cuisine_veto cascade step is therefore dormant in production until TB-10 (reroll) introduces a writer — the engine + Edge Function are wired for it, but `index.ts`'s real adapter passes `undefined`. Documented in `supabase/functions/compute-verdict/index.ts`.
- **`options.payload.distance_meters` + `options.payload.vibe_signal`** — both fields are read by the engine for soft pruning but PlacesProxy doesn't yet populate them. Vibe in particular has no Foursquare source; the engine skips the vibe gate when `vibe_signal` is null, so this is graceful. Distance is computable from `lat`/`lng` against the room's search centre — a follow-up TB on PlacesProxy or the Edge fetch can populate it.
- **`VerdictStore.survivingHardNeeds(forVotes:)` duplicates engine logic** — the iOS shaper mirrors the engine's `buildSurvivingHardNeeds` because the verdict row doesn't carry the surviving-hard-needs labels (they're not persisted; only `rule_text` is). A follow-up could persist them in `verdicts.surviving_hard_needs jsonb` to keep iOS and engine in sync without a copy.
