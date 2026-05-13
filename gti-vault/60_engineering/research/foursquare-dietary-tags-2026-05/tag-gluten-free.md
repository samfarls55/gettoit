---
tag: gluten-free
status: docs-audit-only
verified_against_api: false
---

# Tag — gluten-free options

| Field | Value |
|---|---|
| Tag name (API surface) | `tastes` surface term `"gluten-free options"` / `"gluten-free menu"`. No top-level category for "gluten-free restaurant" in the Foursquare taxonomy. |
| Endpoint exposing it | `GET /v3/places/{fsq_id}` with `?fields=tastes` (also possibly gated to premium). |
| Coverage estimate | **Unverified.** Public anecdata suggests gluten-free is the second-most-commonly-tagged menu attribute after vegetarian; coverage in major US metros likely 30–55% of restaurants but unverified. |
| Confidence in tag | User-derived + ML-inferred. Lower than vegan (which has clear category signal). |
| Cost implications | If `tastes` is Premium-only, this becomes a paid path. |

## What the menu-compliance lock actually needs

Filter to restaurants that **offer** gluten-free options. The bar is lower than allergy-safe — "offers gluten-free dishes" is a menu-callout question, not a kitchen-protocol question. The user-perception spectrum is wide: someone with mild gluten sensitivity is satisfied by a labeled menu item; celiac users need kitchen-level protocols (separate prep surface, etc.) that Foursquare cannot surface.

## Public-docs picture

- No category-level signal. Has to be derived from `tastes` or from menu data (which Foursquare does not generally expose at the free tier).
- The `tastes` field, when populated, frequently includes gluten-free as a tag because users explicitly check in / tip about it.

## Risk if used naively

If `tastes` is sparse, false-negative rate is high — a restaurant that offers gluten-free pasta but has no user tip about it gets filtered out. The user with the gluten-free hard-need sees fewer options than they should. False positives also matter: the celiac case where Foursquare's "gluten-free menu" tag does not imply kitchen safety.

**Copy implication:** if we surface this filter, the verdict's rule chip must be honest about the limitation. Suggested register: `"This filters for restaurants with gluten-free menu options. Confirm with the venue if you need a celiac-safe kitchen."` — non-blaming, defers final-mile safety to the user.

## Verification needed

Probe `tastes` coverage on N=100 sample in beta metro. Cross-check against a known-safe data source (e.g. Find Me Gluten Free aggregator) on the same sample to estimate Foursquare's recall.

## Open questions

- Does Foursquare expose `dietary_restrictions` at any tier with a `gluten_free: boolean`?
- Is there a way to distinguish celiac-safe (kitchen protocol) from menu-option-available?
