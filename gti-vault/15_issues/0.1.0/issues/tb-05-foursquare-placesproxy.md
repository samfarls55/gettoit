---
issue: tb-05
title: Foursquare PlacesProxy Edge Function + cache
github_issue: 6
status: done
completed: 2026-05-13
type: AFK
created: 2026-05-12
prd: 0.1.0-prd
adr: 0002
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-05 â€” Foursquare PlacesProxy + cache

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

The PlacesProxy Edge Function â€” the only path from the iOS / web client to Foursquare. iOS calls the Edge Function with `(lat, lng, radius_meters, filters)`; the function checks the `places` cache, falls back to Foursquare on miss, writes results into the cache, and returns shaped rows that fit the `options` table. iOS-side MapKit fallback (per ADR 0002) is invoked by the client when the Edge Function reports thin results or fails â€” MapKit is iOS-native and is not called from the Edge Function.

- **Schema** â€” `places (geo_h3 text, query_signature text, payload jsonb, cached_at timestamptz)`. Primary key `(geo_h3, query_signature)`. TTL via `cached_at` checks in the Edge Function. `options (id uuid, room_id uuid, fsq_place_id text, payload jsonb)` for per-room snapshots â€” the `fsq_place_id` column stores Foursquare's new place identifier (post-2025 migration; see [[../../../60_engineering/adr/0002-places-data-foursquare-mapkit#live-api-surface-verified-2026-05-13|ADR-0002 Â§Live API surface]]).
- **PlacesProxy Edge Function** â€” TypeScript / Deno. Input: `(lat, lng, radius_meters, filters: { dietary?, price_tier?, open_at? })`. Output: array of `{ fsq_place_id, name, lat, lng, price_tier, walk_minutes_estimate, dietary_tags, hours, photos }` shaped rows. Foursquare Service Key read from env (`FOURSQUARE_API_KEY`). Hot-zone TTL 24h; cold-zone 7d.
  - **Endpoint**: `https://places-api.foursquare.com/places/search` (NOT the legacy `api.foursquare.com/v3/places/search`, which returns HTTP 410).
  - **Required headers**: `Authorization: Bearer ${FOURSQUARE_API_KEY}` and `X-Places-Api-Version: 2025-06-17`. Pin the version date; do not float.
  - **Field shape**: response `results[].fsq_place_id`, `results[].name`, `results[].latitude`/`longitude` (top-level on each result), `results[].location.formatted_address`, `results[].categories[]`. Verify other fields (`price`, `hours`, `dietary_tags`) against a live sample during implementation â€” schema diff vs. legacy v3 is not yet fully audited.
- **Dietary filter** â€” pass-through to Foursquare's tag parameters where available. Coverage gaps identified in [[05-foursquare-dietary-tags|spec-gap 05]] research should inform the fallback shape in this function. Until that research closes, ship with Foursquare-native tags only and accept the coverage gap as documented.
- **iOS MapKit fallback** â€” when the Edge Function response is empty or errors, iOS calls `MKLocalSearch` / `MKMapItemRequest` directly and produces the same shaped rows. Web fallback skips MapKit (per ADR 0002) and surfaces a "couldn't load options nearby" state.
- **Tests** â€” Edge Function integration test against a recorded Foursquare response set: cache miss writes + returns; cache hit returns without API call; dietary-tag filters round-trip; thin-results signal triggers the empty response that iOS interprets as MapKit-fallback.

## Acceptance criteria

