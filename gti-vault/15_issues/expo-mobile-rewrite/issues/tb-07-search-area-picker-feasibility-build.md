---
status: ready-for-agent
type: AFK
github_issue: 332
---

# TB-07: Search area picker feasibility build

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Build the first Expo-managed Search area picker implementation and web mock. It should pursue C-28 behavior directly: map-centered area selection, current-location jump, typed place jump, radius display, radius step controls, and density preview pins. Native feel can be debugged after the full migration, but the app architecture should keep map/location boundaries testable.

## Acceptance criteria

- [ ] Search area state stores committed center and radius as one user-facing Search area.
- [ ] The native-facing implementation path supports map camera movement, current-location jump, typed place jump, radius display, radius steps, and preview pins as far as Expo managed APIs allow.
- [ ] Expo web has a deterministic mock/preview that lets agents exercise Search area states without native maps.
- [ ] Tests cover Search area state math, dirty/commit/cancel behavior, and adapter contracts with fakes.
- [ ] Any known Expo API gaps are documented in the issue/PR notes.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-01: Scaffold Expo mobile dev loop.

