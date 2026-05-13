---
tag: halal
status: docs-audit-only
verified_against_api: false
---

# Tag — halal

| Field | Value |
|---|---|
| Tag name (API surface) | `categories.id` — Foursquare maintains a "Halal Restaurant" category (id `13352` historically). Also surfaces in `tastes` as `"halal"` for venues with curated taste data. |
| Endpoint exposing it | `GET /v3/places/search?categories=13352`, `GET /v3/places/{fsq_id}` for richer `tastes`. |
| Coverage estimate | **Unverified.** Halal is a stronger category-level signal than vegan/vegetarian because it implies kitchen-level protocol — venues that are halal tend to self-identify as the primary category. Omnivore venues that "have halal options" are rarer than vegan-options venues. |
| Confidence in tag | Foursquare-curated for the category label (high); `tastes` mixed. |
| Cost implications | Category filter is free-tier. |

## What the menu-compliance lock actually needs

Filter to restaurants that **offer** halal options. In practice for halal, the category signal is closer to the truth than for vegan — most users seeking halal want the kitchen to be halal-certified, not a single halal dish on an otherwise non-halal menu. This is a case where category-only filtering is acceptable.

## Public-docs picture

- The Halal Restaurant category captures the bulk of halal-certified kitchens. Foursquare-curated.
- `tastes` may surface "halal options" for additional venues; coverage uneven by metro (high in NYC/Detroit, lower in mid-sized metros).

## Risk if used naively

False-negative on omnivore venues that *do* serve halal but aren't categorized as such. For halal, this is a smaller real-world set than vegan — most halal-observant users prefer category-level certainty anyway. Acceptable in v1.

## Verification needed

Probe `categories=13352` count in beta metro. Compare against community sources (e.g. Yelp halal filter, Zabihah) for the same metro to estimate Foursquare's recall.

## Open questions

- Does Foursquare distinguish between "halal-certified" (formal cert) and "halal-friendly" (no pork, no alcohol, but no formal cert)? Probably not — the distinction matters to observant users.
