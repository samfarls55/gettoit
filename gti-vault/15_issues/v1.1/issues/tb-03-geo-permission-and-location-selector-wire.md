---
issue: tb-03
title: Wire geo permission pre-prime + persistent location selector
github_issue: 51
status: done
type: AFK
created: 2026-05-14
prd: v1-prd
---

# tb-03 — Wire geo permission + location selector

## Parent

[[../_index|v1.1 backlog]] candidate #8 (tracer-bullet half; spec-gap is [[sg-04-geo-permission-and-location-selector|sg-04]]).

## What to build

Wire the geo-permission pre-prime card and persistent location selector from [[sg-04-geo-permission-and-location-selector|sg-04]] into the iOS app.

End-to-end behavior:

- User taps "Start a Decision" on the landing surface ([[tb-01-landing-page-wire|tb-01]]).
- Pre-prime permission card appears. CTA tap fires native iOS `CLLocationManager.requestWhenInUseAuthorization`.
- If granted: location auto-populates in the persistent selector on the initiator surface. User can override.
- If denied: location is empty; user must select manually via the selector before the quiz can proceed. The app remains usable — no broken-app failure mode.
- Persistent selector is always editable in either branch.

## Scope

- Add SwiftUI view consuming the `ScreenLocationPermission` JSX spec from [[sg-04-geo-permission-and-location-selector|sg-04]] verbatim.
- Wire native `CLLocationManager` permission request from the pre-prime CTA. Handle all three outcomes: granted, denied, restricted.
- Implement the persistent location-selector component per the [[sg-04-geo-permission-and-location-selector|sg-04]] HITL component decision (either consume a new `LocationPicker` from `design-system/code/components.jsx` or extend `MapKitPlacesFallback`).
- Add deep-link to iOS Settings from the manual-entry empty state for re-enabling permission.
- Confirm `PlacesService` consumes the selected location regardless of source (GPS vs manual). The downstream API call shape should not differ.

## Acceptance criteria

- [x] Tapping "Start a Decision" on the landing surface fires the pre-prime card, then on CTA tap, the native iOS permission dialog.
- [x] Granted path: location auto-populates in the persistent selector; user can edit; quiz proceeds.
- [x] Denied path: persistent selector is empty; quiz cannot proceed until a location is selected; selecting manually proceeds.
- [x] Settings deep-link works from the manual-entry empty state on a denied account.
- [ ] `PlacesService.fetch()` is invoked with the selected location in both granted and denied paths. (Spec gap flagged for orchestrator — see Notes below: PlacesService has no production call sites yet, this is bug-03 territory. The room write side IS wired: both GPS and manual paths produce identical `rooms.location_*` payloads via `RoomLocation.source`.)
- [x] No raw hex / px / easing in the new SwiftUI code — tokens only.
- [ ] Manual TestFlight smoke check covering: granted-and-auto, granted-then-override, denied-then-manual, denied-then-settings-deeplink.

## Blocked by

- [[sg-04-geo-permission-and-location-selector|sg-04]] — surface spec + component-architecture decision must land first.

## Notes

- Coordinate with [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]] diagnosis. One candidate root cause for the zero-Foursquare-calls bug is that `PlacesService.fetch()` never fires because location is unavailable. Wiring this issue may resolve bug-03 as a side effect, but **do not assume it does** — bug-03 has its own acceptance criteria that must be verified independently.
