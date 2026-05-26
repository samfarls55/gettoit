---
issue: wfr-06
title: Wire SettingsScreen entry from PlanList chrome
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 247
github_pr: 274
---

# wfr-06 — SettingsScreen has no UI entry point anywhere in the app

## Workflow design

**Nav model.** GetToIt app shell is **Hub-and-Spoke** ([[../../30_design/interaction-patterns/surfaces#Navigation models]]). `PlanListScreen` is the hub. Spokes are `SettingsScreen` (now), `ProfileScreen`, `HelpScreen` (later — same glyph evolves into a menu sheet when cardinality > 1).

Considered + rejected:
- **Flat** (current de-facto) — breaks the moment Settings ships; user has no way in.
- **Bottom Navigation** ([[../../30_design/interaction-patterns/patterns#Bottom Navigation]]) — overkill for 1 spoke; consumes thumb real estate; signals "many destinations" when there's really one hub.
- **Hamburger drawer** — hides the hub identity; PlanList *is* the app, the user shouldn't drawer-open to remember that.
- **Multilevel / Tree** — premature; would force History into its own destination before cardinality demands it (see [[#Grill #4 outcome]] note in run report).

**Pattern.** Top-trailing **[[../../30_design/interaction-patterns/patterns#Sign-In Tools]]** cluster. Apple convention (Settings, Maps, Music, Mail all park utility chrome top-right). One glyph today (`gearshape`); evolves into avatar+menu when Profile lands.

**Foundations.**
- [[../../30_design/interaction-patterns/principles#P-07. Habituation]] — top-right gear is the iOS convention; zero novelty cost.
- [[../../30_design/interaction-patterns/principles#P-09. Spatial Memory]] — glyph stays at the same screen coordinate across PlanList empty + populated states; users can muscle-memory it.

## What to build

Add a `gearshape` chrome glyph to `PlanListScreen` top-trailing (toolbar). Tap fires `onOpenSettings` callback; `RootView` flips `showingSettings = true`. `SettingsScreen` continues to render via the existing precedence chain. No `SettingsScreen` body changes required.

`RootView.swift:71-79` already documents the gap.

## Acceptance criteria

- [ ] Top-trailing chrome glyph visible on PlanListScreen (both empty + populated states).
- [ ] Tap routes to SettingsScreen via existing `showingSettings` state on RootView.
- [ ] Done returns to PlanList.
- [ ] Glyph position is identical across empty + populated render paths (P-09 Spatial Memory).
- [ ] Snapshot test on PlanListScreen covers chrome glyph render.

## Blocked by

None — can start immediately.

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #6.

## Comments

- 2026-05-26 — Closed via [PR #274](https://github.com/samfarls55/gettoit/pull/274). PlanListScreen now hosts a top-trailing `gearshape` chrome glyph in both empty + populated states; tap fires `onOpenSettings` and RootView flips `showingSettings = true`. SettingsScreen continues to render via the existing precedence chain; Done returns to the Plan list. iOS lane green (5m7s).
