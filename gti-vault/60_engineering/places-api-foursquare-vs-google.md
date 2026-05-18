---
folder: 60_engineering
purpose: Comparison of Foursquare Places API (current provider) vs Google Places API (New)
created: 2026-05-18
---

# Places API Comparison — Foursquare vs Google

Decision-support note. GetToIt currently uses the **Foursquare Places API** through the
`places-proxy` Edge Function (see [[stack-patterns]], [[foursquare-venue-closure-signal]]).
This compares it against the **Google Places API (New)** on capability, data, pricing, and
terms — so a future provider decision is informed rather than re-researched.

> Sourced from official 2026 docs. Pricing and free-tier numbers move often — re-verify
> against the live pricing pages and provider consoles before committing budget.

## 1. Versioning context (both providers rebuilt their API)

- **Foursquare** — new Places API on `places-api.foursquare.com`, dated header
  `X-Places-Api-Version` (currently `2025-06-17`), built on the FSQ OS Places dataset.
  The **legacy V3 Places API retired 2026-05-15** (three days before this note). Any
  integration must already be on the new API.
- **Google** — "Places API (New)" is the only version enable-able on new projects;
  legacy is frozen. New API uses POST + JSON, distinct paths, and a **mandatory field
  mask** that also drives billing.

> **Action item for this repo:** confirm `places-proxy` targets the new Foursquare API
> and the new **integer** category IDs. Commit #101 ("use live Foursquare hex category
> ids") suggests V3-style 24-char hex IDs may still be in use — the new API uses short
> integer IDs and the two taxonomies are not interchangeable. Verify before the V3
> shutdown bites. File a bug if hex IDs are still wired.

## 2. Capability comparison

| Capability | Foursquare | Google (New) |
|---|---|---|
| Text/keyword search | Place Search (name, category, taste, chain, tel) | Text Search (`places:searchText`) |
| Area/nearby search | Place Search with `ll`+`radius` or bounding box | Nearby Search (`places:searchNearby`, circle only) |
| Details by ID | Place Details | Place Details (`GET places/{id}`) |
| Photos | Place Photos endpoint | Place Photos media endpoint |
| Reviews | Place Tips (short blurbs) | `reviews` field (full user reviews) |
| Autocomplete | Autocomplete (place/address/geo/search results) | Autocomplete with session tokens |
| Geocoding | Address Search/Details | Separate Geocoding API |
| Bulk / DB match | Place Match, Batch Place Match, offline jobs | Places Aggregate API (counts only) |
| Bulk dataset download | **Yes** — FSQ OS Places, Apache 2.0, free | **No** — prohibited by ToS |
| Sort options | relevance / rating / distance / popularity | distance / popularity (rank preference) |

## 3. Data fields

Both expose roughly the same dimensions. Field availability is tier-gated on both sides.

- **Foursquare** — Pro tier (~31 fields): identity, address, geocodes, categories,
  chains, contact (tel/website/email), social handles, `date_closed`, `date_refreshed`.
  Premium tier (~17 more): `hours`, `hours_popular`, `rating`, `price` (1–4),
  `popularity`, `description`, `tastes`, photos, tips, `veracity_rating`, and boolean
  amenities (`wifi`, `outdoorseating`, `delivery`, `reservations`, `hasparking`,
  `restroom`, `atm`, `takescreditcards`).
- **Google** — fields grouped Essentials → Pro → Enterprise → Enterprise+Atmosphere.
  Essentials/Pro: ids, address, location, `types`, `businessStatus`, `displayName`,
  `accessibilityOptions`, `googleMapsUri`. Enterprise: `openingHours`, phone numbers,
  `priceLevel`/`priceRange`, `rating`, `userRatingCount`, `websiteUri`.
  Enterprise+Atmosphere: rich dining booleans (`servesBeer`, `servesBrunch`,
  `outdoorSeating`, `reservable`, `goodForGroups`, `goodForChildren`, `allowsDogs`,
  `restroom`, `delivery`, `takeout`…), `parkingOptions`, `paymentOptions`, EV/fuel,
  `reviews`, `editorialSummary`, and AI summaries (`generativeSummary`, `reviewSummary`).

Notable differences:
- **Reviews** — Foursquare tips are short user blurbs; Google reviews are full,
  longer-form, plus an editorial blurb and (region-gated) AI summaries.
- **Ratings volume** — Google exposes `userRatingCount`; Foursquare's `rating` /
  `popularity` derive from check-in data, not a public star-count.
- **Group/suitability signals** — Google has explicit `goodForGroups`,
  `goodForChildren`, `goodForWatchingSports`. Foursquare has no direct equivalent.
- **Closure** — Foursquare `date_closed` is effectively never populated on the new
  surface (0/300 sampled — see [[foursquare-venue-closure-signal]]). Google
  `businessStatus` reliably reports `CLOSED_TEMPORARILY` / `CLOSED_PERMANENTLY`.
  This is a real, already-felt gap; the repo papers over it with an on-device MapKit
  cross-check (`VenueClosureVerifier`).

## 4. Category taxonomy

- **Foursquare** — proprietary hierarchical taxonomy, 1,000+ leaf categories
  (marketing says 1,500+). New API uses short integer IDs; legacy V3 used 24-char hex.
- **Google** — 500+ place types. **Table A** types are filterable in requests;
  **Table B** types are return-only (cannot filter). Cuisine-level filtering is
  partial.

Foursquare's taxonomy is finer-grained and fully filterable — relevant to the v1.1
quiz, where each answer compiles to a recipe of category/taste filters
([[../10_prds/v1.1-quiz-redesign-prd|v1.1 quiz redesign]]). Google's filter set is
coarser and split A/B.

## 5. Pricing (2026)

