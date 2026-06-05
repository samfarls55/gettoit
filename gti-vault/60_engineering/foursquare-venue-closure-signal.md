---
title: Foursquare venue-closure signal â€” investigation
date: 2026-05-18
adr: 0002
relates:
  - 60_engineering/research/foursquare-filter-surface-2026-05
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Foursquare venue-closure signal

Investigation, 2026-05-18. Triggered by the app recommending **Pastime**
(a Nashville sports bar at 717 3rd Ave N / Harrison St) that has been out
of business for some time. Question asked: can the Foursquare Places API
filter out-of-business venues, and what is the distribution of any
open/closed/unsure signal?

## TL;DR

**There is no usable Foursquare-side closure filter on our pinned API
surface.** The probabilistic `closed_bucket` field (Open / LikelyOpen /
Unsure / LikelyClosed / VeryLikelyClosed) was a Foursquare **v3** feature.
v3 (`api.foursquare.com/v3/*`) is retired and returns HTTP 410 â€” see
ADR 0002. The post-2025 surface we use (`places-api.foursquare.com`,
version pin `2025-06-17`) does not expose it.

The open/closed/unsure *distribution* question therefore has no answer:
that axis does not exist on this API version.

## What was probed

Live calls against `places-api.foursquare.com`, version header
`2025-06-17`, key from repo-root `.env` (`FOURSQUARE_API_KEY`).

- `fields=closed_bucket` â†’ HTTP 400, `Unexpected field(s): closed_bucket
  provided.` Same for `is_closed`, `closed`, `operational_status`,
  `status`, `permanently_closed`, `venue_reality_bucket`.
- The only closure-related field the surface accepts is **`date_closed`**
  â€” a single ISO date, not a bucket.
- Default `/places/search` result fields (no `fields` param): `categories,
  date_created, date_refreshed, distance, extended_location,
  fsq_place_id, latitude, link, location, longitude, name,
  placemaker_url, related_places, social_media, tel, website`. No
  closure field among them.

## `date_closed` is effectively never populated

Sampled **300 restaurants** â€” `fsq_category_ids` = food (50 results each)
across six dense coordinates: Nashville Ã—3, Times Square NYC, downtown LA,
downtown Chicago.

**0 / 300** had `date_closed` set to a non-null value.

## Pastime specifically

`fsq_place_id` `58c4591c2e9fde0ad1ee0ec2`. Foursquare believes it is a
live, operating venue:

- `date_closed`: null (absent).
- `date_refreshed`: `2025-08-19` â€” recently refreshed.
- `hours`: full seven-day `regular` schedule present; `open_now` false
  only because the probe ran outside posted hours.
- `rating`: 6.7 Â· `popularity`: 0.358 Â· `stats`: 26 ratings, 5 tips,
  7 photos.
- `tips`: five, newest dated `2018-08-04`. Oldest closure-adjacent
  signal available â€” but weak (see below).

`hours.open_now` is **not** a closure signal: a years-dead venue with
posted hours still reports `open_now` true/false purely on wall-clock.
The proxy already reads `hours.open_now`; it cannot catch this case.

## Weak proxy signals (none reliable)

No field on the response cleanly separates open from closed. Candidate
heuristics, all rejected as primary signals:

| Signal | Why it fails on Pastime |
|---|---|
| `date_refreshed` age | Pastime refreshed 2025-08-19 â€” looks fresh |
| Newest tip age | Pastime newest tip 2018-08 â€” *would* flag it, but many live venues also have no recent tips â†’ high false-positive rate |
| Low `stats` counts | Pastime has 26 ratings / 7 photos â€” low-ish but not zero; legit small venues look identical |
| `popularity` | Pastime 0.358 â€” mid-range, indistinguishable from a quiet open venue |

## Options for handling out-of-business venues

No decision made â€” product call. Recorded for the follow-up:

