---
tag: allergens
status: docs-audit-only
verified_against_api: false
covers:
  - shellfish-safe
  - nut-safe
  - dairy-safe
  - egg-safe
---

# Tag — allergens (shellfish-safe, nut-safe, etc.)

| Field | Value |
|---|---|
| Tag name (API surface) | **No standard allergen attribute in Foursquare Places.** No category, no `tastes` term, no `attributes` boolean covers per-allergen kitchen safety. |
| Endpoint exposing it | None. |
| Coverage estimate | **0%.** This signal does not exist in the Foursquare API surface in any tier publicly documented. |
| Confidence in tag | n/a |
| Cost implications | n/a |

## What the menu-compliance lock actually needs

Filter to restaurants where the allergen (shellfish, nuts, dairy, eggs) is **safe** — meaning the kitchen either doesn't use the allergen at all, or has separate prep protocols. This is a **kitchen-protocol** question, not a menu-callout question.

## Public-docs picture

- Foursquare Places API has no allergen-specific fields at any documented tier.
- The closest signal is `tastes`, which occasionally surfaces tags like `"nut-free options"` from user tips, but coverage is far below the threshold required to make a filter useful.
- This is consistent with the broader places-data industry — Google Places, Yelp, MapKit all lack allergen kitchen-protocol metadata. The information simply isn't curated at scale.

## Implication for Q1 mechanic

Lock 1 listed allergens (shellfish, nuts) as menu-compliance filters. **This is not achievable via Foursquare data in v1.** Three options:

1. **Drop allergen filtering from Q1 in v1.** Surface a disclaimer copy when the user picks an allergen veto: `"We can't filter for allergen-safe kitchens — please confirm with the venue before going."` Honest, defers the safety decision to the user, doesn't pretend the filter is working. Recommended in [[report|report.md]].
2. **User-reported corrections.** Verdict surface adds a feedback chip `"This place doesn't handle [allergen] safely"`; corrections feed back into the cache. Builds the dataset GetToIt would need but doesn't help the first user.
3. **Bolt on a curated allergen layer** (no public dataset exists at the scale needed; would require user-contributed data over time).

## Verification needed

None — the public schema is clear. The verification work is around what *language* to use when a user picks an allergen veto in Q1. That belongs to copy review, not the data audit.

## Open questions

- Will the FDA's allergen-disclosure regulations (US-side) force a structured allergen dataset to emerge in the next 18–24 months? Worth tracking.
- Is there a community-driven allergen DB (analog of HappyCow for vegan) we could partner with for v1.1? Out of v1 scope.
