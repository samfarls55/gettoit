---
issue: tb-05
title: Foursquare PlacesProxy Edge Function + cache
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

- **Schema** — `places (geo_h3 text, query_signature text, payload jsonb, cached_at timestamptz)`. Primary key `(geo_h3, query_signature)`. TTL via `cached_at` checks in the Edge Function. `options (id uuid, room_id uuid, place_id text, payload jsonb)` for per-room snapshots.
- **PlacesProxy Edge Function** — TypeScript / Deno. Input: `(lat, lng, radius_meters, filters: { dietary?, price_tier?, open_at? })`. Output: array of `{ place_id, name, lat, lng, price_tier, walk_minutes_estimate, dietary_tags, hours, photos }` shaped rows. Foursquare API key from env. Hot-zone TTL 24h; cold-zone 7d.
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
