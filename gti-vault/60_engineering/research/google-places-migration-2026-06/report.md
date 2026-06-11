---
title: Google Places migration requirements
date: 2026-06-10
status: draft
source_focus: official Google Maps Platform docs plus local code inspection
---

# Google Places migration requirements

## Summary

Replacing Foursquare with Google Places API (New) is feasible, but it is not a simple URL swap. The existing system bakes Foursquare into API shape, identifiers, cache policy, DB column names, tests, comments, user-facing copy, and domain language.

Recommended first cut: keep the public `places-proxy` request/response contract stable enough that web and mobile do not need simultaneous product rewrites, but introduce a provider-neutral internal shape immediately:

- `place_provider`: `"google"`
- `provider_place_id`: Google `places.id`
- `provider_payload`: shaped Google place data

Avoid writing Google IDs into fields named `fsq_place_id` except as a very short bridge. That shortcut would work mechanically, but it would leave false domain language in the verdict engine, cache, options uniqueness, tests, and future migration work.

## Assumptions

- Goal is replacement work, not provider comparison.
- Use Google Places API (New) Web Service from the Supabase Edge Function. Do not call Google directly from clients.
- Preserve the app-level PlacesProxy concept: clients ask for venues with `lat`, `lng`, `radius_meters`, and quiz filters; server hides provider quirks.
- Keep MapKit fallback as a separate question. Current active mobile app is React Native / Expo, and current local mobile Q5 repository is still fake data; web is the place-proxy-integrated client path today.

## Current Foursquare dependency map

Primary implementation files:

- `supabase/functions/_shared/foursquare.ts`
  - Foursquare request builder, field list, taxonomy maps, dietary maps, cuisine maps, candidate-pool floor, venue-class gate, post-filters, shaping, cache signature, geo bucket.
- `supabase/functions/_shared/places-proxy-core.ts`
  - Cache orchestration, Foursquare fetch, upstream error handling, shaped response envelope.
- `supabase/functions/places-proxy/handler.ts`
  - Requires `FOURSQUARE_API_KEY`, validates request, calls core.
- `web/lib/candidate-fetch.ts`
  - Web Q5 fetch planner, `open_at` token generation, response union by `fsq_place_id`, Q5 classification, factorial cards.
- `web/components/SessionRoom.tsx`
  - Invokes `places-proxy`, persists `member_fetches.payload`.
- `supabase/functions/compute-verdict/index.ts`
  - Reads `member_fetches`, unions by `fsq_place_id`, writes `options`.
- `supabase/functions/_shared/member-fetch-union.ts`
  - Dedupes fetched rows by `fsq_place_id`.
- `supabase/functions/_shared/verdict-engine.ts` and `venue-classifier.ts`
  - Consume Foursquare-shaped payload fields: price, dietary tags, categories, rating, total ratings, date created, tastes.
- `supabase/migrations/20260513183000_places_and_options.sql`
  - `places` cache and `options.fsq_place_id`.
- `supabase/migrations/20260518000000000_member_fetches.sql`
  - Stores raw Foursquare fetch payload.
- `web/app/terms/page.tsx`, `web/components/PlacesEmptyState.tsx`, `.env.example`, deploy-lane tests
  - User/operator-facing Foursquare naming.

Domain docs affected:

- `CONTEXT.md`: candidate pool deduped by `fsq_place_id`, Foursquare category floor.
- `gti-vault/60_engineering/adr/0002-places-data-foursquare-mapkit.md`: accepted provider decision.
- `gti-vault/60_engineering/adr/0012-candidate-pool-floor.md`: Foursquare taxonomy-specific floor.
- Existing Foursquare research bundles remain historical, but should be superseded for Google.

## Google API shape to use

Use Places API (New), not legacy Places.

Main search endpoint:

- `POST https://places.googleapis.com/v1/places:searchNearby`
- Headers:
  - `X-Goog-Api-Key: <server secret>`
  - `X-Goog-FieldMask: places.id,places.displayName,...`
  - `Content-Type: application/json`
