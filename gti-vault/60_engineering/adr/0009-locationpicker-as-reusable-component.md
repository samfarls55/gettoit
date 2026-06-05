---
adr: 0009
status: superseded
date: 2026-05-14
supersedes: null
superseded_by: 0020-search-area-picker-replaces-locationpicker
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.



> **SUPERSEDED â€” DO NOT BUILD NEW WORK AGAINST C-23.**
> ADR 0020 replaces the active Setup control with `C-28 SearchAreaPicker`.

## Status

Superseded by [[0020-search-area-picker-replaces-locationpicker|ADR 0020 â€” SearchAreaPicker replaces LocationPicker as the active Setup geography control]] on 2026-06-03.

Original status: accepted â€” 2026-05-14.

## Context

0.1.0 introduces a location-permission flow (issue [[../../15_issues/0.1.0/issues/sg-04-geo-permission-and-location-selector|sg-04]]) that needs:

- A pre-prime permission card before iOS fires `CLLocationManager.requestWhenInUseAuthorization`.
- A persistent location-selector UI element on the initiator surface that is always editable â€” auto-populates from GPS when permission is granted, requires manual selection when denied. Denying location must not break the app.

The selector needs three rendering pieces: (a) a chip-style readout of the current location, (b) a typeahead input for manual entry, (c) a suggestion list as the user types. Two paths existed:


The original sg-04 issue body framed the alternative as "extend `MapKitPlacesFallback`." That framing was a category error â€” `MapKitPlacesFallback` is a pure data-layer service (returns `ShapedPlace` rows, no UI), so it could feed *either* path equally. The real fork was Path A vs Path B above.

## Decision


**Superseded decision:** the active Setup geography control is now `C-28 SearchAreaPicker`, not `C-23 LocationPicker`. See ADR 0020 before changing related code.

## Why

1. **Recurrence is expected.** The maintainer's near-term roadmap surfaces location-picking in places beyond the initiator: a future profile-edit surface (allergies / dietary / cuisine preferences) deferred to pre-public-launch may include a "home area" selector; multi-geo decisions when expanding beyond a single test cohort introduce per-room location. A reusable component prevents drift between these surfaces.
2. **Composition cost is hidden.** Path A looks lighter at a glance but smuggles in implicit primitives â€” the typeahead suggestion row, the empty-state copy frame, the deny-state re-enable affordance â€” that would each need ad-hoc styling at every consumer surface. Bundling them inside `C-23` makes the shape locked and inspectable.
3. **The "component set is locked" framing is self-discipline, not policy.** The set has already grown post-original-lock (`C-21 Range Slider`, `C-22 Auth Upgrade Chip`). Additions happen when justified; this one is justified by expected recurrence.

## Consequences

### Positive

- Future surfaces drop the component in without re-designing.
- Suggestion-row shape, deny-state empty, and permission re-enable behavior are specified once in `components.md` rather than rediscovered per consumer.
- Refero references can be browsed once, anchored once, and inherited everywhere the picker appears.

### Negative / accepted tradeoffs

- One more entry in the "locked" component set. Mitigated by the discipline rule still applying â€” the next `C-24` candidate must still justify itself against composition.
- The typeahead suggestion-row visual is new territory (no existing precedent in `components.md`). Agent has token authority to add tokens where needed; risk is small visual drift from Sunset Pop that the maintainer will catch on PR.

## Re-evaluation triggers

- Location-picking does **not** appear on any surface beyond the initiator within the next two milestones (post-redesign, pre-public-launch). At that point reconsider whether `C-23` should be retired and folded into a single-surface composition.
- Multi-geo handling lands and the picker needs to render per-room rather than per-user. May force a `C-23` re-spec.

## References

- [[../../15_issues/0.1.0/issues/sg-04-geo-permission-and-location-selector|sg-04 â€” Geo permission + location selector]]
- [[../../15_issues/0.1.0/issues/tb-03-geo-permission-and-location-selector-wire|tb-03 â€” Wire geo permission + location selector]] (depends on sg-04)
- [[0002-places-data-foursquare-mapkit|ADR 0002 â€” Places data]] (`MapKitPlacesFallback` defined here)
