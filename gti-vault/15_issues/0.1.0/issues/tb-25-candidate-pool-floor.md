---
issue: tb-25
title: Apply the candidate-pool floor — Restaurant + Sports Bar venue-type allowlist on every Foursquare call
status: done
type: AFK
github_issue: 133
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-19
---

# tb-25 — Apply the candidate-pool floor

## Spec source

[[../../../60_engineering/adr/0012-candidate-pool-floor|ADR 0012 — Candidate-pool floor]]. Amends [[../../../50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]] §5. Closes the un-floored general-call leak found in an undocumented diagnosis session and ratified in the 2026-05-19 `/grill-with-docs` session.

## Problem

A per-member Foursquare fetch is N+1 calls. The N per-cuisine calls are category-scoped (every cuisine category is a `Restaurant` child), but the **general call carries no `fsq_category_ids` at all** — it returns any venue type within radius (parks, gyms, hotels, retail, grocery). The Q5 preference probe and the verdict candidate set both derive from that union, so non-restaurant venues leak into both. No named, shared definition of which venue types are eligible exists — two code paths each decided independently.

## What to build

**1. Seed the candidate-pool floor in the Foursquare query builder.**
The Edge-side Foursquare query builder (`buildFoursquareQuery` in the Foursquare shaping module) must, after assembling its category-id set, seed that set with the **candidate-pool floor if and only if the set is otherwise empty**. The floor is the eight-category `Dining and Drinking` allowlist:

`Restaurant`, `Sports Bar`, `Food Court`, `Food Truck`, `Food Stand`, `Cafeteria`, `Breakfast Spot`, `Bagel Shop`.

- A per-cuisine call already carries a cuisine category id → set non-empty → floor **not** added.
- The general call carries nothing → set empty → floor seeded.
- A future dietary category chip → set non-empty → floor **not** added (dietary is a hard veto, correctly narrower than the floor).

`fsq_category_ids` must never be emitted empty again. The floor is a **fallback, never an addition** — `fsq_category_ids` is OR semantics, so appending the floor to a per-cuisine call would OR-broaden it straight back to all restaurants. The eight floor category ids belong in a single named, exported constant — the canonical source of truth — alongside the existing `CUISINE_CATEGORY_MAP`.

**2. Tighten the MapKit fallback.**
`MapKitPlacesFallback` currently filters POIs to `[.restaurant, .cafe, .foodMarket]`. Tighten to `[.restaurant]` only — `.cafe` and `.foodMarket` sit outside the floor. The `Sports Bar` carve-out is inexpressible in MapKit's POI taxonomy and is dropped in fallback mode; this is documented degraded-mode behavior, not a defect.

Both the Q5 candidate pool and the verdict candidate set derive from the same floored fetch union, so flooring the fetch floors both — no downstream change is needed.

## Verification probes (ADR 0012 open items)

Full autonomy to resolve these — probe what is reachable, document what is not. Do not block the code change on them.

- Confirm whether passing the `Restaurant` parent category id returns all cuisine children on the live post-2025 `/places/search` surface. If it is **not** descendant-inclusive, express the `Restaurant` member of the floor as the explicit cuisine-id list instead.
- Live-probe all eight floor category ids against `/places/search` (expect HTTP 200 + results), as the cuisine ids were probed on 2026-05-17. Source the Foursquare key from `/workspace/.env`.
- Confirm whether MapKit `.restaurant` covers bagel shops / breakfast spots / cafeterias. If not, they are under-included in degraded mode — accept and document, do not block.

Record the resolved category ids and probe results in ADR 0012's Open items section.

## Acceptance criteria

- [ ] The Foursquare query builder emits `fsq_category_ids` on every call; it is never empty.
- [ ] A general call (no cuisine, no dietary category) emits exactly the eight-category floor.
- [ ] A per-cuisine call emits only the cuisine category id — the floor is not OR-appended.
- [ ] The floor is a single named, exported constant.
- [ ] `MapKitPlacesFallback` filters POIs to `[.restaurant]` only.
- [ ] Pure unit tests cover: floor seeded when the set is empty, floor not added when a cuisine id is present, floor not added when a dietary category id is present, and cache-signature stability across the change.
- [ ] The eight floor category ids are live-probed; ADR 0012 Open items updated with the ids and results.
- [ ] The Deno test suite and the `ios` CI lane are green.

## Out of scope

- Cuisine stays a Stage-2 soft scoring axis — do **not** make cuisine a fetch-time strict filter (kills the Q5 factorial's cuisine-drop card).
- Profile dietary wiring into the per-member fetch — a separate tracer bullet.
- Any change to the verdict engine, the Q5 factorial card generator, or the running-union logic — the floor changes only what the fetch returns; downstream code is unaffected by construction.
- New design-system components or tokens — no UI work.

## Blocked by

- Nothing. ADR 0012 is a complete spec and the surfaces (`buildFoursquareQuery`, `MapKitPlacesFallback`) already exist.

## Comments

- **2026-05-19 — done (PR #135).** `CANDIDATE_POOL_FLOOR_CATEGORY_IDS` added to `supabase/functions/_shared/foursquare.ts` as the single exported eight-id constant; `buildFoursquareQuery` seeds it iff the assembled category-id set is empty (fallback, never an OR-addition). `fsq_category_ids` is now always emitted non-empty. `MapKitPlacesFallback` POI filter tightened to `[.restaurant]`. All eight floor ids live-probed against `/places/search` on 2026-05-19 — HTTP 200 across the board; the `Restaurant` parent id was confirmed descendant-inclusive (a parent-only search returned cuisine-child category ids), so the floor carries the single parent id rather than the enumerated cuisine list. `Food Stand` returns zero rows at the probe geos but is a valid (HTTP 200) sparse category — kept. ADR 0012 Open items section updated with the resolved ids and the probe table. Full Deno suite green (307 tests); the three pre-existing `places-proxy-core` / `foursquare` tests that asserted `fsq_category_ids` absence were updated to the new floored behavior per ADR 0012. The `ios` change is a one-line POI-filter constant — not unit-testable purely (MapKit needs a device/simulator); the `ios` CI lane covers compilation.