- **A â€” Accept the limitation.** No closure filter in 0.1.0; document as a
  known data-quality gap. Lowest effort; Pastime-class misses persist.
- **B â€” MapKit cross-check.** For each Foursquare candidate, look it up
  in MapKit (already the ADR 0002 fallback provider) and drop ones MapKit
  marks permanently closed. Apple's closed-business data is generally
  better. Cost: an extra lookup per candidate, added latency, name/geo
  matching logic.
- **C â€” Staleness heuristic.** Drop venues on a combination of stale
  signals (old newest-tip + low stats). Noisy; would mis-drop quiet but
  open venues. Not recommended as the only mechanism.
- **D â€” Google Places `business_status`.** Google exposes a reliable
  `OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY` enum. Adds a
  third vendor and conflicts with ADR 0002's Foursquare-primary /
  MapKit-fallback decision â€” would need an ADR amendment.

## Resolution â€” 2026-05-18: Option B wired (MapKit cross-check)

Decision: **Option B.** Implemented on the iOS client.

### Where it runs

The PlacesProxy is a server-side Deno Edge Function; MapKit is an
on-device Apple framework. The cross-check therefore lives **on the iOS
client**, in `PlacesService.fetchPlaces`, on the Foursquare
(`!isThin`) path only. MapKit-fallback results need no check â€” MapKit
returns live POIs by construction.

### How it works

`VenueClosureVerifier` (new, `ios/Sources/App/VenueClosureVerifier.swift`):

- For each Foursquare candidate, a MapKit `MKLocalPointsOfInterestRequest`
  sweeps a ~150 m radius around the venue's coordinate.
- If MapKit returns a healthy set of POIs for that block (>= 3) but
  none whose normalised name matches the candidate within ~120 m, the
  venue is judged **closed** and dropped.
- A failed sweep, a block below the POI-count floor, or a name match
  classify as **unknown** â€” and unknown always keeps the venue.
- Verdicts are memoised per `fsqPlaceId` so the N+1 per-member fetch
  fan-out sweeps each venue once.

### Known limitation â€” it is a heuristic, not an oracle

The MapKit SDK exposes **no programmatic "permanently closed" flag**
(Apple Maps the app shows it; the SDK does not). The signal is venue
*absence* from a MapKit sweep, which is necessarily probabilistic:

- A real open venue MapKit happens not to cover can be false-dropped.
  Conservatism (POI-count floor, keep-on-unknown) bounds this but does
  not eliminate it.
- Real-world hit rate is unverified â€” it needs a TestFlight check on a
  device. CI cannot exercise live MapKit.

### Flagged adjacencies (not built â€” product call)

- **Post-filter thinness.** A Foursquare batch that drops below the
  thin threshold *after* the cross-check is still returned as
  `.foursquare`; it does not re-trigger the MapKit fallback. The N+1
  union usually absorbs this. Revisit if pools come back thin.
- **ADR.** No new ADR was opened â€” the cross-check reuses the MapKit
  surface ADR 0002 already sanctions. Promote to an ADR amendment if
  the closure heuristic graduates from beta.

## Reproduce

```sh
set -a; source /workspace/.env; set +a
curl -s "https://places-api.foursquare.com/places/58c4591c2e9fde0ad1ee0ec2?fields=fsq_place_id,name,date_closed,date_refreshed,hours,rating,stats,tips" \
  -H "Authorization: Bearer $FOURSQUARE_API_KEY" \
  -H "X-Places-Api-Version: 2025-06-17" -H "Accept: application/json"
```

## Related

- [[adr/0002-places-data-foursquare-mapkit|ADR 0002]] â€” Foursquare primary
  / MapKit fallback; records the v3 â†’ places-api 410 migration.
- [[research/foursquare-filter-surface-2026-05/_index|foursquare-filter-surface-2026-05/]]
  â€” the 0.1.0 filter-surface spike; same API surface, did not cover
  closure.
