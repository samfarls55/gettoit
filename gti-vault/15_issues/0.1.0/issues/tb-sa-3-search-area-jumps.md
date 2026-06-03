---
issue: tb-SA-3
title: Search area jumps
status: ready-for-agent
type: AFK
feature: 0.1.0
artifact: tracer-bullet
created: 2026-06-03
parent_github_issue: 316
github_issue: 320
---

# tb-SA-3 - Search area jumps

## Parent

[[../search-area-picker-prd|Search area picker PRD]] - GitHub #316.

## User Stories Covered

US 9-13.

## What to build

Add **Search area jump** behavior to the Search area editor.

Typed search supports city, neighborhood, and address queries. Selecting a search result recenters the map and updates draft Search area state, but it does not commit. The user still tunes and taps `USE THIS AREA`.

The current-location button is also a Search area jump. It recenters the map to the current location when available and leaves the user in draft-editing mode. When location permission is denied or not granted and no committed value exists, first open should start in a search-first state instead of showing a broken location-dependent editor.

## Acceptance criteria

- [ ] Editor includes a top search field for city, neighborhood, and address search.
- [ ] Selecting a typed search result recenters the map.
- [ ] Search result selection updates draft state but does not commit.
- [ ] Current-location button recenters the map when a current location is available.
- [ ] Current-location jump updates draft state but does not commit.
- [ ] No committed value plus denied/not-granted permission opens in a search-first state.
- [ ] Search-first state gives the user a clear path to type a jump query.
- [ ] Existing useful typeahead/current-location internals may be reused, but user-facing language is Search area / Search area jump.
- [ ] Tests cover typed jump, current-location jump, non-commit behavior, and denied/not-granted first-open behavior.

## Blocked by

- [[tb-sa-2-map-viewport-selection-editor|tb-SA-2 - Map viewport selection editor]] (GH [#319](https://github.com/samfarls55/gettoit/issues/319))
