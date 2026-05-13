---
tag: vegetarian
status: docs-audit-only
verified_against_api: false
---

# Tag — vegetarian / vegetarian-friendly

| Field | Value |
|---|---|
| Tag name (API surface) | `categories.id` (Foursquare "Vegetarian / Vegan Restaurant" cluster — historically id `13377` is shared with vegan in some snapshots); `tastes` surface terms `"vegetarian options"`, `"vegetarian menu"` |
| Endpoint exposing it | Same as vegan: `GET /v3/places/search`, `GET /v3/places/{fsq_id}`, `GET /v3/places/{fsq_id}/tastes` |
| Coverage estimate | **Unverified.** Expected slightly better than vegan because vegetarian is more common as an explicit menu callout, but the same omnivore-restaurant undercounting applies. |
| Confidence in tag | Foursquare-curated for the category label (high); `tastes` mixed (medium). |
| Cost implications | Same gating risk as vegan — `tastes` may be Premium-tier. |

## What the menu-compliance lock actually needs

Filter to restaurants that **offer** vegetarian dishes. The set is much larger than vegan-friendly (most omnivore restaurants serve at least one vegetarian dish), so a permissive default is correct.

## Public-docs picture

- Foursquare's category taxonomy clusters vegetarian and vegan as a combined category in places — the granularity isn't surfaced at the category-id level. Disambiguation has to happen via `tastes` or `attributes`.
- For an omnivore restaurant with even one veg dish, the `tastes` field, when populated, will frequently include `"vegetarian options"`. Without `tastes`, signal is absent.

## Risk if used naively

Same as vegan. Category filter alone misses the bulk of vegetarian-friendly venues. Need `tastes` or a fallback heuristic.

## Verification needed

Same probe as vegan, with adjusted search term. Specifically check `tastes` coverage on a sample of mainstream/Italian/Mexican/Indian venues — Indian and Italian should be near-100% vegetarian-friendly in reality and should serve as a coverage sanity check.

## Open questions

- Is there a separate `dietary_restrictions` payload exposed in any tier?
- Does the v3 Places API expose a `serves_vegetarian: boolean` (rumored to exist on legacy v2)?
