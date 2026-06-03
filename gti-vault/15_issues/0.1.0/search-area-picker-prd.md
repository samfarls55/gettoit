---
title: Search area picker PRD
status: ready-for-agent
feature: 0.1.0
artifact: prd
created: 2026-06-03
github_issue: 316
source:
  - "[[../../50_product/0.1.0-search-area-picker|Search area picker locked decisions]]"
  - "[[../../60_engineering/adr/0020-search-area-picker-replaces-locationpicker|ADR 0020]]"
---

# Search area picker PRD

## Problem Statement

The current Setup geography flow asks the Plan creator to pick `Where to` with a text-first LocationPicker and then tune `How far` with a separate distance slider. That splits one mental task into two controls: users are trying to choose the area where GetToIt should look, but the app makes them reason about a place label and a radius as separate fields.

This also keeps the old C-23 LocationPicker contract alive in active Setup work. C-23 is a location-only primitive. The current product need is a **Search area**: a center and radius edited together on a map, with enough visual feedback for a user to tell whether the area is too tight, too broad, or pointed at the wrong neighborhood.

## Solution

Replace the active Setup geography control with **C-28 SearchAreaPicker**.

Setup shows one compact Search area chip. Tapping it opens a full-screen Apple MapKit **Search area editor** where the user pans and pinches the map, uses typed search or current location as a **Search area jump**, sees a visible selected circle, and commits with `USE THIS AREA`.

The selected Search area is derived from the map viewport:

- Center is the map camera center.
- **Search area radius** is the distance from the center to the nearest visible map edge.
- Pan changes the center.
- Pinch zoom changes the radius.
- Minus and plus controls step through the same allowed radius stops for accessibility.

The editor shows **Density preview pins** from broad Apple MapKit food/dining search inside the selected circle. These pins are sizing feedback only. They are not candidates, recommendations, venue details, or promises about the eventual **Candidate pool**.

The feature does not require a schema change. The committed Search area persists into the existing center and radius fields already used by Plans and Rooms.

## User Stories

1. As a Plan creator, I want to set one Search area instead of separate location and distance fields, so that Setup matches how I think about where we should eat.
2. As a Plan creator, I want to open a full-screen map from a compact Setup chip, so that Setup stays quick but the geography editor has room to be useful.
3. As a Plan creator, I want to pan the map to move the Search area center, so that I can point GetToIt at the right neighborhood.
4. As a Plan creator, I want to pinch the map to adjust the Search area radius, so that I can make the area tighter or broader visually.
5. As a Plan creator, I want the selected area to be shown as a circle, so that I can understand exactly what area I am committing.
6. As a Plan creator, I want a radius badge such as `2.0 MI RADIUS`, so that I can read the current Search area radius without guessing from the map.
7. As a Plan creator, I want minus and plus radius buttons, so that I can adjust the radius even when pinch zoom is uncomfortable or inaccessible.
8. As a VoiceOver user, I want the radius controls to expose the same radius stops as the map gesture, so that non-gesture control is not a second-class path.
9. As a Plan creator, I want typed search for a city, neighborhood, or address, so that I can jump the map to a known place quickly.
10. As a Plan creator, I want typed search to recenter the map without instantly committing, so that I can tune the final area before saving it.
11. As a Plan creator, I want a current-location button, so that I can jump back to where I am now.
12. As a Plan creator with location permission granted, I want first open to start at my current location with a 2.0 mi radius, so that the default is useful near home.
13. As a Plan creator without location permission, I want the editor to start in a search-first state, so that denial does not make the app feel broken.
14. As a Plan creator editing a pending Plan, I want the editor to open from the saved Search area, so that I do not have to rebuild it.
15. As a Plan creator starting a fresh Plan, I want the app not to reuse a prior Plan's Search area, so that an old dinner location does not silently leak into a new Plan.
16. As a Plan creator, I want Density preview pins inside the selected circle, so that I can judge whether the Search area has enough food density.
17. As a Plan creator, I want Density preview pins to refresh only after map movement settles, so that the map remains smooth while I pan or pinch.
18. As a Plan creator, I want Density preview pins capped around 20, so that the map gives density feedback without becoming cluttered.
19. As a Plan creator, I want Density preview pins to be non-interactive, so that I do not mistake them for candidates or recommendations.
20. As a Plan creator, I want no venue cards in the Search area editor, so that the editor stays focused on area selection rather than restaurant browsing.
21. As a Plan creator, I want to explicitly tap `USE THIS AREA`, so that accidental map movement does not change my Plan.
22. As a Plan creator with uncommitted map changes, I want closing the editor to prompt me to use or discard the area, so that I do not lose work silently.
23. As a Plan creator, I want the Setup chip to show the committed center label as the main line, so that I can recognize the Search area later.
24. As a Plan creator, I want the Setup chip to show the radius as supporting text, so that I can see both parts of the Search area at a glance.
25. As a Plan creator with no committed Search area, I want the Setup chip to read `Set search area`, so that the next action is obvious.
26. As a Plan creator saving for later, I want Search area to remain optional, so that I can create a pending Plan before deciding where.
27. As a Plan creator launching a group Plan, I want `Drop the invite link` to require a committed Search area, so that the Room has the geography needed to fetch candidates.
28. As a Plan creator launching a solo Plan, I want `Start the quiz` to require a committed Search area, so that the quiz is not started without fetch geography.
29. As a Plan creator who taps launch with no Search area, I want the app to open the Search area editor instead of minting a Room, so that I can fix the missing input in place.
30. As a returning Account member, I want pending Plans to preserve the committed Search area, so that edit mode remains stable across app launches.
31. As an implementation agent, I want old C-23 active Setup references to be retired or marked historical, so that future work does not rebuild the split location-plus-distance model.
32. As an implementation agent, I want Search area to carry no timezone or timing semantics, so that this feature does not deepen the known reroll-window conflict.

