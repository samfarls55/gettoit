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

Accepted — 2026-05-19. Implemented by tb-25 (2026-05-19) — see Implementation.

## Context

A per-member Foursquare fetch is **N+1 parallel calls** ([[../adr/0002-places-data-foursquare-mapkit|ADR 0002]], `FoursquareFetchPlanner`):

- **N per-cuisine calls** — each scoped server-side to a cuisine category id (`CUISINE_CATEGORY_MAP`). Every cuisine category is a child of Foursquare's `Restaurant` category.
- **1 general call** — `cuisine` absent, so `buildFoursquareQuery` set **no `fsq_category_ids` at all**. It returned *any* venue type within radius: parks, gyms, hotels, retail, grocery stores.

The Q5 preference probe draws its three factorial cards from the unioned pool; the verdict engine ranks the running union of every member's same raw fetch (`unionMemberFetches`, [[../../15_issues/0.1.0/issues/tb-21-persist-fetch-server-union|TB-21]]). Both therefore inherited the general call's un-floored breadth — non-restaurant venues could surface as a Q5 card or win a verdict.

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
3. **Reconciles with [[../../50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]] §5.** §5 says the general call "stays un-category-scoped." That was precise to *cuisine* — keeping the general call cuisine-broad preserves the Q5 factorial's cuisine-drop card. The floor is orthogonal: a venue-class filter, not a cuisine filter. Every cuisine is a `Restaurant` child, so the cuisine-drop card is unaffected. No contradiction — the apparent one is why this ADR exists.
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

- The floor excludes cafes, bakeries, dessert shops, ice-cream parlors, breweries / wineries, gastropubs, and juice bars — venues some groups might want. Accepted: GetToIt 0.1.0 decides where to eat a meal.
- MapKit degraded mode approximates the floor with `.restaurant` only. The `Sports Bar` carve-out is inexpressible in MapKit's POI taxonomy and is dropped in fallback mode.

## Open items

All three probes resolved by tb-25 on **2026-05-19** (live `/places/search`, post-2025 surface, API version `2025-06-17`).

- **Parent-inclusive verification — RESOLVED.** The `Restaurant` parent category id `4d4b7105d754a06374d81259` **is** descendant-inclusive on the post-2025 surface. A parent-only search returned venues tagged with cuisine-child category ids — Japanese `4bf58dd8d48988d111941735`, Italian `4bf58dd8d48988d110941735`, Chinese `4bf58dd8d48988d145941735`, American `4bf58dd8d48988d14e941735`, all members of `CUISINE_CATEGORY_MAP`. The floor therefore carries the single `Restaurant` parent id; the cuisine children are not enumerated.
- **Live-probe the eight floor category ids — RESOLVED.** All eight returned HTTP 200:

  | Member | Category id | HTTP | Result rows (probe geo) |
  |---|---|---|---|
  | Restaurant | `4d4b7105d754a06374d81259` | 200 | 5 (NYC) |
  | Sports Bar | `4bf58dd8d48988d11d941735` | 200 | 3 (NYC) |
  | Food Court | `4bf58dd8d48988d120951735` | 200 | 55 (NYC) |
  | Food Truck | `4bf58dd8d48988d1cb941735` | 200 | 8 (NYC) |
  | Food Stand | `5283c7b4e4b094cb91ad6b1b` | 200 | 0 (NYC + LA) |
  | Cafeteria | `4bf58dd8d48988d128941735` | 200 | 3 (NYC) |
  | Breakfast Spot | `4bf58dd8d48988d143941735` | 200 | 4 (NYC) |
  | Bagel Shop | `4bf58dd8d48988d179941735` | 200 | 5 (NYC) |

  `Food Stand` returned zero rows at both probe geos (NYC and a wide LA radius). The id is valid (HTTP 200, not 400) — it is a genuinely sparse Foursquare category, not a bad id. It stays in the floor: it contributes nothing where empty and is harmless, and is correct where venues exist. The resolved ids are now the canonical `CANDIDATE_POOL_FLOOR_CATEGORY_IDS` constant in `supabase/functions/_shared/foursquare.ts`.
- **MapKit bucketing — accepted as documented degraded mode.** Whether Apple Maps files bagel shops / breakfast spots / cafeterias under `.restaurant` is not verifiable from this environment (MapKit needs a device / simulator). Per the ADR's stated tolerance, this is left as accepted degraded-mode imprecision: if those venue classes are not under `.restaurant`, they are under-included in MapKit fallback only. Not a blocker; documented in the `MapKitPlacesFallback.swift` comment.

## Implementation

Built by tb-25 (2026-05-19):

- `supabase/functions/_shared/foursquare.ts` — `CANDIDATE_POOL_FLOOR_CATEGORY_IDS` exported constant (the eight live-probed ids) plus the seed-when-empty rule in `buildFoursquareQuery`: after assembling `categoryIds`, the floor is seeded iff the set is empty. `fsq_category_ids` is now always emitted non-empty.
- `ios/Sources/App/MapKitPlacesFallback.swift` — POI filter tightened from `[.restaurant, .cafe, .foodMarket]` to `[.restaurant]`.

## Amendment 2026-05-19 — Shape-time primary-class gate ([[../../15_issues/0.1.0/issues/bug-15-pool-floor-allows-multicategory-bars|bug-15]])

### Context

