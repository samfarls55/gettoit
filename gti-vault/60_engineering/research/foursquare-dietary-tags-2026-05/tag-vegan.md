---
tag: vegan
status: docs-audit-only
verified_against_api: false
---

# Tag — vegan / vegan-friendly

| Field | Value |
|---|---|
| Tag name (API surface) | `categories.id` — vegan venue category (Foursquare taxonomy id `13377` "Vegan Restaurant" historically); also surfaces in `tastes` field on Place Details for venues with curated taste data |
| Endpoint exposing it | `GET /v3/places/search` (returns `categories`), `GET /v3/places/{fsq_id}` (richer `tastes`, `attributes`, `chains`), `GET /v3/places/{fsq_id}/tastes` (premium) |
| Coverage estimate | **Unverified.** Public docs claim "menu and taste data covers major US metros"; no probability statement. Public anecdata: vegan/vegan-friendly category is reliably set for venues that *exclusively* serve vegan, very thin for omnivore venues that *offer* vegan options. |
| Confidence in tag | Foursquare-curated for the category label (high); `tastes` field mix of curated + user-derived + ML-inferred (medium). |
| Cost implications | Category filter is free-tier. `tastes` and richer `attributes` may require Premium tier — public docs are ambiguous about which fields gate at which tier. Probe required. |

## What the menu-compliance lock actually needs

Lock 1 needs to filter to restaurants that **offer** vegan options, not restaurants that are exclusively vegan. The mass of candidate restaurants for a typical group is omnivore venues with a vegan dish on the menu. The Foursquare *category* alone undercounts these badly.

## Public-docs picture

- The category taxonomy reliably identifies venues whose primary classification is "Vegan Restaurant." This is a small subset of vegan-friendly venues.
- The `tastes` field (when populated) surfaces fine-grained menu tags like `"vegan options"`, `"vegan menu"`, `"plant-based"`. Coverage is uneven: high in NYC / SF / LA, thin in mid-size metros, sparse in suburbs.
- No explicit `vegan_friendly: boolean` attribute in the public schema. The signal has to be derived from `categories` ∪ `tastes`.

## Risk if used naively

If we filter Q1 vegan as `categories includes Vegan Restaurant`, we will exclude every omnivore restaurant that serves a vegan entrée — the dominant case. Group with one vegan member would see a candidate pool too narrow to produce a verdict, triggering [[../../../15_issues/v1/issues/04-s05-no-survivor-terminal|no-survivor mode]] much more often than design intends.

## Verification needed

1. Probe `places/search` in beta metro for `categories=13377` and count.
2. Probe Place Details on a random sample of N=100 omnivore restaurants in the same metro; check whether `tastes` includes `"vegan options"` etc. Report what % surface the signal.
3. Test whether `tastes` is gated at Premium tier in the same probe. If gated, falls into ADR 0002 re-evaluation territory.

## Open questions

- Does the `attributes` payload (returned with `?fields=attributes` on Place Details) include `serves_vegan` or similar boolean? Public schema is incomplete here.
- Does Foursquare's `chains` field surface curated chain-level menu tags (e.g. "Chipotle serves vegan")? If yes, cheap signal for chain venues.
