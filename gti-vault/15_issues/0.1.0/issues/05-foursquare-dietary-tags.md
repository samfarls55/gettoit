---
issue: 05
title: Verify Foursquare dietary-tag coverage for menu-compliance filtering
github_issue: 23
status: done
completed: 2026-05-12
triage: needs-human-review
created: 2026-05-12
prd: 0.1.0-prd
adr: 0002
---

# 05 — Verify Foursquare dietary-tag coverage

## Why

The 0.1.0 PRD ([[../../../10_prds/0.1.0-prd|0.1.0-prd.md]]) and [[../../../50_product/0.1.0-design-locks|0.1.0-design-locks.md]] Lock 1 lock the Q1 dietary mechanic as a **menu-compliance filter**, not a restaurant-type filter. The engine filters to restaurants that *offer* compliant options (vegan, halal, kosher, gluten-free, common allergens), not to restaurants exclusively of that type.

This requires Foursquare to expose menu-level dietary tags at the restaurant record level. The mechanic is locked in product spec but the data feasibility has not been verified against the Foursquare Places API.

## Scope

This is a research + documentation issue, not a design or implementation issue.

- **Audit the Foursquare Places API** for the dietary tags the Q1 mechanic requires:
  - `vegan_friendly` / has vegan options
  - `vegetarian_friendly`
  - `gluten_free_options`
  - `halal`
  - `kosher`
  - `shellfish-safe` / `nut-safe` / common allergen handling
- **Document findings** in a new file at `gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/_index.md` (create the folder). Per-tag fields:
  - Tag name in the API
  - Endpoint exposing it
  - Coverage estimate (e.g. % of restaurants in a sample US metro that have the tag set)
  - Confidence (Foursquare-curated vs. user-submitted vs. ML-inferred)
  - Cost implications (does using the tag require a paid endpoint?)
- **Recommend a fallback design** if tag coverage is thin (< 60% in the beta metro):
  - Option A — infer from cuisine category. `vegan_friendly = true` if cuisine includes "Vegetarian" or "Vegan." Lossy but consistent.
  - Option B — user-reported corrections. The verdict surface offers a feedback chip after the verdict ("This place doesn't actually have vegan options"); corrections feed back into the cache.
  - Option C — narrow the Q1 mechanic in 0.1.0 to only the dietary tags Foursquare reliably exposes; mark the others as "we can't filter for this yet — please confirm with the venue before going."

## Acceptance criteria

- [ ] Research bundle at `gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/_index.md` created.
- [ ] One file per dietary tag in the bundle with the audit fields above.
- [ ] A summary `report.md` in the bundle recommending one of options A / B / C, with the rationale.
- [ ] If the recommendation forces a change to Lock 1 or to the PRD, propose the diff as a comment on this issue and tag with `needs-human-review` triage status.

## Open questions

- Whether Foursquare's free-tier endpoints expose the tags or only the paid tier. If tags are paid-only, the cost calculus in [[../../../60_engineering/adr/0002-places-data-foursquare-mapkit|ADR 0002]] re-opens.
- Whether MapKit's POI data exposes any dietary metadata at all (likely no — but worth confirming for the fallback path).
- Whether a third source (e.g. HappyCow for vegan, Find Me Gluten Free) would be worth bolting on as a 0.1.0 enrichment layer. Out of 0.1.0 scope per [[../../../50_product/0.1.0-scope|0.1.0-scope]] "Multi-provider data sourcing per vertical."

## Comments

### 2026-05-12 — audit landed, needs human review

Research bundle published at [[../../../60_engineering/research/foursquare-dietary-tags-2026-05/_index|gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/]]. Report recommends **Option C** (narrow Q1 to what Foursquare reliably exposes) with a future Option B feedback loop.

**Proposed Lock 1 change** (flagged `needs-human-review`): drop allergen filtering from Q1; surface a disclaimer instead. Halal / kosher / vegan / vegetarian filter at category level; gluten-free at `tastes` if a live probe confirms free-tier + ≥40% coverage.

Live probe is blocked on TB-00 (Foursquare API key acquisition) and runs as step 1 of TB-05. Until that lands, the report `status: draft-pending-live-probe`. After the probe, the report flips to `final` and the rules in §decision-rules either hold or trigger their fallback.