A solo session on 2026-05-19 produced the verdict `Robert's Western World` — a Nashville honky-tonk tagged `["Bar","Burger Joint","Rock Club"]` in prod room `d11b3983-a8f6-4741-81a5-309ba038a2f6`. The iOS verdict surface (`VerdictStore.swift:276`) renders `categories[0]`, so the room saw the verdict displayed as a **Bar** — even though `Bar` is deliberately not in this ADR's eight allowed venue-type categories.

The root cause is a structural limit of this ADR's query-time floor. `fsq_category_ids` is an **OR allowlist** on Foursquare's `/places/search` parameter; it constrains *which categories can match*, not *which venues can be returned*. Foursquare venues are multi-category — Robert's matches the floor as a `Burger Joint` (a child of the `Restaurant` parent id) and rides into the pool. The `Bar` tag is preserved verbatim on the shaped row, and nothing downstream re-checks venue class.

### Decision

Add a **shape-time primary-class gate**, applied in `shapeFoursquareResult`. The gate operates on Foursquare's human category *names* (the data the iOS verdict surface actually renders), case-insensitively.

A shaped row is kept iff **both** hold:

1. **Primary-class gate.** `categories[0]` is not a name in `NIGHTLIFE_CATEGORY_NAMES` and not a name in `ENTERTAINMENT_VENUE_CATEGORY_NAMES`.
2. **Entertainment-venue backstop.** The category set does not contain *both* a nightlife name *and* an entertainment-venue name.

`shapeFoursquareResult` returns `null` when either branch fires — the same null-return path the existing `fsq_place_id` / `name` / `latitude` guards already use. A venue with no `categories` field, or whose primary is an unrecognised string, is **kept** — the query-time floor already constrained the upstream set and we do not over-cut on taxonomy drift.

### Mechanism

Two new exported constants in `supabase/functions/_shared/foursquare.ts`:

- `NIGHTLIFE_CATEGORY_NAMES` — the Bar / lounge / brewery / wine-bar branch.
- `ENTERTAINMENT_VENUE_CATEGORY_NAMES` — `Music Venue`, `Rock Club`, `Night Club`, `Bowling Alley`, `Stadium`.

`shouldKeepByVenueClass(categoryNames)` is the pure decision function the shape function calls. Pure unit tests cover each rule branch.

### Carve-outs

`Sports Bar` and `Gastropub` are explicitly **excluded** from `NIGHTLIFE_CATEGORY_NAMES`. ADR 0012 already carved `Sports Bar` out of the query-time floor on the meal-class rationale (people eat full meals at sports bars). The 2026-05-19 amendment carves `Gastropub` out symmetrically — gastropubs are food-primary by definition.

### Single enforcement point

`shapeFoursquareResult` is the single entry to the proxy's output rows. Q5 probe, candidate-pool union, and verdict pool all derive from that output. One enforcement point therefore reaches all three — the same architectural shape the original query-time floor used.

### Accepted tradeoffs

- **Foursquare category-ordering noise.** A real restaurant Foursquare tags `Bar`-first (City House `["Bar","Italian Restaurant"]`, The Hampton Social `["Wine Bar","New American Restaurant"]`, Tennessee Brew Works `["Brewery","American Restaurant"]`) will be cut. Accepted: a `Bar`-first venue rendering as a Bar verdict would be worse.
- **Cross-time instability.** The same venue can return with different category ordering on different fetches (Kid Rock's came back as `["Bar","Music Venue","Steakhouse"]` and `["Sports Bar","Music Venue"]` in different rooms). Within a single verdict the rule is deterministic; across nights eligibility may flip.
- **Cuisine-restaurant secondary rescue rejected.** A rule that rescues a Bar-primary venue when any cuisine-restaurant name appears later in the list would save City House and The Hampton Social, but it would also let `Losers Bar Downtown` (`["Bar","Bar Food"]` on some fetches) back in. Trades three false-cuts for one false-keep and adds taxonomy fragility. Revisit post-cohort.
- **Name-based rescue rejected.** Treating tokens like `Saloon` or `Honky Tonk` in the venue *name* as a nightlife signal was considered as a third gate. Foursquare names are unreliable for taxonomy (Bridgestone Arena's tag set is more reliable than its name) — the gate stays category-only.

### Implementation

Built by bug-15 (2026-05-19):

- `supabase/functions/_shared/foursquare.ts` — `NIGHTLIFE_CATEGORY_NAMES` + `ENTERTAINMENT_VENUE_CATEGORY_NAMES` exported constants, `shouldKeepByVenueClass` pure helper, and the `shouldKeepByVenueClass` call inside `shapeFoursquareResult` that returns `null` on a cut.
- `supabase/functions/_shared/foursquare.test.ts` — unit tests per rule branch plus a regression-fixture test that replays the exact 36-option pool from prod room `d11b3983` and asserts Robert's Western World drops while both Sports-Bar-primary venues stay.

## References

- [[0002-places-data-foursquare-mapkit|ADR 0002]] — Foursquare primary / MapKit fallback.
- [[0010-generic-jsonb-votes-schema|ADR 0010]], [[0011-worst-off-protecting-verdict-engine|ADR 0011]] — the verdict engine that ranks the candidate pool.
- [[../../50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]] §5 — the real-time decision function (amended by this ADR).
- [[../../15_issues/0.1.0/issues/tb-21-persist-fetch-server-union|TB-21]] — the server-side fetch union.
