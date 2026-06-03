---
folder: 60_engineering
purpose: Current Google Places API restaurant field surface for possible Foursquare migration
created: 2026-06-03
relates:
  - 60_engineering/places-api-foursquare-vs-google
  - 60_engineering/places-provider-options-survey-2026-05
---

# Google Places Restaurant Fields - 2026-06

Current official-doc summary for replacing Foursquare venue fields with Google Places
API (New). Sources checked 2026-06-03:

- https://developers.google.com/maps/documentation/places/web-service/data-fields
- https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- https://developers.google.com/maps/documentation/places/web-service/place-types
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/nearby-search

## Notes

- Places API (New) is field-mask driven. Requests must specify fields; no default field
  set is returned. For Text Search and Nearby Search, field paths are prefixed with
  `places.`.
- Billing follows the highest SKU tier touched by the requested field mask. Restaurant
  atmosphere fields such as `servesBeer`, `outdoorSeating`, `reviews`, and
  `parkingOptions` are Enterprise + Atmosphere.
- Fields may be absent or unset when Google lacks data for a given restaurant, region,
  or policy surface.
- Google exposes no first-class full menu item feed in the Places API. Available menu
  signal is limited to `menuForChildren`, meal/service booleans, cuisine/place types,
  and possible text in summaries/reviews.

## Restaurant Discovery And Classification

- Identity: `name` resource (`places/{placeId}`), `id`, `displayName`.
- Classification: `types`, `primaryType`, `primaryTypeDisplayName`,
  `googleMapsTypeLabel`.
- Food-place types include broad and cuisine-specific values: `restaurant`, `cafe`,
  `bar`, `meal_takeaway`, `meal_delivery`, `pizza_restaurant`, `sushi_restaurant`,
  `mexican_restaurant`, `vegan_restaurant`, `vegetarian_restaurant`, and many more.
  Table A types can filter Text Search / Nearby Search; Table B values such as `food`,
  `point_of_interest`, and `establishment` can appear in responses.
- Search-time refinements relevant to restaurants: type filters, `openNow`,
  `minRating`, `priceLevels`, rank preference, and geo bias/restriction.

## Core Place Data

- Location: `formattedAddress`, `shortFormattedAddress`, `postalAddress`,
  `addressComponents`, `adrFormatAddress`, `location`, `viewport`, `plusCode`,
  `addressDescriptor`.
- Contact/links: `nationalPhoneNumber`, `internationalPhoneNumber`, `websiteUri`,
  `googleMapsUri`, `googleMapsLinks`.
- Status/freshness: `businessStatus` (`OPERATIONAL`, `CLOSED_TEMPORARILY`,
  `CLOSED_PERMANENTLY`, `FUTURE_OPENING`), `openingDate`, `movedPlace`,
  `movedPlaceId`.
- Time: `timeZone`, `utcOffsetMinutes`.
- Visuals/attribution: `photos`, `iconMaskBaseUri`, `iconBackgroundColor`,
  `attributions`.

## Restaurant Decision Signals

- Reputation: `rating`, `userRatingCount`, `reviews` (max 5, relevance-sorted),
  `reviewSummary`, `consumerAlert`.
- Price: `priceLevel` (`FREE`, `INEXPENSIVE`, `MODERATE`, `EXPENSIVE`,
  `VERY_EXPENSIVE`) and `priceRange` with `startPrice` / `endPrice` money values.
- Hours: `currentOpeningHours`, `regularOpeningHours`,
  `currentSecondaryOpeningHours`, `regularSecondaryOpeningHours`.
- Secondary hours can identify `DRIVE_THROUGH`, `HAPPY_HOUR`, `DELIVERY`, `TAKEOUT`,
  `KITCHEN`, `BREAKFAST`, `LUNCH`, `DINNER`, `BRUNCH`, and `PICKUP`.
- Food/service booleans: `takeout`, `delivery`, `dineIn`, `curbsidePickup`,
  `reservable`, `servesBreakfast`, `servesLunch`, `servesDinner`, `servesBeer`,
  `servesWine`, `servesBrunch`, `servesVegetarianFood`, `servesCocktails`,
  `servesDessert`, `servesCoffee`.
- Atmosphere/suitability booleans: `outdoorSeating`, `liveMusic`,
  `menuForChildren`, `goodForChildren`, `allowsDogs`, `restroom`, `goodForGroups`,
  `goodForWatchingSports`.
- Payment: `paymentOptions.acceptsCreditCards`, `acceptsDebitCards`,
  `acceptsCashOnly`, `acceptsNfc`.
- Parking: `parkingOptions.freeParkingLot`, `paidParkingLot`,
  `freeStreetParking`, `paidStreetParking`, `valetParking`, `freeGarageParking`,
  `paidGarageParking`.
- Accessibility: `accessibilityOptions.wheelchairAccessibleParking`,
  `wheelchairAccessibleEntrance`, `wheelchairAccessibleRestroom`,
  `wheelchairAccessibleSeating`.
- Descriptions: `editorialSummary`, `generativeSummary`, `neighborhoodSummary`.

## GetToIt-Relevant Read

Google would give stronger closure/freshness (`businessStatus`), richer reputation
(`reviews`, `userRatingCount`, review summaries), and better group/suitability signals
than Foursquare. It is also strong for dietary-lite matching where vegetarian/vegan is
enough (`servesVegetarianFood`, `vegan_restaurant`, `vegetarian_restaurant`).

Weak spots: no full menu data, limited dietary/allergen specificity, higher cost for
atmosphere fields, and Google storage/attribution constraints already documented in
[[places-api-foursquare-vs-google]].
