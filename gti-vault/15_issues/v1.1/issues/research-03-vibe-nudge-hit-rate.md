---
issue: research-03
title: Measure the vibe-token nudge hit-rate against the research-02 sample
status: done
type: AFK
github_issue: 115
prd: v1.1-quiz-redesign-prd
created: 2026-05-18
related:
  - "[[research-02-tastes-vibe-token-allowlist]]"
  - "[[tb-18-q4-vibe-tastes-signal]]"
---

# research-03 — Measure the vibe-token nudge hit-rate

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (E) axis scorers, vibe axis. Follow-up to [[research-02-tastes-vibe-token-allowlist|research-02]], surfaced 2026-05-18 while reviewing that spike's coverage finding.

## Background — the gap

research-02 shipped a 30-token vibe-token allowlist and measured **`tastes` field coverage at 66.8%** (728 of 1090 sampled venues carry a non-empty `tastes` array). tb-18 then wired that allowlist into `Q5VenueClassifier` as a bounded ±1 vibe nudge.

But 66.8% is only the **ceiling** on how often the nudge can fire — it counts venues that have *any* `tastes` data, not venues that the allowlist actually acts on. A venue inside that 66.8% still gets **no nudge** when:

1. Its `tastes` tokens are all folksonomy noise — none on the 30-token allowlist (`casual`, `dinner`, dish names, ingredients dominate the cloud; see research-02 §2).
2. Its matched allowlist tokens **net to zero** — equal `+1` and `-1` tags cancel, and the classifier nudges by the *sign* of the sum.

The real predictor of whether tb-18 buys anything is the **nudge fire-rate**: the fraction of venues whose category-archetype baseline actually moves. research-02 never measured it. This spike does.

## What to build

A research spike — **no application code ships**. A pure offline computation against the on-disk research-02 sample. **No new Foursquare API calls** — every input already exists in the repo:

- Per-venue raw sample: `gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/data/raw-sample.json` (1090 venues with their `tastes` arrays + category).
- Curated allowlist: `gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/data/vibe-token-allowlist.json` (30 tokens, each tagged `+1` / `-1`).

Replay the `Q5VenueClassifier` token-match logic over every sampled venue — lowercase + trim tokens, match against the allowlist, sum the ±1 tags, take the sign — and report what fraction of venues actually receive a non-zero nudge.

## Deliverable

A research write-up — append a new section to the existing research note (`foursquare-tastes-vibe-2026-05/report.md`) since it analyses the same canonical 2026-05-18 sample; do not start a separate bundle. It must report:

1. **Overall nudge fire-rate** — of all 1090 venues, the % that receive a non-zero nudge (the real number; 66.8% is the ceiling above it).
2. **The funnel** — venues sampled -> have `tastes` data (66.8%) -> match ≥1 allowlist token -> net a non-zero sum. Every drop-off step quantified.
3. **By category** — fire-rate split across Restaurant / Bar / Cafe, since research-02 §3 showed coverage is heavily category-dependent (restaurants 83% vs cafes 44%).
4. **Direction split** — of the venues that do get a nudge, the `+1` (louder) vs `-1` (quieter) share.
5. **Net-zero cancellation count** — how many venues matched allowlist tokens but were cancelled out to no nudge. If this is large, it is a finding worth flagging on its own.
6. **A one-paragraph read** — does the nudge move enough venues to be worth the classifier complexity, or is it mostly inert? State it plainly; this informs whether tb-18's nudge stays as-is, gets a wider allowlist, or is a candidate for removal.

## Acceptance criteria

- [ ] The `foursquare-tastes-vibe-2026-05` research note carries a new section reporting the nudge fire-rate, computed against `data/raw-sample.json` and `data/vibe-token-allowlist.json`.
- [ ] The funnel (sampled -> tastes-bearing -> token-matched -> non-zero net) is quantified at every step.
- [ ] Fire-rate is broken down by venue category (Restaurant / Bar / Cafe).
- [ ] The direction split (`+1` vs `-1`) and the net-zero cancellation count are reported.
- [ ] The note states a plain-language verdict on whether the nudge is worth keeping as specified.
- [ ] No new Foursquare API calls. No application code changed.
- [ ] The token-match logic used in the analysis matches `Q5VenueClassifier`'s production behaviour (case-insensitive, trimmed, sign-of-sum). Confirm against the merged tb-18 classifier code.

## Blocked by

None — can start immediately. research-02 (#108) and tb-18 (#102) are both merged; all inputs are on `main`.

## Comments

**2026-05-18 — filed (`ready-for-agent`).** Surfaced reviewing research-02's 66.8% coverage finding: that figure is the nudge ceiling, not the fire-rate. This spike measures the fire-rate offline against the existing research-02 sample — no new API cost. AFK; the analysis is deterministic over on-disk data.

**2026-05-18 — done (AFK, `afk/research-03`).** Replayed the merged tb-18 `Q5VenueClassifier.tastesNudge` logic offline over `data/raw-sample.json` and `data/vibe-token-allowlist.json` — no new Foursquare calls, no application code touched. Measured **nudge fire-rate at 46.3%** (505 of 1090 venues), well below the 66.8% coverage ceiling. Funnel: 1090 sampled → 728 tastes-bearing → 571 token-matched → 505 non-zero net (66 net-zero cancellations, 11.6% of token-matched). By category: Restaurant 58.8%, Bar 60.3%, Cafe 22.7%. Direction split: 415 louder (`+1`) / 90 quieter (`-1`) — 82% loud-skewed. Verdict: **keep the nudge as specified** — it moves nearly half of every pool at trivial classifier-complexity cost; a future lever is a wider cafe-and-quiet-aware allowlist, not removal. Written up as §7 of the `foursquare-tastes-vibe-2026-05` research note; analysis script `nudge-firerate.ts` + Deno test suite `validate-nudge-firerate.test.ts` shipped alongside (16 tests green). PR closes #115.
