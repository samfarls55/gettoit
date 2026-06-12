---
status: done
type: AFK
github_issue: 353
---

# TB-09: Q5 Strict-Factorial Reliability

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Make Q5's Google-backed candidate cards preserve the strict-factorial probe shape across cuisine, crowd approval, and vibe. Q5 uses deterministic app-owned shuffle keyed to member and `q5_card_set_id`; Google result order is not a display or learning signal. If the pool is thin, vibe relaxes before hard constraints. Replacement must preserve the failed card's axis role; if a visible card cannot be replaced while preserving shape, the member gets one fresh retry under the same locked Room parameters, then a clean no-results failure.

This is intentionally a larger vertical slice because splitting it further would separate provider fetch, factorial shape, replacement, retry, and UI behavior that must be verified together.

## Acceptance criteria

- [ ] Q5 cards are generated from Google-backed candidates while preserving cuisine, crowd approval, and vibe axis roles.
- [ ] Deterministic app-owned shuffle uses member and `q5_card_set_id`; Google result order is never used as a signal.
- [ ] One selected cuisine produces two cuisine keep cards and one contrast card when feasible.
- [ ] Multiple selected cuisines and No Preference produce feasible keep/contrast behavior from the approved pools.
- [ ] Thin pools relax vibe before hard constraints; price, meal timing, provider metadata, Search area, hard safety, and Cuisine NEVERs remain fixed.
- [ ] Missing atmosphere/summaries hurt vibe confidence but do not disqualify.
- [ ] Same-axis replacement preserves visible card positions; if impossible after visibility, one fresh retry is attempted before clean failure.
- [ ] Q5 UI in v0.1.0 shows place name only with Google attribution.
- [ ] Tests cover strict-factorial shape, deterministic shuffle, thin-pool relaxation, same-axis replacement, fresh retry, no-results, and name-only attribution UI.

## Blocked by

- [[tb-04-q1-cuisine-mapping-and-contrast-pool|TB-04: Q1 Cuisine Mapping And Contrast Pool]] - GH [#348](https://github.com/samfarls55/gettoit/issues/348)
- [[tb-05-price-cap-and-quality-metadata-eligibility|TB-05: Price Cap And Quality Metadata Eligibility]] - GH [#349](https://github.com/samfarls55/gettoit/issues/349)
- [[tb-06-locked-room-parameters-and-search-area-eligibility|TB-06: Locked Room Parameters And Search Area Eligibility]] - GH [#350](https://github.com/samfarls55/gettoit/issues/350)
- [[tb-07-meal-timing-and-dine-in-takeout-eligibility|TB-07: Meal Timing And Dine-In/Takeout Eligibility]] - GH [#351](https://github.com/samfarls55/gettoit/issues/351)
- [[tb-08-hard-safety-vetoes-and-active-member-set|TB-08: Hard Safety Vetoes And Active Member Set]] - GH [#352](https://github.com/samfarls55/gettoit/issues/352)