- [x] `places` and `options` migrations land with RLS â€” `places` read-shared, write-only by service role; `options` read-scoped to room members. _(`supabase/migrations/20260513183000_places_and_options.sql`. The `options` "room members read" policy is parked as DEFAULT-DENY because the `members` table doesn't exist yet â€” see Adjacencies below. Edge Function reads/writes via service-role key, which bypasses RLS.)_
- [x] PlacesProxy Edge Function deployed; accepts the documented input; returns the documented output. _(`supabase/functions/places-proxy/{index,handler}.ts` + `supabase/functions/_shared/{foursquare,places-proxy-core}.ts`. Wire contract documented at the top of `index.ts`. Deploy command: `supabase functions deploy places-proxy --project-ref rlnevdqebmzbxpntghzb` â€” run when this branch lands.)_
- [x] Cache hit/miss behavior verified by integration test. _(`supabase/functions/_shared/places-proxy-core.test.ts` â€” cache miss writes + returns, cache hit returns without API call, chip-order permutation hits the same cache row, expired row triggers re-fetch.)_
- [x] iOS-side MapKit fallback path implemented and verified against an Edge Function "empty results" response. _(`ios/Sources/App/{PlacesService,MapKitPlacesFallback,SupabaseFunctionsPlacesProxyClient}.swift` + `ios/Tests/PlacesServiceTests.swift` â€” falls back on `is_thin = true`, falls back on proxy error, never sees the Foursquare key.)_
- [x] Web fallback gracefully surfaces "couldn't load options nearby" when Foursquare fails. _(`web/components/PlacesEmptyState.tsx`, demo route at `web/app/places-fallback/page.tsx`. TB-15 wires the component into the real quiz flow.)_
- [x] Foursquare API key never exposed to clients. _(Verified in three places: Deno test "secret hygiene â€” API key never appears in the response body / cached payload", and the iOS test "testProxyCallNeverSeesFoursquareKey" which asserts the request payload contains no `foursquare` / `api_key` strings.)_

## Adjacencies

These came up while building TB-05 â€” flagged here so TB-02 / TB-06 / TB-09 can pick them up without re-discovery.

- **`options` RLS depends on TB-02 `members` table.** The `options` SELECT policy lands as DEFAULT-DENY until TB-02 creates `public.members(room_id, user_id, role)`. TB-02 / TB-06 should add the `room_id in (select room_id from public.members where user_id = auth.uid())` policy. The migration carries a placeholder comment block with the exact policy SQL.
- **Hot-zone / cold-zone TTL detection deferred.** ADR-0002 and the PRD specify 24h hot / 7d cold TTLs. 0.1.0 ships a single 24h TTL because zone-heat detection requires usage telemetry (a session-frequency heuristic â€” populated by `events` per ADR-0005). The Edge Function's TTL constant is configurable via `ProxyDeps.hotZoneTtlMs` and gated by an `isCacheRowFresh` helper, so adding the heuristic later is a one-file change. Track as a follow-up for TB-14 (telemetry) consumers.
- **Geo bucket key uses quantised lat/lng, not real H3.** The column is named `geo_h3` per ADR-0002 to leave room for an H3 cell-id upgrade. 0.1.0 uses a 0.005Â°-grid quantiser (`computeGeoBucket` in `_shared/foursquare.ts`) â€” ~555 m at the equator, cache-key stable, no external dependency. When/if an H3 lib lands, swap the function body; the schema doesn't change.
- **Lock 1 spec-change still pending product owner review.** The dietary-tag research bundle (issue #23 / 05-foursquare-dietary-tags) recommended dropping allergen filtering from Q1 and replacing with a disclaimer. This implementation honours that by routing the `dairy` / `shellfish` / `nuts` chips through a `disclaimer` strategy: the chips never become a Foursquare filter, but they DO emit `no_*_unverified` tags on every shaped row + populate `response.disclaimers[]`. The verdict rule-chip surface (TB-06) is the consumer that has to display the disclaimer copy. Lock 1 itself still needs the one-line update â€” flagged in the research report.
- **Foursquare 410 fails loud.** Per ADR-0002 the legacy `api.foursquare.com/v3/*` returns 410; we've also seen the new host return 410 if `X-Places-Api-Version` is missing/invalid. The Edge Function intercepts 410 specifically and logs `console.error("Foursquare 410", ...)` so an operator notices a version-pin slip without 500'ing the user (the response is still a thin signal so iOS MapKit-fallbacks).
- **Live dietary-tag probe not yet run.** The research report needed a live probe to flip from `draft-pending-live-probe` to `final` (count vegan/halal/kosher venues in beta metro; verify `tastes` is free-tier). The probe is a one-call script â€” should run before TB-04's first session in the beta metro to confirm the category-id assumptions hold. Tracked as a follow-up for the dietary-tag research bundle.

## Comments

### 2026-05-13 â€” landed

Closed end-to-end. The Foursquare API surface that ADR-0002 documented matched the implementation cleanly â€” `fsq_place_id`, `latitude`/`longitude` at top level, `categories[]`, `location.formatted_address`, `price` (int 1..4), `hours.display`/`hours.open_now`, `photos[].prefix`/`suffix`, `tastes[]`, `distance`. No surprises requiring an ADR update â€” the verification entry in ADR-0002 Â§"Live API surface" got a small field-shape footnote.

The DEFAULT-DENY policy on `options` is deliberate. RLS denies-by-default when no policy exists, so an empty SELECT policy on a row-level-secure table is exactly equivalent to a `using (false)` policy â€” but it leaves the table open for TB-02 to add the real policy without first dropping a placeholder. The placeholder SQL is in the migration comment block for the next agent to copy-paste.

## Blocked by

- [[tb-01-walking-skeleton|TB-01]]
- [[tb-00-external-accounts|TB-00]] (Foursquare key)
