---
issue: tb-SA-5
title: Retire active C-23 Setup semantics
status: ready-for-agent
type: AFK
feature: 0.1.0
artifact: tracer-bullet
created: 2026-06-03
parent_github_issue: 316
github_issue: 322
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-SA-5 - Retire active C-23 Setup semantics

## Parent

[[../search-area-picker-prd|Search area picker PRD]] - GitHub #316.

## User Stories Covered

US 31-32.

## What to build

Sweep active Setup docs, tests, and comments after the Search area implementation lands so future agents do not keep rebuilding the old split model.

C-23 LocationPicker can remain historical context and reusable internals can stay if they still earn their place. What must disappear is active guidance that Setup owns a C-23 `Where to` control plus a separate `How far` distance slider, or that Search area carries timing/timezone semantics.

This issue is intentionally last. It should remove stale active references only after the implementation slices have replaced the behavior, so the cleanup can be narrow and evidence-based.

## Acceptance criteria

- [ ] Active Setup documentation no longer describes C-23 LocationPicker plus separate distance slider as current behavior.
- [ ] Active iOS tests no longer assert old C-23 Setup behavior or distance-slider behavior for Setup.
- [ ] Reusable typeahead/current-location tests are kept or renamed only when they still describe real internals.
- [ ] Comments and copy touched by this work use Search area, Search area radius, Search area editor, Search area jump, and Density preview pin terminology.
- [ ] No new or retained active Setup language says Search area owns timezone or timing semantics.
- [ ] Historical docs remain readable and clearly superseded rather than silently rewritten.
- [ ] Verification follows the repo matrix for the touched docs/code/tests.

## Blocked by

- [[tb-sa-1-search-area-chip-persistence-foundation|tb-SA-1 - Search area chip + persistence foundation]] (GH [#318](https://github.com/samfarls55/gettoit/issues/318))
- [[tb-sa-2-map-viewport-selection-editor|tb-SA-2 - Map viewport selection editor]] (GH [#319](https://github.com/samfarls55/gettoit/issues/319))
- [[tb-sa-3-search-area-jumps|tb-SA-3 - Search area jumps]] (GH [#320](https://github.com/samfarls55/gettoit/issues/320))
- [[tb-sa-4-density-preview-pins|tb-SA-4 - Density preview pins]] (GH [#321](https://github.com/samfarls55/gettoit/issues/321))
