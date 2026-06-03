---
adr: 0020
title: SearchAreaPicker replaces LocationPicker as the active Setup geography control
status: accepted
date: 2026-06-03
supersedes: 0009-locationpicker-as-reusable-component
superseded_by: null
---

# 0020 — SearchAreaPicker replaces LocationPicker as the active Setup geography control

## Status

Accepted — 2026-06-03. Supersedes [[0009-locationpicker-as-reusable-component|ADR 0009]].

## Context

ADR 0009 introduced `C-23 LocationPicker`: a reusable text-first location selector with a chip, bottom sheet, current-location affordance, and MapKit typeahead. It deliberately did not include a map thumbnail or radius editing; Setup paired it with a separate `How far` distance slider.

The 2026-06-03 Search area grill changed the product model. The user should choose an area the way Airbnb-style maps work: pan and pinch a full-screen Apple MapKit map, with the map viewport defining the selected center/radius. The UI needs a visible radius circle, distance badge, density preview pins, typed jump-to-place search, and explicit commit. This is not a location-only picker anymore.

Leaving C-23 as the active label would invite future agents to preserve the old split: "location" in one component, "distance" elsewhere, plus stale sheet/typeahead assumptions. Worse, ADR 0009 would look like accepted guidance telling agents to keep using a component the product has now outgrown.

## Decision

**Create `C-28 SearchAreaPicker` and retire C-23 from active Setup use.**

`C-28 SearchAreaPicker` owns the user-facing Search area concept:

- one Setup chip
- full-screen Apple MapKit editor
- pan/pinch selects map center + radius
- typed search and current-location are jumps that recenter the map
- visible radius circle and bottom radius badge
- minus/plus radius step controls for accessibility
- density preview pins inside the selected circle
- explicit `USE THIS AREA` commit

C-23 LocationPicker becomes historical context. Existing MapKit/current-location/typeahead code may be reused internally, but active product language and design-system ownership move to Search area / C-28.

No schema change is part of this decision. Persist Search area into the existing center/radius fields (`location_*`, `distance_meters`, `radius_meters`) for 0.1.0.

## Considered alternatives

### Keep C-23 active and add map/radius features to it

Rejected because the name and prior contract are now misleading. "LocationPicker" implies a center/place selection; the new user-facing thing is center + radius as one Search area. Keeping the old component name would hide the model shift and make old docs look fresher than they are.

### Keep C-23 inactive as a parallel reusable location-only component

Rejected for Setup scope because it creates two geography primitives without a real active consumer for location-only picking. A future location-only surface can reintroduce or rebuild that primitive if the need earns its place.

### Rename C-23 in place

Rejected because ADR 0009 and existing design-system references carry old assumptions: bottom sheet, no map thumbnail, typeahead selection as the main editor, no radius. A new component number makes the reversal visible and searchable.

## Consequences

- `design-system/components.md` should add `C-28 SearchAreaPicker` and mark `C-23 LocationPicker` superseded/historical for Setup.
- `design-system/surfaces/01-setup.md` should replace `Where to` + `How far` with one Search area chip.
- iOS should replace `LocationPickerChip` / `LocationPickerSheet` and the Setup distance slider with the Search area flow.
- Tests that assert C-23 empty/loading/manual states as Setup behavior need to move to C-28 semantics.
- Separate timing docs that mention "search-area timezone" remain a known conflict. Search area has no timezone or timing semantics; timing behavior needs its own correction.
