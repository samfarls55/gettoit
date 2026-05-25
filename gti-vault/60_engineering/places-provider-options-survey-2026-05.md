---
folder: 60_engineering
purpose: Full survey of venue/place data providers as candidate replacements for Foursquare
created: 2026-05-19
adr: 0002
relates:
  - 60_engineering/places-api-foursquare-vs-google
  - 60_engineering/foursquare-venue-closure-signal
---

# Places Provider Options — Full Survey (2026-05)

Decision-support survey. Triggered by a product call to **drop Foursquare as the primary
data provider** — confidence in data freshness is gone (the founder used the Foursquare
consumer app and saw restaurants closed for years still mapped). This widens the earlier
two-way comparison ([[places-api-foursquare-vs-google]]) into a full market scan:
every realistic provider, with capability and pricing.

> Pricing and free-tier numbers move constantly. Treat every dollar figure as
> "verify in the live console before committing budget." All figures gathered
> 2026-05-19 from official 2025/2026 docs.

## TL;DR

1. **The staleness complaint is real and already documented.** See
   [[foursquare-venue-closure-signal]] — Foursquare's post-2025 API has no closure
   bucket, `date_closed` was null on 0/300 sampled restaurants, and a venue dead since
   ~2018 (Pastime) still returns as live with a full hours schedule.

2. **Three "alternatives" are not alternatives — they are Foursquare in a trenchcoat.**
   - **Mapbox** Search Box POI data: Foursquare is the *primary* POI provider for the
     entire Mapbox suite (partnership re-announced Sept 2024).
   - **Overture Maps** Places: Foursquare is one of its 8 source feeds.
   - **FSQ OS Places** (the open dataset): literally Foursquare's own place graph.
   Switching to any of these does not escape the freshness problem — it re-buys it,
   usually with *fewer* fields exposed.