- Body:
  - `locationRestriction.circle.center.latitude`
  - `locationRestriction.circle.center.longitude`
  - `locationRestriction.circle.radius`
  - `includedTypes` or `includedPrimaryTypes`
  - `excludedTypes` or `excludedPrimaryTypes`
  - `maxResultCount`
  - `rankPreference`

Nearby Search is closest to the current Foursquare `/places/search` path, but it has important implementation differences:

- It requires a field mask; omitting it errors.
- It returns at most 20 results per call, not the current Foursquare `limit=50`.
- `locationRestriction.circle.radius` max is 50,000 m, still above the product's 5 mi max.
- Types are Google string enums, not taxonomy IDs.
- If multiple type restrictions are specified, Google documents combined semantics; for `includedTypes`, response includes places matching at least one included type and none of the excluded types.

Text Search may be useful for dietary/cuisine-specific fallback calls:

- `POST https://places.googleapis.com/v1/places:searchText`
- Supports `textQuery`, `priceLevels`, `minRating`, `openNow`, `includedType`, `strictTypeFiltering`, pagination, and location bias/restriction.
- But `locationRestriction` for Text Search is rectangular, not circular. For product's search-area circle, Nearby is cleaner.

## Field mask and billing impact

Field mask is both payload contract and cost control. Google bills the request at the highest SKU for any requested field.

Minimum useful Nearby field mask for GetToIt:

```text
places.id,
places.displayName,
places.location,
places.types,
places.primaryType,
places.formattedAddress
```

This is already Nearby Search Pro because display name, location, types, primary type, formatted address, and id are Pro on Nearby.

Fields needed to preserve current verdict/Q5 behavior:

```text
places.priceLevel,
places.rating,
places.userRatingCount,
places.regularOpeningHours
```

These push Nearby Search to Enterprise.

Fields that look tempting but are expensive:

```text
places.servesVegetarianFood,
places.goodForGroups,
places.goodForWatchingSports,
places.liveMusic,
places.outdoorSeating,
places.editorialSummary,
places.generativeSummary
```

These push to Enterprise + Atmosphere. Avoid in first cut unless product explicitly wants them and budget is accepted.

Photos:

- Requesting `places.photos` in search is Pro/available, but fetching the actual image uses Place Photos (New), a separate SKU.
- Google photo names can expire and cannot be cached. Do not copy the Foursquare `prefix + suffix -> persisted URL` pattern.
- If photos stay in first cut, store only enough transient metadata for immediate rendering and handle author attributions.

Pricing snapshot from official pricing page, checked 2026-06-10:

- Nearby Search Pro: 5,000 free monthly events, then $32 / 1,000 for first 100k.
- Nearby Search Enterprise: 1,000 free monthly events, then $35 / 1,000 for first 100k.
- Nearby Search Enterprise + Atmosphere: 1,000 free monthly events, then $40 / 1,000 for first 100k.
- Place Details Pro: 5,000 free monthly events, then $17 / 1,000 for first 100k.
- Place Details Enterprise: 1,000 free monthly events, then $20 / 1,000 for first 100k.
- Place Photos: 1,000 free monthly events, then $7 / 1,000 for first 100k.

Back-of-envelope for current N+1 fanout:

- One member can produce up to 4 search calls: 3 craved cuisine calls plus 1 general call.
- Three voters can produce up to 12 search calls per room.
- At Nearby Search Enterprise first-tier price, 12 calls is about $0.42 after free usage, before photo/detail calls.
- This should drive a budget/monitoring task before rollout.

## Request/filter translation

Current PlacesProxy input:

```ts
{
  lat: number;
  lng: number;
  radius_meters: number;
  filters?: {
    dietary?: string[];
    price_tier?: number;
    open_at?: string;
    cuisine?: string;
  };
}
```

Recommended first-cut request behavior:

- `lat/lng/radius_meters` -> Nearby `locationRestriction.circle`.
- `cuisine` -> Google type mapping when possible:
  - `mexican` -> `mexican_restaurant`
  - `italian` -> `italian_restaurant`
  - `japanese` -> `japanese_restaurant`
  - `chinese` -> `chinese_restaurant`
  - `thai` -> `thai_restaurant`
  - `indian` -> `indian_restaurant`
  - `american` -> `american_restaurant`
  - `mediterranean` -> `mediterranean_restaurant`