## Implementation Decisions

- Introduce **C-28 SearchAreaPicker** as the active Setup geography primitive. It owns the compact chip, full-screen editor, Search area copy, map interactions, radius readout, jump controls, Density preview pins, and explicit commit behavior.
- Keep C-23 LocationPicker as historical/superseded for Setup. Existing current-location, typed-search, and geocoding coordination may be reused internally, but active product language moves to Search area and Search area jump.
- Replace Setup's separate `Where to` and `How far` controls with one Search area chip. The rest of Setup remains scoped to existing Plan creation and edit behavior.
- Model the editor with draft and committed Search area state. Map movement updates only the draft. `USE THIS AREA` commits the draft back to Setup.
- Dirty close is required when draft state differs from committed state. The prompt actions are `Use this area` and `Discard changes`.
- Calculate **Search area radius** from map viewport geometry as the distance from the map camera center to the nearest visible map edge. Persist the committed radius as meters.
- Radius step buttons use the same allowed stops as gesture-driven zoom. When the user taps a step button, the map zoom updates to reflect the selected radius.
- Typed search and current-location are both **Search area jumps**. They recenter the map and leave the user in draft-editing mode.
- First-open defaults are fixed: current location plus 2.0 mi when permission is granted; search-first when permission is denied or not granted; saved Search area when editing an existing pending Plan.
- New Plans must not default to a prior Plan's Search area. Defaults come from current location when allowed, not from user history.
- **Density preview pins** come from broad Apple MapKit food/dining search, refresh after map idle or debounce, filter to the selected circle, and cap around 20 visible pins.
- Density preview failure or empty density results must not block committing the Search area. The selected area is valid even when no preview pins render.
- Density preview pins are non-interactive. They do not expose cards, detail payloads, ranking, cuisine filters, open-now filters, quiz filters, or final Candidate pool eligibility.
- `Save for later` keeps Search area optional. Launch actions require a committed Search area and open the editor if missing.
- Persist Search area through existing center and radius storage. No migration, no new table, and no new public schema contract are part of this PRD.
- Search area has no timing or timezone semantics. Any correction to stale reroll-window timezone language is a separate follow-up.
- Search area commit copy is `USE THIS AREA`. Setup empty chip copy is `Set search area`. Committed chip text uses a human center label as the main line and `Search area - N.N mi` as supporting text.

## Testing Decisions

- Tests should assert external behavior: what state the user sees, what value is committed, what data is persisted, and what action launches or blocks. Avoid tests that bind to private view structure unless the project already uses explicit render snapshots for the same surface.
- Add unit coverage for Search area value math: center retention, radius-from-viewport calculation, meters/miles formatting, radius stop snapping, and tie behavior.
- Add state-machine coverage for editor draft versus committed state: pan, pinch, radius step, Search area jump, current-location jump, commit, clean close, and dirty close.
- Add Setup validation tests for the split between `Save for later` optional and launch required. Launch with no Search area should open the editor and should not mint a Room.
- Add persistence tests proving the committed Search area writes through the existing center/radius fields and preserves edit-mode reload.
- Add Density preview provider tests with fakes: debounce after idle, circle filtering, cap around 20, non-blocking failure, and non-interactive result shape.
- Add accessibility-focused tests or assertions for the minus/plus controls and radius value exposure.
- Update or replace existing C-23 and distance-slider tests that currently describe active Setup behavior. Keep any reusable current-location/typeahead tests that still describe internals after the ownership rename.
- Prior art: the existing LocationCoordinator tests cover permission/typeahead state, the existing Setup tests cover validation and persistence mapping, and the existing map/fetch planner tests cover radius forwarding. Use those patterns rather than inventing a new testing style.
- Verification should follow the repo matrix. Design-system-only changes run the design-system verifier; Swift implementation runs the iOS CI or XcodeBuildMCP lane when available.

## Out of Scope

- Schema changes or data migrations.
- Reworking the Plan reroll window, timezone rules, or stale timing docs beyond avoiding new Search area timing semantics.
- Changing the Candidate pool scoring, ranking, or Foursquare fetch strategy.
- Turning Density preview pins into candidate cards, venue details, recommendations, or browse results.
- Rendering an inline map on Setup.
- Web invitee geography editing.
- New account, Plan list, quiz, waiting, verdict, or no-survivor flows except where they consume the committed Search area already stored on the Plan or Room.
- A reusable generic map picker outside the Search area use case.

## Further Notes

- Source decisions are locked in [[../../50_product/0.1.0-search-area-picker|0.1.0-search-area-picker]] and accepted in [[../../60_engineering/adr/0020-search-area-picker-replaces-locationpicker|ADR 0020]].
- ADR 0009 is superseded for active Setup geography work. Do not use it as active guidance for the new component.
- The known "search-area timezone" language conflict remains a separate documentation and product correction.
