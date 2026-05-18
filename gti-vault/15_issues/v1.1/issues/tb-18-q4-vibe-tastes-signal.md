---
issue: tb-18
title: Q4 vibe energy from the Foursquare tastes signal
status: needs-triage
github_issue: 102
prd: v1.1-quiz-redesign-prd
created: 2026-05-17
related:
  - "[[tb-16-q5-factorial-card-selection]]"
  - "[[tb-09-preference-function-axis-scorers]]"
---

# tb-18 — Q4 vibe energy from the Foursquare `tastes` signal

> `status: needs-triage` — this issue is **not yet ready for an agent**. It needs a research/design pass first (see [[#Research pass — required before this is ready-for-agent]]). No `type:` is set until that pass fixes the vibe model.

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (E) axis scorers, vibe axis. The PRD deliberately left vibe metadata mapping unspecified ("Out of Scope: Reputation and vibe metadata mapping — the internal logic of the (E) scorers is blocked on the research") and flagged the graded axis as an open design item.

## Background

[[tb-16-q5-factorial-card-selection|tb-16]] shipped the live Q4 vibe axis, but its `Q5VenueClassifier` infers a venue's energy (Quiet → Chill → Social → Lively → Rowdy) from a **category-archetype baseline table** plus a one-step `priceTier` tie-break — i.e. "all steakhouses read as energy X." That is an inference, a free-tier-era workaround chosen because no real per-venue vibe signal was available.

A 2026-05-17 audit of the now-paid Foursquare premium fields (prompted by the v1.1 question "can premium data retrieve Q1-Q4 inputs better?") found:

- **Q1 cuisine** — already on the right mechanism (category-id filter); no premium upgrade needed.
- **Q2 spend cap** — native `max_price` + `price` field; no workaround.
- **Q3 reputation** — already on real premium data (`rating` / `stats.total_ratings` / `date_created`) via the tb-16 classifier; the query-chip was retired in PRD design.
- **Q4 vibe** — the **only** quiz axis still running on a free-tier-era workaround.

Premium fields evaluated as a vibe signal:

- **`tastes`** — a crowd-sourced free-text tag cloud. Carries genuine vibe tokens (`quiet`, `lively`, `trendy`, `romantic`, `crowded`, `good for groups`, `intimate`, `cozy`, `casual`, `spacious`) but buried in folksonomy noise (`trains`, `hummingbirds`, chef names) at ~76% venue coverage.
- **`attributes`** — amenities only (`outdoor_seating`, `wifi`, `reservations`, `delivery`) — **not** atmosphere data. Dead end for vibe. (Useful elsewhere — see [[../service-shape-attributes-unbacked|service-shape-attributes-unbacked]].)
- **`popularity`** — 0..1 score, value-crushed near 1.0 in dense areas; no better than `total_ratings`.
- **`hours_popular`** — busy-hours-by-day; weak indirect energy proxy.

Conclusion: `tastes` via a curated allowlist is the only real vibe upgrade — **incremental, not a silver bullet**. This API has no clean structured vibe field. `tastes` is already in the proxy's `fields` list (already paid for), so consuming it adds no API cost.

## Research pass — required before this is ready-for-agent

1. Build and validate a **curated vibe-token allowlist** mapping `tastes` tokens to the Quiet→Rowdy 5-point energy scale. Source the token set from a real sample of the live `tastes` field, not a guess.
2. Decide how the `tastes`-derived signal **combines with** the tb-16 category-archetype table: full replacement, weighted blend, or category-archetype as the fallback when `tastes` is sparse.
3. Define the fallback for the ~24% of venues with no `tastes` data (almost certainly: fall back to the category archetype).
4. Decide whether this also resolves the PRD's open "graded axis in the factorial" design item or leaves it separate.

Output of the pass: a short vault research note + a firmed-up acceptance-criteria set, after which this issue gets a `type:` and moves to `ready-for-agent`.

## Tentative acceptance criteria (to be firmed during triage)

- [ ] A curated `tastes`→energy allowlist exists, sourced from live `tastes` data.
- [ ] `Q5VenueClassifier` vibe classification consumes the `tastes` signal per the blend decided in the research pass.
- [ ] Venues with absent/sparse `tastes` degrade to the category-archetype path — no regression from tb-16 behavior.
- [ ] Vibe-axis scorer tests cover a token-rich venue, a token-sparse venue, and a no-`tastes` venue.

## Blocked by

No hard code dependency. Gated on the research/design pass above before it can be specified and executed.
