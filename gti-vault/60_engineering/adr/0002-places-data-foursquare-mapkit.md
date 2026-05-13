---
adr: 0002
title: Places data source — Foursquare primary, MapKit fallback
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0002 — Places data: Foursquare primary, MapKit fallback

## Status

Accepted — 2026-05-12.

## Context

The food vertical needs a third-party places dataset. Restaurants surface as the candidate set EBA elimination runs against ([[../../50_product/decision-model|decision-model]]). [[../stack-patterns#food-vertical--geo|stack-patterns.md]] proposed Foursquare as the cost-floor pick, but the choice was not ratified.

Candidates considered:

- **Google Places** — rejected. Paid since Feb 2025; per-call billing at our usage shape compounds quickly.
- **Yelp Fusion** — rejected. Moved to paid; no acceptable free tier for v1.
- **Foursquare Places** — free tier ~10k calls/month on the endpoints we need (place search, details).
- **Apple MapKit POI search** — free with Apple Developer account; native iOS only.

## Decision

**Foursquare Places as the primary source. Apple MapKit POI search as the fallback** when Foursquare returns thin results, exceeds quota, or is unreachable.

Implementation outline:

- `places` cache table in Supabase stores Foursquare results keyed by `(geo_h3, query_signature)` with a TTL (working assumption: 24 hours for hot zones, 7 days for cold).
- iOS client never calls Foursquare directly; an Edge Function proxies, signs the API key from environment, returns shaped rows, and writes to the cache.
- MapKit fallback is iOS-side because the API is native. Web fallback skips MapKit — Foursquare-only on web; if Foursquare fails on web, surface a graceful "couldn't load options nearby" state.

## Why

1. **Cost floor.** Free tier covers a single-metro beta with comfortable headroom.
2. **Metadata richness.** Price tier, hours, cuisine tags, photos — all signals EBA quiz questions need (budget cap, open-now, cuisine veto).
3. **Vendor risk hedged.** MapKit fallback means a Foursquare pricing flip or outage doesn't sink the app — degraded mode, not dead mode.
4. **PostGIS-native cache shape.** Foursquare rows store cleanly with `geography(Point, 4326)` and `ST_DWithin` queries (see [[../stack-patterns#food-vertical--geo|stack-patterns]]).

## Consequences

### Positive

- Single API integration to learn; cached aggressively to stretch quota.
- Pricing path stays free at beta scale.
- Fallback exists; vendor concentration risk minimized.

### Negative / accepted tradeoffs

- **Foursquare changed pricing once before.** Monitor billing-page changes; budget for a forced migration to MapKit-only if free tier disappears.
- **MapKit web parity gap.** Web fallback has no MapKit option. If Foursquare is down, web fallback degrades to an error state. Acceptable for v1 beta scale.
- **Cache invalidation is now an operational concern.** Wrong TTL = stale hours-of-operation data. Adjustable per-zone.

## Re-evaluation triggers

- Foursquare flips to paid or tightens free-tier limits below 10k/mo.
- MapKit POI search rate-limits surface in beta.
- A second vertical (bars, activities) lands and Foursquare's coverage for that vertical proves thin.

## References

- [[../stack-patterns#food-vertical--geo|stack-patterns.md §Food vertical / geo]]
- [[../../50_product/decision-model|decision-model.md]]
- [[0001-ios-tech-stack-supabase|ADR 0001]] (PostGIS rationale)