- general call -> candidate-pool floor type set.
- `price_tier`:
  - Nearby Search has no request-side `priceLevels` parameter in the docs inspected.
  - If using Nearby only, request `places.priceLevel` and post-filter/cap after fetch.
  - If using Text Search for some calls, `priceLevels` can pre-filter, but strict circle semantics get weaker.
- `open_at`:
  - Foursquare supports future/local `open_at`.
  - Google Text Search supports `openNow`, not future meal time.
  - To preserve future meal-time filtering, request `regularOpeningHours` and post-filter locally. This is an Enterprise field.
  - If product accepts weaker behavior, drop future-open filtering in first cut and use `currentOpeningHours`/`openNow` only for current sessions. That is a product decision, not just engineering.

Candidate-pool floor mapping:

- Foursquare floor today: Restaurant, Sports Bar, Food Court, Food Truck, Food Stand, Cafeteria, Breakfast Spot, Bagel Shop.
- Google type candidates from Table A:
  - `restaurant`
  - `sports_bar`
  - `food_court`
  - `cafeteria`
  - `breakfast_restaurant`
  - `bagel_shop`
  - possibly `meal_takeaway`, `fast_food_restaurant`, `diner`, `sandwich_shop`, `hamburger_restaurant`, `pizza_restaurant`
- I did not find a direct Google `food_truck` or `food_stand` type in the Table A excerpt. Need live/API-doc confirmation before final floor mapping.
- Since Google types are strings and many cuisine types are already under Food and Drink, the new floor should become a Google-specific ADR amendment rather than a direct copy of Foursquare IDs.

Dietary mapping:

- Current Foursquare mapping uses halal/kosher/vegan category IDs, gluten via `tastes`, and disclaimer tags for dairy/shellfish/nuts.
- Google has `halal_restaurant`, `vegan_restaurant`, `vegetarian_restaurant` types and `servesVegetarianFood`.
- `servesVegetarianFood` is Enterprise + Atmosphere. Use type filters first; avoid Atmosphere in first cut unless needed.
- No obvious first-cut Google signal for gluten-free, dairy, shellfish, or nut protocol. Preserve current disclaimer behavior unless product revisits Q1.

## Response shaping

Introduce a Google raw shape and provider-neutral shaped shape.

Suggested new shape:

```ts
type PlaceProvider = "google";

interface ShapedProviderPlace {
  place_provider: PlaceProvider;
  provider_place_id: string;
  name: string;
  lat: number;
  lng: number;
  price_tier: number | null;
  walk_minutes_estimate: number | null;
  dietary_tags: string[];
  hours: PlaceHours | null;
  photos: PlacePhotoRef[];
  address: string | null;
  categories: string[];
  rating: number | null;
  total_ratings: number | null;
  date_created: string | null;
  tastes: string[];
  attributions: unknown[];
}
```

Mapping:

- Google `id` -> `provider_place_id`.
- Google `displayName.text` -> `name`.
- Google `location.latitude/longitude` -> `lat/lng`.
- Google `formattedAddress` or `shortFormattedAddress` -> `address`.
- Google `types` plus `primaryType` -> `categories` / classification inputs.
- Google `priceLevel` -> app `price_tier`.
- Google `rating` -> app `rating` but convert from Google 0..5 to either preserve 0..5 or normalize to existing 0..10 assumption. Existing classifiers assume Foursquare 0..10 thresholds, so do not pass raw Google ratings without retuning thresholds.
- Google `userRatingCount` -> `total_ratings`.
- Google `regularOpeningHours` / `currentOpeningHours` -> `hours`, if requested.
- Google has no direct `date_created` equivalent found in docs. Shape as null and retune "new/classic" reputation bucket or drop that branch.
- Google has no direct `tastes` equivalent found in docs. Shape as empty array and expect vibe nudges to mostly stop firing, or replace with Google Atmosphere fields later.

High-risk classifier changes:

- `web/lib/candidate-fetch.ts` and `supabase/functions/_shared/venue-classifier.ts` both encode Foursquare rating scale, category words, record-age, and `tastes` nudge logic.
- They must be retuned together. Otherwise Q5 and server verdict can classify the same Google venue differently.