Both bill per 1,000 calls (CPM), tiered by monthly volume.

**Foursquare** — $200/month free credit on direct Developer accounts (not on AWS
Marketplace). Pro endpoints: first 10,000 calls/mo free, then $15 CPM (10k–100k),
sliding down to $1.25 CPM at 5M+. Premium endpoints (any rich field — hours, rating,
photos, tips, amenities): **no free tier**, $18.75 CPM (0–100k) down to $1.75 CPM at
5M+. One call = one call regardless of field count.

> **Foursquare pricing change flagged:** the official "Upcoming Changes" doc says that
> from **2026-06-01 the Pro free tier drops from 10,000 to 500 free calls/month**. The
> live pricing page still shows 10,000. Re-verify in the Developer Console — this
> directly affects GetToIt's run-rate headroom.

**Google** — flat $200/month credit **removed March 2025**. Replaced by per-SKU free
caps: Essentials 10,000/mo, Pro 5,000/mo, Enterprise 1,000/mo — each SKU separately.
Base CPM (low volume): Text/Nearby Search $32 (Pro) / $35 (Enterprise) / $40
(Enterprise+Atmosphere); Place Details $5 (Essentials) / $17 (Pro) / $20 (Enterprise)
/ $25 (+Atmosphere); Place Photos $7; Autocomplete $2.83/request. **Field-mask
billing:** you are charged at the highest tier any requested field touches — request
`rating` and you pay Enterprise; request `servesBeer` and you pay Enterprise+Atmosphere.

**Rough read for GetToIt's pattern** (per-member venue fetch + rich attributes for the
verdict engine): GetToIt needs hours, price, popularity, and amenity attributes — i.e.
Foursquare **Premium** and Google **Enterprise+Atmosphere** on essentially every call.
At that tier Foursquare is materially cheaper per call ($18.75 vs $32–40 CPM at low
volume) **and** still has a $200 credit. Google's per-SKU free caps are small for a
single high-volume SKU. For this workload Foursquare wins on cost; the gap narrows only
at very high volume.

## 6. Terms of use — the decisive difference

- **Caching / storage:**
  - **Foursquare** — may cache Places data as long as caches refresh at least every
    **30 days**. Workable for a venue cache.
  - **Google** — only `place_id` may be stored indefinitely. **All other content
    (names, addresses, ratings, reviews, photos, hours, amenities) may not be
    pre-fetched, indexed, or warehoused.** Lat/long may be cached up to 30 days;
    reviews/photos are stricter. You cannot build a local POI database.
- **Attribution:**
  - Foursquare — "Powered by Foursquare" branded credit wherever data is shown;
    must prevent crawling of pages showing the data.
  - Google — data on a map must be on a **Google map** with Google attribution;
    data shown without a map still requires visible **Google Maps** branding; photos
    and reviews carry mandatory author credit; AI summaries need disclosure UI.
- **Redistribution** — both forbid bulk redistribution. Foursquare additionally
  offers FSQ OS Places as a free Apache-2.0 bulk dataset (separate from the API).

For GetToIt this is the key constraint. The `places-proxy` already caches Foursquare
results ([[stack-patterns]]); that pattern is **compliant with Foursquare** and would
**violate Google's terms**. Moving to Google would force re-fetching venue content
live per request — higher latency, higher cost, a hard runtime dependency on Google —
and would constrain UI design (Google branding obligations).

## 7. Best-suited-for

- **Foursquare** — POI discovery and recommendation: rich category/taste/attribute/
  popularity signals from check-in history, fine-grained filterable taxonomy, a free
  bulk dataset, cache-friendly terms, lower cost at the rich-data tier. Weaker on:
  regional coverage outside high-Foursquare-usage markets, review depth (short tips),
  reliable closure status, photo quality for low-traffic venues.
- **Google** — broadest global coverage, the deepest structured atmosphere data,
  reliable `businessStatus`, full reviews, strong autocomplete. Weaker on: cost at the
  search/atmosphere tier, and — decisively — ToS that forbid building your own venue
  store and impose Google-branding/display obligations.

## 8. Recommendation for GetToIt

**Stay on Foursquare.** It is the better fit for this product:

1. The recommendation quiz depends on fine-grained, filterable category/taste recipes —
   Foursquare's taxonomy serves that directly; Google's A/B split does not.
2. The architecture caches venue results in `places-proxy`. That is allowed under
   Foursquare's 30-day rule and **prohibited** by Google's storage terms — switching
   would force a costly live-fetch redesign.
3. At the rich-data tier GetToIt needs, Foursquare is cheaper and retains a $200 credit.

**Open risks to track:**
- Foursquare's possible **2026-06-01 free-tier cut** (10,000 → 500 Pro calls/mo).
  Confirm in the console; revisit run-rate if it lands.
- The new-API **integer category IDs** — verify `places-proxy` is migrated off V3 hex
  IDs (see §1 action item).
- The **closure-signal gap** is a genuine Foursquare weakness, already mitigated by the
  MapKit cross-check. Google's `businessStatus` would solve it natively — worth noting
  if a narrow "is this venue still open" lookup is ever needed, Google could serve as a
  targeted secondary source for that one field without a full migration.

A common production pattern: keep Foursquare as the primary discovery/metadata source,
optionally layer a second provider for the one or two fields it is weak on (closure,
coverage). A full switch to Google is not warranted.

## See also

- [[foursquare-venue-closure-signal]] — the closure-signal investigation and MapKit fix
- [[stack-patterns]] — places-proxy caching pattern
- [[verdict-engine]] — consumer of venue attributes
- [[../15_issues/v1.1/issues/research-01-foursquare-filter-surface|research-01]] — Foursquare filter-surface spike
