---
issue: tb-SA-2
title: Map viewport selection editor
status: done
type: AFK
feature: 0.1.0
artifact: tracer-bullet
created: 2026-06-03
parent_github_issue: 316
github_issue: 319
---

# tb-SA-2 - Map viewport selection editor

## Parent

[[../search-area-picker-prd|Search area picker PRD]] - GitHub #316.

## User Stories Covered

US 2-8, 12, 21-22.

## What to build

Turn the foundation Search area editor into the real full-screen Apple MapKit selection surface.

The editor's draft Search area follows the map viewport. The camera center is the Search area center. The **Search area radius** is the distance from the camera center to the nearest visible map edge. Panning changes center. Pinching changes radius. The map shows the selected circle, a bottom-center badge such as `2.0 MI RADIUS`, and visible minus/plus controls that step through the allowed radius stops and keep the map zoom in sync.

Map changes update draft state only. `USE THIS AREA` commits draft state back to Setup. Closing with clean state exits. Closing with uncommitted draft changes prompts `Use this area` or `Discard changes`.

## Acceptance criteria

- [ ] Search area editor is a full-screen Apple MapKit surface opened from the Setup chip.
- [ ] Panning the map changes the draft Search area center.
- [ ] Pinching the map changes the draft Search area radius.
- [ ] Radius is computed from camera center to nearest visible map edge.
- [ ] Selected circle tracks the draft center and radius.
- [ ] Bottom-center radius badge displays the current draft radius.
- [ ] Minus/plus controls step radius through the allowed stops and update map zoom.
- [ ] First open with permission granted seeds current location plus 2.0 mi when no committed value exists.
- [ ] `USE THIS AREA` explicitly commits draft state.
- [ ] Clean close exits without prompt; dirty close prompts `Use this area` / `Discard changes`.
- [ ] Tests cover radius math, draft-vs-committed state, step controls, commit, clean close, and dirty close.

## Blocked by

- [[tb-sa-1-search-area-chip-persistence-foundation|tb-SA-1 - Search area chip + persistence foundation]] (GH [#318](https://github.com/samfarls55/gettoit/issues/318))

## 2026-06-12 diagnosis note

- The broken selector was still using the mock preview surface and deterministic adapter, so it had no native MapKit layer, no foreground location permission path, and no real geocoding/current-location source.
- Adding `expo-maps` directly to shared picker code white-screened the Expo web bundle because Metro tried to resolve native `expo-maps` internals on web. The fix splits the map view into platform files: iOS imports `expo-maps`; other platforms render a harmless fallback.
- Implementation now uses Apple MapKit on iOS, `expo-location` for current location and typed-place geocoding, viewport-derived radius math, selected-radius circle rendering, and programmatic camera sync for radius/current-location/place jumps.
- `expo-maps` does not provide Local Search / POI density lookup in this surface. Density pins remain adapter-driven and the native adapter returns `[]` until tb-SA-4 adds a native Local Search source.
- Verification: `npm run mobile:verify` passed locally. Playwright reproduced the blank web screen before the platform split and confirmed the app no longer white-screens after it. This Windows environment cannot run an iOS Simulator, so real Apple MapKit tile rendering still needs iOS device/simulator verification.
