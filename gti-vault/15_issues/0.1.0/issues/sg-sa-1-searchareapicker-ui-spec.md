---
issue: sg-SA-1
status: done
type: AFK
feature: 0.1.0
artifact: spec-gap
created: 2026-06-03
parent_github_issue: 316
github_issue: 317
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.



## Parent

[[../search-area-picker-prd|Search area picker PRD]] - GitHub #316.

## User Stories Covered

US 1-8, 21-25, 31-32.

## What to build


This issue does not implement iOS behavior. It locks the product/design contract that the iOS tracer bullets consume: one compact Setup Search area chip, full-screen **Search area editor**, pan/pinch map-selection model, visible selected circle, bottom radius badge, minus/plus controls, typed/current-location **Search area jumps**, explicit `USE THIS AREA` commit, dirty close prompt, and **Density preview pin** rules.

Update the Setup surface contract so `Where to` plus `How far` are replaced by one Search area chip. Mark C-23 LocationPicker historical/superseded for active Setup use without deleting historical context. Keep Search area free of timezone/timing semantics and call out the stale reroll-window language as separate follow-up work.

## Acceptance criteria

- [ ] C-28 SearchAreaPicker is documented as the active Setup geography primitive.
- [ ] Setup surface documentation replaces separate `Where to` and `How far` controls with one Search area chip.
- [ ] The Search area editor contract includes full-screen map, close/back, top search field, current-location button, selected circle, radius badge, minus/plus controls, `USE THIS AREA`, and dirty close prompt.
- [ ] Search area radius is defined as distance from the map camera center to the nearest visible map edge.
- [ ] Search area jump is defined as recentering the map without committing.
- [ ] Density preview pins are specified as broad food/dining density feedback only, inside the selected circle, capped around 20, non-interactive, and non-blocking.
- [ ] C-23 LocationPicker is marked historical/superseded for active Setup use.
- [ ] The spec explicitly says Search area has no timezone or timing semantics.

## Blocked by

None - can start immediately.

## Comments

