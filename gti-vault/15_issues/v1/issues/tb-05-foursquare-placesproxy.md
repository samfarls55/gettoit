---
issue: tb-05
title: Foursquare PlacesProxy Edge Function + cache
github_issue: 6
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
adr: 0002
---

# TB-05 — Foursquare PlacesProxy + cache

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The PlacesProxy Edge Function — the only path from the iOS / web client to Foursquare. iOS calls the Edge Function with `(lat, lng, radius_meters, filters)`; the function checks the `places` cache, falls back to Foursquare on miss, writes results into the cache, and returns shaped rows that fit the `options` table. iOS-side MapKit fallback (per ADR 0002) is invoked by the client when the Edge Function reports thin results or fails — MapKit is iOS-native and is not called from the Edge Function.

- **Schema** — `places (geo_h3 text, query_signature text, payload jsonb, cached_at timestamptz)`. Primary key `(geo_h3, query_signature)`. TTL via `cached_at` checks in the Edge Function. `options (id uuid, room_id uuid, fsq_place_id text, payload jsonb)` for per-room snapshots — the `fsq_place_id` column stores Foursquare's new place identifier (post-2025 migration; see [[../../../60_engineering/adr/0002-places-data-foursquare-mapkit#live-api-surface-verified-2026-05-13|ADR-0002 §Live API surface]]).
- **PlacesProxy Edge Function** — TypeScript / Deno. Input: `(lat, lng, radius_meters, filters: { dietary?, price_tier?, open_at? })`. Output: array of `{ fsq_place_id, name, lat, lng, price_tier, walk_minutes_estimate, dietary_tags, hours, photos }` shaped rows. Foursquare Service Key read from env (`FOURSQUARE_API_KEY`). Hot-zone TTL 24h; cold-zone 7d.
  - **Endpoint**: `https://places-api.foursquare.com/places/search` (NOT the legacy `api.foursquare.com/v3/places/search`, which returns HTTP 410).
  - **Required headers**: `Authorization: Bearer ${FOURSQUARE_API_KEY}` and `X-Places-Api-Version: 2025-06-17`. Pin the version date; do not float.
  - **Field shape**: response `results[].fsq_place_id`, `results[].name`, `results[].latitude`/`longitude` (top-level on each result), `results[].location.formatted_address`, `results[].categories[]`. Verify other fields (`price`, `hours`, `dietary_tags`) against a live sample during implementation — schema diff vs. legacy v3 is not yet fully audited.
- **Dietary filter** — pass-through to Foursquare's tag parameters where available. Coverage gaps identified in [[05-foursquare-dietary-tags|spec-gap 05]] research should inform the fallback shape in this function. Until that research closes, ship with Foursquare-native tags only and accept the coverage gap as documented.
- **iOS MapKit fallback** — when the Edge Function response is empty or errors, iOS calls `MKLocalSearch` / `MKMapItemRequest` directly and produces the same shaped rows. Web fallback skips MapKit (per ADR 0002) and surfaces a "couldn't load options nearby" state.
- **Tests** — Edge Function integration test against a recorded Foursquare response set: cache miss writes + returns; cache hit returns without API call; dietary-tag filters round-trip; thin-results signal triggers the empty response that iOS interprets as MapKit-fallback.

## Acceptance criteria

- [ ] `places` and `options` migrations land with RLS — `places` read-shared, write-only by service role; `options` read-scoped to room members.
- [ ] PlacesProxy Edge Function deployed; accepts the documented input; returns the documented output.
- [ ] Cache hit/miss behavior verified by integration test.
- [ ] iOS-side MapKit fallback path implemented and verified against an Edge Function "empty results" response.
- [ ] Web fallback gracefully surfaces "couldn't load options nearby" when Foursquare fails.
- [ ] Foursquare API key never exposed to clients.

## Blocked by

- [[tb-01-walking-skeleton|TB-01]]
- [[tb-00-external-accounts|TB-00]] (Foursquare key)