## Schema/cache requirements

Current schema is Foursquare-named:

- `options.fsq_place_id`
- uniqueness: `(room_id, fsq_place_id)`
- `member_fetches.payload` contains Foursquare-shaped rows
- `places.payload` stores Foursquare-shaped rows
- comments and RLS docs explicitly say Foursquare

Recommended migration:

1. Add provider-neutral columns:
   - `options.place_provider text not null default 'google'`
   - `options.provider_place_id text`
2. Backfill from `fsq_place_id` only if preserving old rooms.
3. Add unique constraint on `(room_id, place_provider, provider_place_id)`.
4. Update compute-verdict insert/upsert to use the new unique key.
5. Keep `fsq_place_id` only as compatibility/deprecation column until old code is gone, then remove/rename in a later migration.
6. Update `member_fetches` comments and payload expectations to provider-neutral wording.
7. Rename or replace `places` cache semantics:
   - If caching Google content, confirm terms first.
   - Safer first cut: do not persist full Google content in shared cache; store only place IDs and room-scoped snapshots needed for immediate decision flow, or set very short TTL and document deletion.

Google policy/caching issues are blockers:

- Google docs say Place IDs are exempt from caching restrictions and can be stored.
- Google Service Specific Terms say Places API latitude/longitude values may be cached for up to 30 days.
- Google policy page says do not prefetch/cache/store Places API content except allowed exceptions.
- Current `places` cache stores full shaped payload for 24h/7d and planned deletion only after 30 days. Current `member_fetches` and `options` persist full payload as product state. That storage pattern needs legal/product review before shipping Google-sourced content.

## Attribution/UI/legal requirements

Google attribution must be handled explicitly:

- Public Terms of Use and Privacy Policy must reference Google terms/policy as required.
- When displaying Places data without a Google Map, show Google Maps attribution/logo near the content.
- If displaying data on a map, do not combine Google Places content with a non-Google map unless terms allow it.
- If displaying third-party attributions returned by the Place object, include them.
- If displaying photos, include photo author attribution when present.
- If displaying reviews, include author attribution and links as required.
- Avoid AI summaries in first cut; they add disclosure/reporting/link requirements.

Repo touchpoints:

- `web/app/terms/page.tsx` currently mentions Foursquare.
- Venue cards / verdict surfaces need Google Maps attribution if they show Google content.
- Photo handling should stop assuming cached raw image URLs.

## Operational setup

Required before code can run:

- Google Cloud project with billing enabled.
- Places API (New) enabled.
- Server-side API key or OAuth path. API key is simpler.
- Restrict key by API at minimum. IP restriction may be hard from Supabase Edge Functions unless outbound IPs are stable/known.
- Add Edge secret: `GOOGLE_PLACES_API_KEY`.
- Update `.env.example`.
- Update CI/deploy lane tests that currently assert `FOURSQUARE_API_KEY`.
- Add budget alerts and quota monitoring before production.
- Add live integration test gated by `GOOGLE_PLACES_API_KEY`, equivalent to current `places-proxy/live-integration.test.ts`.

## Suggested implementation sequence

1. Add provider-neutral types and DB columns.
   - Verify: migration test or SQL review; existing compute-verdict tests still pass.

2. Add `google-places.ts` pure module beside `foursquare.ts`.
   - Functions: validate Google response shape, build Nearby request, map quiz filters to request body, shape Google Place to provider-neutral row, post-filter price/open/dietary, compute cache signature.
   - Verify: Deno tests with recorded Google-style fixtures.

3. Update `places-proxy-core.ts` to call Google behind the same HTTP function name.
   - Keep external endpoint `places-proxy`.
   - Replace `FOURSQUARE_API_KEY` with `GOOGLE_PLACES_API_KEY`.
   - Preserve `is_thin`, `served_from_cache`, and `error` envelope.
   - Verify: `npm run verify:edge`.

4. Update union/dedup paths.
   - Use `(place_provider, provider_place_id)`.
   - Keep compatibility mapper from old `fsq_place_id` where old test fixtures still exist.
   - Verify: compute-verdict union/upsert tests.

