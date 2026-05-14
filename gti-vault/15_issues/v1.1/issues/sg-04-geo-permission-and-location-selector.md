---
issue: sg-04
title: Geo permission pre-prime + persistent location selector — C-23 LocationPicker
github_issue: 48
status: ready-for-agent
type: AFK
created: 2026-05-14
prd: v1-prd
adr: 0009-locationpicker-as-reusable-component
---

# sg-04 — Geo permission + location selector

## Parent

[[../_index|v1.1 backlog]] candidate #8.

## Why

v1 has no pre-prime surface for the iOS location permission and no persistent location-selector UI. The user wants:

- A pre-prime card explaining *why* location is needed for restaurant recommendations, fired on tap of "Start a Decision" from the new landing surface ([[sg-02-landing-page-surface|sg-02]]) and before the existing "Pick a Vertical" screen.
- A persistent location selector UI element that is always editable. Auto-populates if iOS location permission is granted; requires manual selection if denied. User can override the auto-populated value in either case.

Critical UX rule: **denying location must not break the app**. Denied users still have a viable path via manual selection. v1.1's same-geo assumption still holds, but the location source can be either GPS or manually selected.

## Component-architecture decision (RESOLVED 2026-05-14)

Recorded in [[../../../60_engineering/adr/0009-locationpicker-as-reusable-component|ADR 0009]]. **Path B: add `C-23 LocationPicker` as a reusable design-system component.** Rationale: location-picking is expected to recur on future profile-edit and multi-geo surfaces; bundling chip + sheet + typeahead + deny-state into one primitive prevents drift.

The original "extend `MapKitPlacesFallback`" alternative framing was a category error — `MapKitPlacesFallback` is a pure data-layer service, not a UI primitive. The real fork was reusable component vs ad-hoc composition. Decision is the reusable component.

## Agent autonomy granted on this issue

- **Token authority.** Agent may add tokens to `tokens.json` (and document in `tokens.md`) for any new colors / radii / shadows the picker needs (suggestion-row press, map-thumb border, typeahead caret, etc.). Honor the Sunset Pop rules: no red, no green; sun is the only state color. Regen `tokens.css` in the same commit.
- **Copy authority.** Agent drafts the pre-prime card body from `40_marketing_branding/` voice guide. Maintainer reviews on PR.
- **Refero authority.** Agent uses the Refero MCP to browse location-picker / place-picker / address-typeahead patterns and picks the best fit for Sunset Pop. No specific reference is pre-anchored.

## Scope

### 1. Pre-prime permission surface

- **New surface** in `design-system/surfaces/` — propose `00b-location-permission.md` (precedes Pick a Vertical in the flow). Describes:
  - Pre-prime card: title, body copy explaining "why we need your location" (anchor in the restaurant-recommendation use case), single primary CTA.
  - Behavior on CTA tap: fire native iOS `CLLocationManager.requestWhenInUseAuthorization`. Handle granted / denied paths.
  - Granted path: proceed to Pick a Vertical with auto-populated location.
  - Denied path: proceed to Pick a Vertical with empty location; manual selector becomes the entry path.
- **New JSX** at `design-system/code/screens/ScreenLocationPermission.jsx`.

### 2. Persistent location selector UI — C-23 LocationPicker

- **Fill in the `C-23` slot** in `design-system/components.md` (stub already in place pointing here).
- **Implement** `code/components.jsx` exports for the picker (single component or sibling pieces, agent's call on JSX shape — `C-23` stays conceptually single).
- **Document where it lives:** initiator surface (S01 / "Pick a Vertical") as an inline editable chip / row showing current location. Update the relevant `surfaces/0N-*.md` doc.
- **States:**
  - Auto (permission granted): pre-fills from GPS; user can tap to override.
  - Manual (permission denied): empty until user taps and selects; selection persists in session state.
  - Stale (permission granted but GPS unavailable): falls back to last-known or to manual entry.
  - Deny-state re-enable: empty-state of the typeahead surface offers an iOS Settings deep-link affordance for re-enabling permission.

### 3. Tokens

- Use existing tokens first.
- New tokens permitted per the autonomy clause above. Register in `tokens.json`, document in `tokens.md`, regen `tokens.css`.

## Acceptance criteria

- [ ] `design-system/surfaces/00b-location-permission.md` (or chosen name) exists describing pre-prime card + grant / deny paths.
- [ ] `design-system/code/screens/ScreenLocationPermission.jsx` exists and matches the surface doc.
- [ ] `design-system/components.md` `C-23 LocationPicker` entry filled in with visual spec table (readout chip, sheet, typeahead input, suggestion row, empty state, deny state) following the precedent of `C-19` and `C-22`.
- [ ] `design-system/code/components.jsx` exports the `LocationPicker` primitive(s).
- [ ] Persistent location selector documented on the initiator-surface spec with auto / manual / stale states.
- [ ] If new tokens were added: `tokens.json` updated, `tokens.md` documents them, `tokens.css` regenerated, all three in the same commit.
- [ ] `design-system/README.md` code map row added for the new screen + `C-23` component.
- [ ] `design-system/CHANGELOG.md` entry referencing this issue + ADR 0009.
- [ ] `node design-system/scripts/verify.mjs` green.

## Open questions (for the agent, not the maintainer)

- **Sheet vs inline expand:** Refero browse should inform whether the typeahead surface is a full bottom sheet (precedent: `C-16`) or an inline expand below the chip. Pick what feels native to Sunset Pop. Document the call in the `C-23` entry.
- **Map thumbnail or no:** the original issue floated a "place-typeahead + map-thumbnail composite." The thumbnail is optional — drop it if it complicates the visual without adding navigational value, keep it if Refero references show it earning its space.

## Blocked by

None. [[tb-03-geo-permission-and-location-selector-wire|tb-03]] (the iOS wire job) consumes this issue's output and remains blocked on it until the spec lands.

## Out of scope

- iOS-side wiring of `CLLocationManager`, `MKLocalSearchCompleter`, and session-state persistence — that is `tb-03`.
- Multi-geo / cross-geo room handling — out of v1.1 entirely; the picker's same-geo assumption still holds.
- Profile-level "home area" saved-location editor — deferred to pre-public-launch milestone.
- Changes to `MapKitPlacesFallback` or `PlacesService` data-layer code — both unchanged.
- Bug-03 (Q5 placeholders) — separate issue with its own coordinate-source stopgap.
