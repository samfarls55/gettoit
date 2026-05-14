---
issue: sg-04
title: Geo permission pre-prime + persistent location selector — surface + LocationPicker component decision
github_issue: 48
status: needs-triage
type: HITL
created: 2026-05-14
prd: v1-prd
---

# sg-04 — Geo permission + location selector

## Parent

[[../_index|v1.1 backlog]] candidate #8.

## Why

v1 has no pre-prime surface for the iOS location permission and no persistent location-selector UI. The user wants:

- A pre-prime card explaining *why* location is needed for restaurant recommendations, fired on tap of "Start a Decision" from the new landing surface ([[sg-02-landing-page-surface|sg-02]]) and before the existing "Pick a Vertical" screen.
- A persistent location selector UI element that is always editable. Auto-populates if iOS location permission is granted; requires manual selection if denied. User can override the auto-populated value in either case.

Critical UX rule: **denying location must not break the app**. Denied users still have a viable path via manual selection. v1.1's same-geo assumption still holds, but the location source can be either GPS or manually selected.

## Why HITL

There is a component-architecture decision in this issue: the manual-entry path likely needs a `LocationPicker` component that does not exist in `design-system/components.md` yet. Two paths:

1. **New component** — propose `C-NN · LocationPicker` (a place-typeahead + map-thumbnail composite). Adds a 21st component to the locked set.
2. **Extend existing `MapKitPlacesFallback`** — reuse the iOS-side `MapKitPlacesFallback` plumbing rather than introducing a new design-system primitive. Lighter, but couples the design system to a specific iOS framework.

Per [[../../../../CLAUDE|root CLAUDE.md]] rules: "Never invent components" without surfacing the gap. Surface this decision to a human (design-system maintainer) before building either path.

## Scope

### 1. Pre-prime permission surface

- **New surface** in `design-system/surfaces/` — propose `00b-location-permission.md` (precedes Pick a Vertical in the flow). Describes:
  - Pre-prime card: title, body copy explaining "why we need your location" (anchor in the restaurant-recommendation use case), single primary CTA.
  - Behavior on CTA tap: fire native iOS `CLLocationManager.requestWhenInUseAuthorization`. Handle granted / denied paths.
  - Granted path: proceed to Pick a Vertical with auto-populated location.
  - Denied path: proceed to Pick a Vertical with empty location; manual selector becomes the entry path.
- **New JSX** at `design-system/code/screens/ScreenLocationPermission.jsx`.

### 2. Persistent location selector UI

- **Spec where the location selector lives in the existing flow.** Likely:
  - On the initiator surface (S01 / "Pick a Vertical") as an inline editable chip / row showing current location.
  - On any subsequent surface that surfaces nearby-restaurant context.
- **Component decision (HITL):** choose between new `LocationPicker` and extending `MapKitPlacesFallback`. Document the call in [[../../../60_engineering/adr|an ADR]] if it has implementation downstream of v1.1.
- **States:**
  - Auto (permission granted): pre-fills from GPS; user can tap to override.
  - Manual (permission denied): empty until user taps and selects; selection persists in session state.
  - Stale (permission granted but GPS unavailable): falls back to last-known or to manual entry.

### 3. Tokens

- No new color / typography tokens expected; standard chip / inline-input shapes.
- If the LocationPicker introduces a thumbnail map view, confirm whether it needs token treatment for map tile / pin styling (likely deferred to the post-component-decision spec work).

## Acceptance criteria

- [ ] Component-architecture decision recorded (new `LocationPicker` vs `MapKitPlacesFallback` extension), with rationale in the surface doc or a follow-on ADR.
- [ ] `design-system/surfaces/00b-location-permission.md` (or chosen name) exists describing pre-prime card + grant / deny paths.
- [ ] Persistent location selector documented in the initiator-surface spec (or wherever it lives) with auto / manual / stale states.
- [ ] If a new component is introduced, `design-system/components.md` has the entry and `design-system/code/components.jsx` implements it.
- [ ] `design-system/code/screens/ScreenLocationPermission.jsx` exists.
- [ ] `node design-system/scripts/verify.mjs` green.
- [ ] `design-system/CHANGELOG.md` entry referencing this issue.

## Open questions

- **LocationPicker vs MapKitPlacesFallback extension** — flagged HITL above. Resolve before any wire work.
- **Where exactly does the selector live?** Initiator surface only, or also above the question flow? Recommended: initiator only for v1.1; later sessions surface the selector contextually if needed.
- **Behavior if permission was denied previously and the user wants to re-enable?** iOS Settings deep-link from the manual-entry empty state. Add to spec.

## Blocked by

None — can start immediately. [[tb-03-geo-permission-and-location-selector-wire|tb-03]] is blocked on this issue, including its HITL component decision.
