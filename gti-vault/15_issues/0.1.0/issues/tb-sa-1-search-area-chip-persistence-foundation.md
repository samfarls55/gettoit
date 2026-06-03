---
issue: tb-SA-1
title: Search area chip + persistence foundation
status: ready-for-agent
type: AFK
feature: 0.1.0
artifact: tracer-bullet
created: 2026-06-03
parent_github_issue: 316
github_issue: 318
---

# tb-SA-1 - Search area chip + persistence foundation

## Parent

[[../search-area-picker-prd|Search area picker PRD]] - GitHub #316.

## User Stories Covered

US 1, 14-15, 23-30.

## What to build

Replace active Setup geography with the first end-to-end **Search area** path.

Setup should render one Search area chip instead of separate location and distance controls. The chip shows `Set search area` when empty, and after commit shows a human center label as the main line plus `Search area - N.N mi` as supporting text. Editing a pending Plan reloads its committed Search area. Fresh Plans must not inherit a prior Plan's Search area.

Add the foundation editor path needed to make this slice demoable: tapping the chip opens the Search area editor shell, seeds it from saved Search area or the first-open default, and lets the user commit a Search area via `USE THIS AREA`. The full map viewport pan/pinch behavior lands in tb-SA-2; this slice is about replacing Setup's active data flow and proving the committed value can be saved, edited, launched, and reloaded.

Persist the committed Search area through existing center/radius storage. No schema change is allowed. `Save for later` remains allowed without a Search area. Launch actions require a committed Search area; if missing, they open the editor instead of minting a Room.

## Acceptance criteria

- [ ] Setup renders one Search area chip and no active separate `Where to` LocationPicker row or `How far` distance slider.
- [ ] Empty chip copy is `Set search area`.
- [ ] Committed chip main line is the best available center label and supporting text is `Search area - N.N mi`.
- [ ] Committing from the editor writes the Search area into existing center/radius storage.
- [ ] Editing a pending Plan reopens with the saved Search area.
- [ ] Fresh Plan creation does not seed from a previous Plan's Search area.
- [ ] `Save for later` can persist a pending Plan without Search area.
- [ ] `Drop the invite link` / `Start the quiz` with no Search area opens the editor and does not mint a Room.
- [ ] Launch with a committed Search area continues through the existing Room creation path and forwards the stored radius.
- [ ] Tests cover persistence, edit reload, launch gating, and absence of the old active Setup controls.

## Blocked by

- [[sg-sa-1-searchareapicker-design-system-spec|sg-SA-1 - SearchAreaPicker design-system spec]] (GH [#317](https://github.com/samfarls55/gettoit/issues/317))
