---
folder: 60_engineering/research/foursquare-dietary-tags-2026-05
purpose: Verify Foursquare Places API dietary-tag coverage for the 0.1.0 Q1 menu-compliance filter
prd: 0.1.0-prd
adr: 0002
issue: 15_issues/0.1.0/issues/05-foursquare-dietary-tags
---

# foursquare-dietary-tags-2026-05 — Research

Audit of Foursquare Places API for the dietary tags the 0.1.0 Q1 mechanic requires. The Q1 lock ([[../../../50_product/0.1.0-design-locks|0.1.0-design-locks.md]] Lock 1) treats Q1 as a **menu-compliance filter** — restaurants must *offer* compliant options, not exclusively be of that type. This needs the API to expose per-restaurant dietary signals.

## Contents

- [[tag-vegan|tag-vegan.md]] — Audit of `vegan` / vegan-friendly coverage.
- [[tag-vegetarian|tag-vegetarian.md]] — Audit of `vegetarian` coverage.
- [[tag-gluten-free|tag-gluten-free.md]] — Audit of gluten-free options.
- [[tag-halal|tag-halal.md]] — Audit of halal coverage.
- [[tag-kosher|tag-kosher.md]] — Audit of kosher coverage.
- [[tag-allergens|tag-allergens.md]] — Audit of allergen handling (shellfish-safe, nut-safe).
- [[report|report.md]] — Synthesis + recommendation (A / B / C per the issue).

## Status

- [x] Audit framework + per-tag scaffolds written (2026-05-12)
- [x] Public-docs audit of Foursquare API surface (2026-05-12)
- [ ] **Live coverage probes against beta metro** — blocked on Foursquare API key (see [[../../../15_issues/0.1.0/issues/tb-00-external-accounts|TB-00]]). Per-tag `coverage_estimate_pct` fields stay `unverified` until that lands.
- [x] Report drafted with recommendation contingent on live verification (2026-05-12)

## Reading order

Start with [[report|report.md]] — it carries the recommendation and the open verification gates. The per-tag files are reference for the report's claims.

## Open dependencies

The audit cannot produce real coverage numbers (% of restaurants in a sample US metro with the tag set) without a working API key and a sample-metro probe. The recommendation is conditional on the probe matching the public-docs picture. If the probe disagrees, the recommendation flips per the rules in [[report#decision-rules|report.md §decision-rules]].

## Related

- [[../../adr/0002-places-data-foursquare-mapkit|ADR 0002]] — Foursquare primary, MapKit fallback.
- [[../../../50_product/0.1.0-design-locks|0.1.0-design-locks]] — Lock 1 (Q1 mechanic).
- [[../../../15_issues/0.1.0/issues/05-foursquare-dietary-tags|Issue 05]] — issue this bundle closes.
- [[../../../15_issues/0.1.0/issues/tb-05-foursquare-placesproxy|TB-05]] — PlacesProxy tracer bullet that consumes this finding.
