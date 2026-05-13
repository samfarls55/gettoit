---
tag: kosher
status: docs-audit-only
verified_against_api: false
---

# Tag — kosher

| Field | Value |
|---|---|
| Tag name (API surface) | `categories.id` — "Kosher Restaurant" category (historically id `13351`). `tastes` surface term `"kosher"`. |
| Endpoint exposing it | `GET /v3/places/search?categories=13351`. |
| Coverage estimate | **Unverified.** Like halal, kosher is overwhelmingly a category-level signal — kosher kitchens self-identify because the cert is the kitchen, not the dish. |
| Confidence in tag | Foursquare-curated for the category label (high). |
| Cost implications | Category filter is free-tier. |

## What the menu-compliance lock actually needs

Filter to restaurants that **offer** kosher dining. Like halal, this is a case where the category signal is closest to user intent — kosher observers want a kosher kitchen, not a single dish.

## Public-docs picture

- Kosher Restaurant category captures kosher-certified kitchens.
- Coverage is heavily concentrated in metros with large Jewish populations (NYC, LA, Miami). In a beta metro outside those, the category count may be in single digits — that's reality, not API limitation.

## Risk if used naively

For metros with thin kosher coverage, the candidate set is tiny — small group with one kosher member triggers no-survivor mode frequently in those metros. This is not a Foursquare problem; it's a reality problem. Design implication: `no-survivor` copy in those metros may want to be slightly different (`"Kosher kitchens are rare here tonight"`) but that's downstream of the Lock and outside this audit.

## Verification needed

Probe `categories=13351` count in beta metro. If count is very low, flag for metro-selection decision in beta cohort planning.

## Open questions

- Are there sub-categories (Kosher Deli, Kosher Bakery, Kosher Restaurant — full meal) that we should pre-filter?
- Does the API expose a "kosher-style" attribute distinct from "kosher-certified"? Unclear.
