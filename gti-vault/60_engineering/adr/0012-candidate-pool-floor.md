---
adr: 0012
title: Candidate-pool floor — a shared venue-type allowlist for the fetch
status: accepted
date: 2026-05-19
supersedes: null
superseded_by: null
---

# 0012 — Candidate-pool floor

## Status

Accepted — 2026-05-19. Decision recorded; the code change is not yet built (see Open items / Implementation).

## Context

A per-member Foursquare fetch is **N+1 parallel calls** ([[../adr/0002-places-data-foursquare-mapkit|ADR 0002]], `FoursquareFetchPlanner`):

- **N per-cuisine calls** — each scoped server-side to a cuisine category id (`CUISINE_CATEGORY_MAP`). Every cuisine category is a child of Foursquare's `Restaurant` category.
- **1 general call** — `cuisine` absent, so `buildFoursquareQuery` set **no `fsq_category_ids` at all**. It returned *any* venue type within radius: parks, gyms, hotels, retail, grocery stores.

The Q5 preference probe draws its three factorial cards from the unioned pool; the verdict engine ranks the running union of every member's same raw fetch (`unionMemberFetches`, [[../../15_issues/v1.1/issues/tb-21-persist-fetch-server-union|TB-21]]). Both therefore inherited the general call's un-floored breadth — non-restaurant venues could surface as a Q5 card or win a verdict.

An undocumented working session found the root cause: the per-cuisine calls were restaurant-floored (implicitly, by being cuisine-scoped) while the general call was not, and **no named, shared definition of "which venue types are eligible" existed**. Two code paths each decided independently, so they diverged.

## Decision

Define the **candidate-pool floor**: an explicit allowlist of eight Foursquare `Dining and Drinking` subcategories, applied as a **fetch-time hard filter on every Foursquare call**.

The eight members:

1. `Restaurant`
2. `Bar > Sports Bar`
3. `Food Court`
4. `Food Truck`
5. `Food Stand`
6. `Cafeteria`
7. `Breakfast Spot`
8. `Bagel Shop`

Seven of eight are venues whose primary purpose is eating a meal. `Sports Bar` is the single deliberate carve-out from the `Bar` branch — people eat full meals at sports bars. Food Court, Food Truck, Food Stand, Cafeteria, Breakfast Spot, and Bagel Shop sit *outside* the `Restaurant` category in Foursquare's taxonomy as siblings under `Dining and Drinking`, so each must be listed explicitly — a `Restaurant` parent filter does not reach them.

### Mechanism

- **`buildFoursquareQuery` (`supabase/functions/_shared/foursquare.ts`) — seed when empty.** After building `categoryIds`, if it is empty, seed it with the eight-id floor.
  - Per-cuisine call → `categoryIds` already carries the cuisine id (a `Restaurant` subcategory) → floor not added → already inside the floor.
  - General call → `categoryIds` empty → floor seeded.
  - Future dietary category chip (halal / kosher / vegan) → `categoryIds` non-empty → floor not added; dietary is a hard veto, correctly narrower than the floor.
  - `fsq_category_ids` is never empty again. `fsq_category_ids` is OR semantics, so the floor must be a *fallback*, never an addition — appending it to a per-cuisine call would OR-broaden straight back to all restaurants.
- **MapKit fallback (`MapKitPlacesFallback.swift`).** Tightened from `[.restaurant, .cafe, .foodMarket]` to `[.restaurant]` only — `.cafe` and `.foodMarket` are outside the floor.

Both the Q5 candidate pool and the verdict candidate set derive from this single floored fetch union, so they are **identical by construction**.

## Why

1. **Single source of truth.** The bug existed because there was no named, shared floor — just two code paths. A named spec is what stops the divergence from recurring; future eligibility criteria join the same spec.
2. **Stage separation.** The floor is a venue-*class* hard filter — Stage 1, fetch-time, alongside geo / radius / `max_price` / `open_at`. Cuisine stays a Stage-2 soft scoring axis in the verdict engine and never strict-filters the fetch.
3. **Reconciles with [[../../50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]] §5.** §5 says the general call "stays un-category-scoped." That was precise to *cuisine* — keeping the general call cuisine-broad preserves the Q5 factorial's cuisine-drop card. The floor is orthogonal: a venue-class filter, not a cuisine filter. Every cuisine is a `Restaurant` child, so the cuisine-drop card is unaffected. No contradiction — the apparent one is why this ADR exists.
4. **Server-side taxonomy.** The Edge Function owns Foursquare category ids already (`CUISINE_CATEGORY_MAP`). A taxonomy change is an Edge deploy, not an App Store release.

## Considered options

- **Post-fetch client-side filter** — rejected. Wastes API payload, and would have to be duplicated on the iOS path and the verdict path — the exact duplication that caused the bug.
- **iOS planner owns the floor** — rejected. A Foursquare taxonomy change would then need an App Store release. The iOS planner already deliberately keeps cuisine as an advisory tag, not a category id, for this reason.
- **`Restaurant` only, no allowlist** — rejected. Food courts, trucks, stands, cafeterias, breakfast spots, and bagel shops are meal venues that sit outside Foursquare's `Restaurant` category.

## Consequences

### Positive

- The Q5 candidate pool and the verdict candidate set are provably the same set.
- Non-restaurant venues (parks, gyms, retail, grocery) can no longer surface as a Q5 card or a verdict winner.
- A named spec exists for future eligibility criteria to attach to.

### Negative / accepted tradeoffs

- The floor excludes cafes, bakeries, dessert shops, ice-cream parlors, breweries / wineries, gastropubs, and juice bars — venues some groups might want. Accepted: GetToIt v1.1 decides where to eat a meal.
- MapKit degraded mode approximates the floor with `.restaurant` only. The `Sports Bar` carve-out is inexpressible in MapKit's POI taxonomy and is dropped in fallback mode.

## Open items

- **Parent-inclusive verification.** Confirm that passing the `Restaurant` parent category id returns all cuisine children. The 2026-05-17 fix found that legacy short numeric ids return HTTP 400; hierarchical filtering on the post-2025 surface is unverified. If `Restaurant` is not descendant-inclusive, that floor member becomes an explicit cuisine-id list.
- **Live-probe the eight floor category ids** against `/places/search`, as the cuisine ids were probed on 2026-05-17.
- **MapKit bucketing.** Confirm whether Apple Maps files bagel shops / breakfast spots / cafeterias under `.restaurant`. If not, they are under-included in degraded mode — unverified, not asserted either way.

## Implementation

Two-file code change, not yet built:

- `supabase/functions/_shared/foursquare.ts` — the seed-when-empty rule in `buildFoursquareQuery`.
- `ios/Sources/App/MapKitPlacesFallback.swift` — tighten the POI filter to `[.restaurant]`.

## References

- [[0002-places-data-foursquare-mapkit|ADR 0002]] — Foursquare primary / MapKit fallback.
- [[0010-generic-jsonb-votes-schema|ADR 0010]], [[0011-worst-off-protecting-verdict-engine|ADR 0011]] — the verdict engine that ranks the candidate pool.
- [[../../50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]] §5 — the real-time decision function (amended by this ADR).
- [[../../15_issues/v1.1/issues/tb-21-persist-fetch-server-union|TB-21]] — the server-side fetch union.