3. **Ratings/reputation is a walled asset.** Of every provider surveyed, only **Google**
   and **Yelp** expose real restaurant ratings + review counts on a self-serve API.
   Foursquare's *paid premium* tier also has them. Every open/aggregator/map-data
   source (OSM, Geoapify, Radar, Overture, FSQ OS, HERE, TomTom Search, Mapbox,
   Apple's developer APIs) has **no ratings at all**. The quiz's Q3 (reputation) and
   Q5 (candidate rater) depend on this — see "Impact on the quiz" below.

4. **Only Google has a reliable, owner-incentivised freshness signal.** Google
   `businessStatus` returns `OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY`,
   and Google Business Profile gives owners a direct incentive to keep listings
   current. This is the single best answer to the exact problem that started this
   survey. The cost: Google's ToS forbids the `places-proxy` cache pattern.

5. **Honest shortlist:** **Google Places API (New)** is the freshness winner and the
   only true upgrade on the founder's complaint. **Yelp** is the strongest pure-dining
   reputation source but carries a commercial-use-consent clause and a 24h cache cap.
   Everything else is either a Foursquare re-skin, ratings-blind, or both.

---

## Decision (2026-05-19)

**Outcome: stay on Foursquare for now. ADR 0002 holds; no migration.**

The founder reviewed this survey and chose to keep Foursquare as the primary provider
for now, accepting its known weaknesses:

- The staleness is real and acknowledged — the Foursquare consumer app has been
  largely unmaintained since ~2019; reviews and closure data are stale.
- But Foursquare still provides a **decent baseline** — usable category, taste,
  price, and hours data for the 0.1.0 quiz recipes.
- It is the **cheapest of the providers that actually feed this quiz**: Google is
  pricier per call and forces the `places-proxy` caching rework; Yelp is a $299+/mo
  fixed subscription that only amortizes at call volume GetToIt does not have yet.
- The stale-venue problem is already partially mitigated by the on-device
  `VenueClosureVerifier` MapKit cross-check ([[foursquare-venue-closure-signal]]).

This is an explicit "for now". The analysis below — which recommends Google — is
retained as the record of what a migration would buy and cost, for whenever the
decision is revisited. Likely revisit triggers: post-launch call volume crossing the
Yelp break-even (~8,000–16,000 calls/month), or stale data becoming a repeated real
user complaint rather than a founder-noticed one.

---

## Why "just use a different map provider" does not work

The founder's instinct — Foursquare data is stale — is correct. But the POI-data
market is more consolidated than it looks. A handful of companies actually *collect*
venue data; most "providers" license and re-package it.

| If you pick... | You are actually getting... |
|---|---|
| Mapbox Search Box | Foursquare POI data (primary provider, conflated with open data) |
| Overture Maps Places | A blend that includes Foursquare + Meta + Microsoft + 5 others |
| FSQ OS Places | Foursquare's place graph, as a free open dump |
| Apple Maps (consumer ratings) | Yelp-sourced ratings (not exposed to developers) |
| TomTom POI Details (ratings) | Tripadvisor-sourced ratings |

The genuinely independent first-party datasets for US dining are: **Google**
(Business Profile + crowdsourced + authoritative feeds), **Yelp** (its own review
platform), **Tripadvisor** (its own review platform), and **Foursquare** (check-in
graph). Map-data houses (HERE, TomTom, Mapbox, OSM-derived) are navigation-first and
carry no reputation layer.

So the real choice is narrow: **Google vs Yelp vs Tripadvisor**, with the map-data
and open-dataset providers relevant only as a cheap *base catalog* if reputation is
dropped from the product.

---

## Tier 1 — Providers with real restaurant ratings (self-serve)

### Google Places API (New)

- **Search:** Text Search, Nearby Search, Place Details, Autocomplete.
- **Filters (server-side):** `includedType` (cuisine-level types — `italian_restaurant`,
  `sushi_restaurant`, etc.), `priceLevels`, `minRating`, `openNow`, `rankPreference`,
  geo bias/restriction.
- **Fields:** ratings, `userRatingCount`, full review text, price level, hours,
  `businessStatus` (closure enum), photos, and a deep amenity set (`outdoorSeating`,
  `reservable`, `servesBreakfast/Dinner/...`, `goodForGroups`, `goodForChildren`,
  accessibility, parking, payment).
- **Freshness:** Best in class. Sourced from authoritative feeds + Google Business
  Profile (owners self-update hours/closure) + crowdsourced edits + imagery. Explicit
  `businessStatus` closure field. This directly fixes the Pastime-class miss.
- **Pricing (since 2025-03-01, the $200 flat credit was removed):** per-SKU monthly
  free caps — Essentials 10k, Pro 5k, Enterprise 1k. Per 1,000 calls at low volume:
  Text Search Pro $32, Enterprise $35, **Enterprise+Atmosphere $40**; Place Details
  Pro $17 / Enterprise $20 / **+Atmosphere $25**. **Billed at the highest SKU any
  requested field touches** — one amenity field pushes the whole call to +Atmosphere.
- **ToS — the dealbreaker:** Only `place_id` may be stored indefinitely. Names,
  ratings, reviews, hours, amenities **may not be cached or warehoused**. The current
  `places-proxy` venue cache (24h/7d TTL, ADR 0002) is **non-compliant with Google**
  and would have to be torn out — re-fetch live per request, higher latency and cost,
  hard runtime dependency on Google. Plus "Powered by Google" attribution + review
  author attribution obligations.
- **iOS:** Mature Places SDK for iOS + a newer Swift-first Places Swift SDK
  (async/await), SPM install. Or call the REST API directly.

#### Google restaurant attribute depth (verified 2026-05-19)

What Google gives you to characterise a restaurant *beyond category*:

- **Structured amenity/atmosphere booleans (Enterprise + Atmosphere tier).** The
  dependable, queryable "feel" backbone:
  - Service: `dineIn`, `takeout`, `delivery`, `curbsidePickup`, `reservable`,
    `outdoorSeating`, `liveMusic`, `menuForChildren`, `restroom`.
  - Meal/beverage: `servesBreakfast/Lunch/Dinner/Brunch/Coffee`,
    `servesBeer/Wine/Cocktails/Dessert/VegetarianFood`.
  - Crowd/suitability: `goodForChildren`, `goodForGroups`, `goodForWatchingSports`,
    `allowsDogs`.
  - Structured objects: `accessibilityOptions`, `parkingOptions`, `paymentOptions`.
  - Fields are omitted when Google lacks the data — coverage is sparse for low-traffic
    venues. Not region-gated.
- **Rating + price (Enterprise tier):** `rating`, `userRatingCount`, `priceLevel`,
  `priceRange`.

**Review keyword extraction — NO structured field.** The Maps consumer app's
"People often mention [cozy] [great pasta]" keyword chips are **not exposed** as
structured/queryable data. There is no `reviewHighlights` / `reviewTags` / `topics`
field. What exists instead:

- **`contextualContents.justifications`** (Text Search only, **experimental**) — for a
  query like "firewood pizza" it returns the matching review *snippet* with the
  matching span index-marked (`reviewJustification.highlightedText`), plus a
  `businessAvailabilityAttributes` justification (takeout/delivery/dineIn booleans).
  This is the closest thing to keyword chips, but it is snippet+span, query-scoped,
  Text-Search-only, and experimental — not safe as a core dependency.
- **`reviewSummary`** — AI/Gemini prose synthesising reviews. **Region-gated** (~18
  English-language countries incl. US/UK/India/Mexico; EEA excluded; "not guaranteed
  for all places"). Prose, not tags.
- **`generativeSummary`** — AI ~100-char place overview. **More restricted: English,
  India + US only.**
- **`editorialSummary`** — short Google-written (non-AI) blurb; sometimes carries a
  vibe word ("cozy", "upscale"); inconsistently present.

**Vibe / ambience — NO structured descriptor.** Google does not expose a
casual/upscale/romantic enum, a noise-level field, a decor field, or a crowd-type
field. To get a structured "feel" you either (a) infer it from the boolean set, or
(b) run your own keyword/sentiment extraction over `reviews` text or `reviewSummary`
prose. The AI summaries are the richest ready-made feel signal but are prose,
region-gated, and carry a "Summarized with Gemini" disclosure + report-link display
obligation.

**Cost note:** every atmosphere boolean, `reviews`, and the AI summaries all sit in
the **Enterprise + Atmosphere** SKU — ~$25/1k on Place Details, ~$40/1k on Text/Nearby
Search. AI summaries are GA (no allowlist), gated only by geography. AI summary fields
have no caching exception — re-fetch, don't warehouse.

### Yelp Fusion API (rebranded "Yelp Places API")

- **Search:** `/businesses/search` (up to 240 results), Transaction Search,
  Business Details, plus a plan-gated Review Highlights endpoint.
- **Filters (server-side):** `categories` (cuisine taxonomy), `price` (1-4),
  `open_now` / `open_at`, `attributes` (reservations, outdoor seating, delivery,
  ambience, noise — count of available attributes is plan-tiered: 15/23/66),
  `sort_by` (rating, review_count, distance).
- **Fields:** `rating`, `review_count`, `price`, `categories`, `is_closed`,
  `transactions` (delivery/pickup/reservation), `hours` + `is_open_now`, photos,
  review excerpts (plan-gated: 0/3/7).
- **Freshness:** Strong for US dining — Yelp's core business is its own review
  platform; `is_closed` kept current by community + moderation. No published refresh
  SLA. Materially better closure exposure than Foursquare.
- **Pricing:** No permanent free tier (5,000 calls in a 30-day trial only).
  Monthly base + overage: **Base $229/mo** + $5.91/1k, **Enhanced $299/mo** + $6.57/1k,
  **Premium $643/mo** + $14.13/1k. Enterprise (>150k/mo) is sales-quoted.
- **ToS — two flags:**
  1. **Caching limited to 24 hours** (Yelp Business IDs storable indefinitely).
     The `places-proxy` 7-day cold TTL would have to drop to <=24h.
  2. **Commercial use requires Yelp's express written consent.** GetToIt is a
     commercial app — this needs legal sign-off / written confirmation that buying a
     paid plan grants that consent. **Launch blocker if unaddressed.**
  Also: branded Yelp stars only, mandatory link-back, and Yelp ratings **may not be
  displayed alongside any other UGC rating** (no blending with another provider).
- **iOS:** REST/JSON only, no official Swift SDK. `URLSession` + Bearer key.

### Tripadvisor Content API

- **Search:** Location Search, Nearby Location Search, Location Details, Photos,
  Reviews. **Returns only up to 10 locations per query; up to 5 reviews/photos each.**
- **Filters:** Weak — only a coarse `category` ("restaurants"). **No price, cuisine,
  open-now, or amenity filters server-side.** You would over-fetch and filter
  client-side, which does not fit the "recipe of filters" model.
- **Fields:** `rating`, `num_reviews`, `price_level` (sparse), `cuisine`, `hours`
  (often null), `ranking_data`, `awards`. No clear closed-status field.
- **Freshness:** Travel/tourism-weighted; weaker for everyday neighbourhood dining.
  No published closure-accuracy guarantee.
- **Pricing:** 5,000 free calls/month ongoing (credit card required). Pay-as-you-go
  beyond that — **no public per-call rates**; sales-quoted; >500k/mo needs sales.
- **ToS:** Caching forbidden for everything except Location IDs — all content
  fetched live every call. B2C consumer apps allowed (GetToIt qualifies). Mandatory
  Tripadvisor logo + "Ollie" owl, bubble images served from Tripadvisor URLs.
- **Access:** Gated — application + approval, requires a live B2C travel URL,
  provisional key expires in 6 months.
- **Verdict:** Weakest filtering of the three. Not a fit for the quiz recipe model.

---

## Tier 2 — Map-data providers (no ratings, navigation-first)

These return strong category/geo search but **no ratings, no reviews, no reputation**.
Usable only as a *base catalog* if reputation is dropped from the product, or paired
with a separate ratings source.

### Apple MapKit / Apple Maps Server API

- **Capability:** Coarse category + geo search only. `MKMapItem` / Maps Server API
  `/search` return name, address, coordinate, POI category, phone, website. Category
  filter exists but is coarse — `.restaurant`, `.cafe`, `.bakery`, `.brewery`,
  `.nightlife` — one bucket for all restaurants, no cuisine granularity. **No ratings,
  reviews, price, amenities, readable hours, open-now filter, or closure field** via
  any developer API. Apple Maps the *app* shows Yelp-sourced ratings and (iOS 26
  place cards) hours — but rendered by Apple's UI, not exposed as developer-readable
  structured fields. Apple Maps is a review *aggregator*: it surfaces Yelp (main),
  TripAdvisor, MICHELIN/expert guides (added May 2025), plus Apple's own
  thumbs-up/down score. That content is licensed *to Apple for display in Apple Maps
  only* — Apple has no right to sublicense it, so it reaches developers through no
  Apple channel at all. Wanting "the data in Apple Maps" therefore means licensing
  the source (Yelp) directly — there is no cheaper Apple back door to it.
- **Freshness:** Actually a strength. Apple's underlying POI/closure data is good
  enough that `VenueClosureVerifier` already trusts MapKit as the closure *oracle* to
  catch Foursquare's stale venues. The catch: there is no developer-readable closure
  *field* — the verifier infers closure from venue *absence* in a MapKit sweep.
- **Pricing:** Effectively free — 25,000 calls/day on the Maps Server API, and
  on-device `MKLocalSearch` is keyless and unmetered. Needs an Apple Developer
  membership ($99/yr).
- **ToS:** Map data may not be cached beyond "temporary and limited" performance use.
- **iOS:** Best-in-class — first-party framework, no key for on-device `MKLocalSearch`.
- **Role / why not primary:** MapKit is **not ruled out** — it is already in
  production in two roles (ADR 0002 fallback provider + the `VenueClosureVerifier`
  closure cross-check) and should keep both. What it cannot be is the *primary*
  provider, and the blocker is the **0.1.0 quiz design, not MapKit quality**: the quiz
  compiles each answer into a recipe of cuisine / price / attribute / reputation
  filters, and MapKit exposes neither those filters nor the data to filter
  client-side. A simpler "good restaurants near me, sorted, closed ones removed"
  product could run on MapKit alone, for free — so MapKit-vs-paid-provider is partly
  a **quiz-scope decision** (see open question 6).

### HERE (Geocoding & Search)

- **Capability:** `/discover` + `/browse`. Good category + a genuine `foodTypes`
  cuisine taxonomy. Returns hours (with `isOpen`), contacts, chains. **No price
  filter, no amenity filter, no photos, no ratings/reviews.** Open-now computed
  client-side.
- **Freshness:** ~120M POIs; navigation-first, POI attribute completeness weaker than
  place-focused providers. No closure metric.
- **Pricing:** Base free ~30k transactions/mo; overage ~$0.83/1k; Pro ~$449/mo
  (~1M included).
- **ToS:** Cannot cache to build a location repository. Attribution required.
- **iOS:** HERE SDK for iOS (Swift), or REST.

### TomTom (Search API)

- **Capability:** POI/Category/Nearby search. Category + brand filters, hours on
  request. **No price filter, no amenities, no ratings** in the Search API.
- **TomTom POI Details API** *does* return ratings/reviews/price — but it is
  **Tripadvisor-sourced, automotive-use-only, private-preview/contract-only**, and
  contractually barred from "Enterprise Customers." Not a realistic self-serve path.
- **Pricing:** Free 2,500 non-tile requests/day; overage ~$0.54-0.75/1k. POI Details
  has no public pricing.
- **ToS:** Caching ephemeral (only within cache-control max-age; no cross-user cache).
- **iOS:** TomTom SDKs for iOS (Swift), or REST.

### Mapbox (Search Box API)

- **CRITICAL:** Mapbox POI data **is Foursquare data** — Foursquare is the primary POI
  provider for the whole Mapbox suite (re-announced Sept 2024). Adopting Mapbox does
  **not** escape the staleness problem; it inherits it, and exposes *fewer* fields
  than Foursquare's own API (no ratings/photos/price passthrough; phone/website/hours
  metadata is "selected customers only", sales-gated).
- **Capability:** Category, brand, type filters. No price, no open-now filter,
  no amenities, no ratings.
- **Pricing (introductory, through Q4 2025):** session-based free 500/mo then $3/1k;
  request-based free 50k/mo then $1/1k. Permanent storage requires the pricier
  Permanent Geocoding tier.
- **ToS:** Default results ephemeral — must not persist; persistence needs Permanent
  tier.
- **iOS:** `mapbox-search-ios` — strong native Swift SDK with prebuilt search UI.
- **Verdict:** No reason to switch here — same data, worse fields.

---

## Tier 3 — Open / aggregator datasets (free, no ratings, self-host)

No ratings anywhere in this tier. These are *base catalogs* you host and query
yourself. Relevant only if reputation is dropped, or as the cheap bulk-filtering layer
under a thin paid ratings call.

### OpenStreetMap (Overpass / Nominatim)

- **Capability:** Strong category + `cuisine` tag filtering; `opening_hours`, diet
  tags (`diet:vegan` etc.), `wheelchair`, `outdoor_seating`, `takeaway`, `delivery` —
  but populated unevenly. **No price level, no ratings.**
- **Freshness:** Live crowdsourced DB. Closure accuracy weak — closed venues removed
  only when a mapper notices; restaurant turnover lags. Coverage varies wildly by city.
- **Pricing:** Free. Public endpoints are rate-limited (Nominatim 1 req/s, no bulk);
  production = self-host.
- **Licensing:** ODbL 1.0 share-alike. Using results in-app is a "Produced Work" —
  attribution only, no copyleft on the app. Redistributing an enhanced *database*
  triggers share-alike.
- **Effort:** High — self-host Overpass + regional extract.

### Geoapify Places API

- **Capability:** 800+ categories incl. cuisine subtypes; "conditions" filters
  (vegan, vegetarian, wheelchair, internet_access, hours). Place Details API for
  structured hours. **No price level, no ratings.** OSM-derived — inherits OSM
  freshness/closure weaknesses.
- **Pricing:** Free 3,000 credits/day. Paid: $59/mo (10k/day) ... $299/mo (100k/day) ...
  $609/mo (250k/day).
- **Licensing:** OSM/ODbL attribution + Geoapify attribution on free tier.
- **iOS:** Clean live REST API, zero hosting burden. Best "OSM-with-a-nice-API" path.

### Radar (Places API)

- **Capability:** Hundreds of categories + strong chain filtering. Limited attributes
  (no cuisine subtypes, diet tags, price, or amenity filters exposed). **No ratings.**
- **Freshness:** Curated POI set, strongest for chains; weak on long-tail independents.
- **Pricing:** Free 100k requests/mo; paid is sales-quoted.
- **iOS:** First-class iOS SDK (geofencing heritage).
- **Verdict:** Easiest iOS integration, weakest *content* fit for restaurant
  discovery. It is a geofencing platform, not a dining catalog.

### Overture Maps Foundation — Places dataset

- **Capability:** ~64M places; good category taxonomy (Dec 2025 added a proper
  cuisine hierarchy). Fields: names, addresses, websites, socials, brand, `confidence`,
  `operating_status`. **No hours, no price, no amenities, no ratings.**
- **Freshness:** Monthly static dump. `operating_status` exists but currently a
  placeholder (all "open") — does **not** yet solve closure detection.
- **Pricing:** Free/open. Permissive licensing (CDLA-Permissive 2.0 / Apache 2.0 /
  CC0 by source). No share-alike.
- **Effort:** High — host GeoParquet, query via PostGIS/DuckDB, expose your own API.

### FSQ OS Places (Foursquare Open Source Places)

- **What it is:** Foursquare's own place graph, released free as an open dataset.
  100M+ POIs, monthly updates, Apache 2.0.
- **Capability:** 1,000+ category taxonomy. ~22 fields incl. `date_closed` and
  `date_refreshed`. **No hours, no price, no ratings, no amenities** (Foursquare kept
  those for the paid API).
- **Freshness note:** Same underlying graph as the stale live API — but the open
  dataset *does* expose `date_closed` + `date_refreshed`, so you could filter closed
  venues yourself, arguably better than the live API behaviour. Still the same source.
- **Pricing:** Free/open (Hugging Face, Snowflake Marketplace, FSQ Places Portal).
- **Effort:** High — host and query the monthly dump yourself.

---

## Reference baseline — Foursquare Places API (current provider)

For completeness, what is being replaced. Pro tier ~31 fields; Premium tier adds
hours, `rating`, `price`, `popularity`, `tastes`, photos, tips, amenity booleans.
Fine-grained 1,000+ filterable taxonomy. **30-day caching allowed** (the
`places-proxy` cache is compliant). Pricing: list price Pro $15/1k, Premium $18.75/1k.
The rich fields the 0.1.0 quiz needs (hours, rating, price, tastes, photos) are all
**Premium** tier, which has no free allowance. **The widely-cited $200/mo developer
credit does not apply to GetToIt's account** — the project runs straight
pay-as-you-go off a prepaid balance (founder confirmed 2026-05-19, started with a $20
top-up). So the current real cost is per-call from day one, not free. **Flagged
risk:** an "Upcoming Changes" notice says the Pro free tier may drop 10,000 -> 500
calls/mo on 2026-06-01. Closure signal effectively absent — the reason for this survey.

---

## Comparison matrix

| Provider | Ratings | Cuisine filter | Price filter | Open-now | Closure signal | Cache allowed | Low-volume cost | iOS SDK |
|---|---|---|---|---|---|---|---|---|
| **Google Places (New)** | Yes (+reviews) | Yes (fine) | Yes | Yes | **Yes — businessStatus** | place_id only | $32-40/1k search | Yes (Swift) |
| **Yelp Fusion** | Yes (+excerpts) | Yes | Yes | Yes | Yes (`is_closed`) | 24h only | $229+/mo +$5.91/1k | No (REST) |
| **Tripadvisor** | Yes | No | No | No | Weak | IDs only | 5k free, then quoted | No (REST) |
| Foursquare (current) | Premium tier | Yes (finest) | Yes | Yes | **No (broken)** | 30 days | $18.75/1k premium | No (REST) |
| Apple MapKit | No | No | No | No | No (dev API) | temp only | Free (25k/day) | Native |
| HERE | No | Yes (foodTypes) | No | Client-side | No | No repository | ~$0.83/1k | Yes |
| TomTom Search | No | Category-only | No | Client-side | No | Ephemeral | ~$0.54-0.75/1k | Yes |
| Mapbox (= Foursquare) | No | Category-only | No | No | No | Permanent tier | $1-3/1k | Yes (Swift) |
| OSM / Overpass | No | Yes (`cuisine`) | No | Client-side | Weak | Yes (self-host) | Free | Self-build |
| Geoapify | No | Yes | No | Client-side | Weak (OSM) | Check terms | Free / $59+/mo | REST |
| Radar | No | Category + chain | No | Limited | Not exposed | Check terms | Free 100k/mo | Yes |
| Overture Places | No | Yes (taxonomy) | No | No (no hours) | Placeholder only | Yes (open) | Free | Self-build |
| FSQ OS Places | No | Yes (finest) | No | No (no hours) | `date_closed` field | Yes (open) | Free | Self-build |

---

## Impact on the quiz design

The 0.1.0 quiz compiles each answer into a recipe of filters
([[../50_product/0.1.0-quiz-amendments]], [[places-api-foursquare-vs-google]] §4).
A provider switch is not field-neutral:

- **Foursquare's 1,000+ fully-filterable taxonomy is the finest of any provider.**
  Google's types split into Table A (filterable) / Table B (return-only) and are
  coarser; Yelp's is mid. Some scenario-composite recipes may need re-authoring.
- **Q3 (reputation/discovery) and Q5 (candidate rater) need ratings.** Only Google,
  Yelp, and Foursquare-premium supply them. A move to any Tier 2/3 provider forces
  either dropping reputation from the quiz or bolting on a paid ratings call.
- **Price filtering** (Q2 cap) exists only on Google, Yelp, Tripadvisor, and
  Foursquare. No Tier 2/3 provider has it.

---

## Deriving vibe attributes (Q4 nudge)

The 0.1.0 Q4 vibe axis runs a category-archetype baseline plus a bounded +/-1 nudge.
That nudge is fed **entirely** by Foursquare's `tastes` field — the 30-token allowlist
from [[research/foursquare-tastes-vibe-2026-05/report|foursquare-tastes-vibe-2026-05]],
consumed by tb-18's `Q5VenueClassifier`. **Leaving Foursquare removes that input.**
No other provider has a `tastes`-equivalent free folksonomy field.

The downstream half of the pipeline (baseline + sign-of-sum nudge) is
provider-agnostic — only the *token producer* needs replacing. Options:

- **Path A — Google atmosphere booleans -> nudge.** Map `liveMusic`, `goodForGroups`,
  `goodForWatchingSports`, `servesCocktails` (loud-leaning) and `reservable`
  (quiet-leaning) onto the energy axis. Deterministic, CI-testable, no extra API
  cost (already on the Atmosphere tier). Weak: only `liveMusic` is a true
  crowd-perception vibe word; the rest are amenity facts. Coarser than `tastes`.
- **Path B — NLP over Google `reviews` text -> existing allowlist.** Google returns
  up to 5 full reviews. Run keyword extraction over that text, match the existing
  30-token allowlist, feed the same nudge. Reuses the whole tb-18 consumption
  contract; only the producer changes. Caveats: (1) Google ToS forbids warehousing
  review text — storing the *derived* +/-1 label is a legal grey area, needs review;
  (2) 5 reviews, Google-selected by relevance, is a thinner/more biased sample than
  Foursquare's ~26-token crowd cloud; (3) per-venue extraction adds cost + latency,
  multiplied by the N+1 per-member fan-out.
- **Path C — LLM infers energy directly** from review text. Handles cafes better
  (the current nudge is near-dead for cafes, 22.7% fire-rate). But non-deterministic
  — breaks the exact-replay tests the vibe research built.

**Yelp is the outlier: you read vibe, you do not derive it.** Yelp exposes a
structured `Ambience` object (divey, hipster, casual, touristy, trendy, intimate,
romantic, classy, upscale) and `NoiseLevel` (quiet / average / loud / very_loud).
`NoiseLevel` maps directly onto the Q4 Quiet->Rowdy axis with zero NLP. No other
surveyed provider has a first-class ambience field. Availability is plan-tiered
(attribute count 15/23/66) and coverage is not universal — verify the tier. This is
a material argument in Yelp's favour specifically for the Q4 feature.

**Net:** vibe is effectively *free* on Foursquare (`tastes`) and on Yelp
(`NoiseLevel`/`Ambience`). On Google it becomes a build (Path B), a per-venue cost,
and a ToS question. Factor this into the provider decision — it is not a footnote.

## Recommendation

> **Not adopted (2026-05-19).** The founder reviewed this and chose to stay on
> Foursquare for now — see "Decision" above. The recommendation below is retained as
> analysis of what a future migration would buy and cost, not as the adopted path.

**Primary recommendation: migrate to Google Places API (New).**

It is the only provider that *directly answers the founder's complaint* — a reliable,
owner-incentivised `businessStatus` closure enum plus the freshest large POI dataset
for US restaurants. It keeps ratings, reviews, price, hours, and a rich amenity set,
so the quiz's reputation and price questions survive.

The migration is not free. Two real costs, both must be planned, not discovered later:

1. **Architecture rework.** Google's ToS forbids the `places-proxy` venue cache.
   The proxy must shift to live per-request fetches (store `place_id` only). This
   raises latency and per-call cost and makes Google a hard runtime dependency. This
   is an ADR 0002 amendment / replacement, not a config change.
2. **Quiz recipe re-authoring.** Google's coarser Table A/B taxonomy means some
   scenario-composite filter recipes need revisiting.

**If the caching rework is judged too expensive,** the fallback is **Yelp Fusion** —
strong dining reputation data and real filters, at $229-643/mo. But Yelp also caps
caching at 24h and carries a commercial-use-consent clause that needs legal sign-off
*before* any build. Net architecture impact is similar to Google's; reputation depth
is comparable; global coverage and closure-signal quality are weaker than Google's.

**Do not switch to Mapbox, Overture, or FSQ OS Places expecting fresher data** — all
three are Foursquare-derived. They are only worth considering as a free base catalog
*if* the product drops ratings entirely, which contradicts the 0.1.0 quiz design.

**Hybrid worth weighing** (the [[places-api-foursquare-vs-google]] note already
raised this): keep Foursquare for discovery/taxonomy and add Google purely for the
`businessStatus` field on the final shortlist. Lower migration cost, but it keeps the
founder's distrust of Foursquare's underlying data unaddressed — and the founder's
stated position is to drop Foursquare as *primary*, not patch it.

---

## Open questions for the product call

1. **Is the staleness a data problem or a trust problem?** A full Google migration
   fixes the data. A hybrid (Foursquare + Google closure check) fixes the visible
   misses but keeps Foursquare underneath. Which does the founder want?
2. **Is the `places-proxy` caching rework an acceptable cost** to gain Google's
   freshness? This is the single biggest architectural consequence.
3. **Budget ceiling and cost shape.** Foursquare today is *already* a paid
   pay-as-you-go cost — ~$18.75/1k for the Premium fields the quiz needs, no credit
   applied. Google keeps that pay-per-call shape, pricier: ~$25-40/1k at the
   +Atmosphere tier with small free caps. Yelp is a different shape — $299-643/mo
   flat regardless of volume. Yelp only beats pay-as-you-go above a crossover of
   roughly 8,000-16,000 calls/month. What is the projected monthly call volume?
4. **Can reputation be dropped from the quiz?** If yes, the cheap Tier 3 options open
   up. If no (current 0.1.0 design), the choice is locked to Google or Yelp.
5. **How is the Q4 vibe nudge re-fed?** Foursquare `tastes` disappears with the
   migration. Google needs a derive-vibe build (Path B above); Yelp supplies
   `NoiseLevel`/`Ambience` directly. See "Deriving vibe attributes". This re-opens
   tb-18 / [[research/foursquare-tastes-vibe-2026-05/report|the tastes-vibe research]].
6. **Is the paid provider bought by the quiz?** The entire per-call / subscription
   cost exists to feed cuisine recipes, price caps, ratings, and vibe. A de-scoped
   quiz could run on free MapKit alone. Is the 0.1.0 quiz design firm enough that the
   provider spend is non-negotiable, or is "simpler quiz, free data" on the table?

## See also

- [[places-api-foursquare-vs-google]] — the earlier two-way comparison this supersedes
- [[foursquare-venue-closure-signal]] — the closure investigation + MapKit workaround
- [[adr/0002-places-data-foursquare-mapkit|ADR 0002]] — current Foursquare-primary decision (now under review)
- [[../50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]] — quiz recipe model affected by a provider switch
