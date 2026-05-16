---
folder: 60_engineering/research/foursquare-filter-surface-2026-05
purpose: Fix the Foursquare fetch-time filter surface + venue-response metadata mapping the v1.1 quiz redesign depends on
prd: v1.1-quiz-redesign-prd
adr: 0002
issue: 15_issues/v1.1/issues/research-01-foursquare-filter-surface
---

# foursquare-filter-surface-2026-05 — Research

Research spike for the v1.1 quiz redesign. Investigates the Foursquare Places API request surface and venue-response payload to fix two things the rest of v1.1 depends on:

1. **Fetch-time filters** — which `GET /places/search` request parameters can legitimately strict-filter a fetch, and how each v1.1 quiz input maps onto them.
2. **Client-side-scored metadata** — which venue-response fields the reputation axis (Popular / Hidden gem / Classic / New / No preference) and the vibe axis (5-point energy scale) can read *after* the fetch, since neither can strict-filter.

**No application code shipped** — this is a documentation deliverable. It closes issue [[../../../15_issues/v1.1/issues/research-01-foursquare-filter-surface|research-01]].

## Contents

- [[report|report.md]] — the full spike: fetch-time filter table, the not-filterable confirmations, the reputation + vibe metadata mappings, and the graded-axis recommendation.

## Status

- [x] Foursquare request surface enumerated; strict-filter vs non-filter parameters separated (builds on the v1 surface verified in ADR 0002).
- [x] Every v1.1 quiz input mapped to a fetch-time filter or flagged not-filterable.
- [x] Reputation + vibe venue-metadata mappings proposed.
- [x] Graded-axis open question answered (recommendation C — widen the tolerance band).
- [ ] **Open verification gate** — live beta-metro coverage probe for `rating` / `stats` / `date_created` / `attributes`. Folded into tb-07's first step (per-member fetch), alongside the still-outstanding `tastes` probe from TB-05. See report section 8.

## Reading order

Start with [[report|report.md]] — single document, carries the whole finding. Section 2 is for the fetch planner (modules D, tb-07/tb-10); sections 4-5 are for the axis scorers (module E, tb-09); section 6 is for the Q5 factorial (tb-08).

## Convention note

Bundle name is `<topic-slug>-YYYY-MM` per the [[../_index|research/ index]] convention. Unlike the deep-research bundles in this folder, this spike is a single synthesis document — no `outline.yaml` / `fields.yaml`, because it was not an item-by-item deep-research run but a targeted API + payload investigation.

## Related

- [[../../adr/0002-places-data-foursquare-mapkit|ADR 0002]] — Foursquare primary / MapKit fallback.
- [[../foursquare-dietary-tags-2026-05/_index|foursquare-dietary-tags-2026-05/]] — the v1 dietary-tag audit; same API, same outstanding live-probe gap.
- [[../../verdict-engine|verdict-engine.md]] — v1 VerdictEngine; the soft-pref relax cascade the graded-axis recommendation aligns with.
- [[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — parent PRD.
- [[../../../15_issues/v1.1/issues/research-01-foursquare-filter-surface|research-01]] — issue this bundle closes.