5. Retune Q5 and verdict classifiers.
   - Rating scale: Google 0..5 vs Foursquare 0..10.
   - No `date_created`: adjust new/classic buckets.
   - No `tastes`: remove or replace vibe nudge.
   - Categories/types: use Google type strings.
   - Verify: web candidate-fetch tests and Deno venue-classifier tests.

6. Update web call sites and persisted payload writes.
   - `web/lib/candidate-fetch.ts`: rename `fsq_place_id` usage.
   - `web/components/SessionRoom.tsx`: rawFetch persistence.
   - UI copy: no Foursquare error text.
   - Verify: `npm run verify:web`.

7. Decide cache policy and attribution before enabling in prod.
   - If unresolved, disable shared content cache and avoid photos/details in first cut.
   - Verify: manual checklist plus legal/product signoff.

8. Add live canary.
   - One known metro radius.
   - Assert non-empty Google response, valid provider IDs, no missing required fields, and no accidental Atmosphere fields in field mask.

## Main decisions still needed

1. Cache/legal stance: RESOLVED 2026-06-10.
   - Durable records may store `place_provider = "google"`, Google Place ID, room/plan/verdict IDs, votes, and app-owned verdict metadata.
   - Google-sourced place latitude/longitude may be cached for at most 30 consecutive calendar days if needed, with an explicit purge path.
   - Durable records must not preserve full Google place display payloads such as name, address, rating, rating count, price level, opening hours, photos/photo names, reviews, attributions, or category/type lists as long-lived history state.
   - Verdict and history surfaces should refetch current Google display fields by Place ID when rendering, with Google attribution. If refetch fails, show a degraded historical verdict record using app-owned data.

2. Field mask tier: RESOLVED 2026-06-10.
   - First Google cut should use Enterprise + Atmosphere where needed because atmosphere/vibe signals are critical to the app's success.
   - Required Enterprise fields should include the current behavior-preserving decision inputs: price, rating, rating count, and opening-hours fields needed by the selected open-time policy.
   - Required Atmosphere fields should include app-relevant structured venue attributes such as `goodForGroups`, `goodForWatchingSports`, `liveMusic`, `outdoorSeating`, `servesVegetarianFood`, `servesDinner`, `servesLunch`, `servesBreakfast`, `servesBrunch`, `takeout`, `delivery`, `dineIn`, and `reservable`.
   - Include `reviewSummary` and `generativeSummary` for Q5/vibe signal in the first cut. Treat both as transient Google display/classification inputs: do not preserve them in durable history, and display them only with required Google/Gemini attribution, disclosure, and flag/reviews links as applicable.
   - Exclude raw `reviews` in the first cut unless a dedicated review-excerpt UI is later accepted with author attribution, Google Maps links, flag links, and storage constraints.
   - Exclude `editorialSummary` in the first cut because Google requires the text to be presented as-is and not modified, making it less suitable as a classifier/card-copy input.
   - Field masks must remain explicit and reviewed; do not request broad Atmosphere fields beyond the accepted allowlist.

3. Open-time semantics:
   - Preserve future meal-time filtering with `regularOpeningHours` post-filter.
   - Or simplify to current/open-now behavior.

4. Photo policy:
   - Drop photos in first cut.
   - Or add Place Photos on-demand with attribution and no cached photo names.

5. Identifier migration:
   - Full provider-neutral rename now.
   - Or bridge old `fsq_place_id` fields briefly, with explicit deprecation issue.

## Sources checked

- Google Nearby Search (New): https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Google Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
- Google Place Data Fields (New): https://developers.google.com/maps/documentation/places/web-service/data-fields
- Google Place Types (New): https://developers.google.com/maps/documentation/places/web-service/place-types
- Google Place IDs: https://developers.google.com/maps/documentation/places/web-service/place-id
- Google Place Photos (New): https://developers.google.com/maps/documentation/places/web-service/place-photos
- Google Places API policies/attribution: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps Platform pricing: https://developers.google.com/maps/billing-and-pricing/pricing
- Google Maps Platform pricing categories: https://developers.google.com/maps/billing-and-pricing/pricing-categories
- Google Maps Platform Service Specific Terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
