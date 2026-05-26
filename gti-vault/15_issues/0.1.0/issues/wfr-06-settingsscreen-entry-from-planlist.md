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

## What to build

Add an account/gear chrome glyph to `PlanListScreen` top-trailing (or hamburger-style menu). Tap flips `showingSettings = true` on `RootView`. `SettingsScreen` continues to render via the existing precedence chain. No SettingsScreen body changes required.

`RootView.swift:71-79` already documents the gap.

## Acceptance criteria

- [ ] Top-trailing chrome glyph visible on PlanListScreen.
- [ ] Tap routes to SettingsScreen via existing `showingSettings` state.
- [ ] Done returns to PlanList.
- [ ] Snapshot test on PlanListScreen covers chrome glyph render.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Sign-In Tools]]
- [[../../30_design/interaction-patterns/surfaces#Settings]]
- [[../../30_design/interaction-patterns/principles#P-07. Habituation]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #6.

## Comments

- 2026-05-26 — Closed via [PR #274](https://github.com/samfarls55/gettoit/pull/274). PlanListScreen now hosts a top-trailing `gearshape` chrome glyph in both empty + populated states; tap fires `onOpenSettings` and RootView flips `showingSettings = true`. SettingsScreen continues to render via the existing precedence chain; Done returns to the Plan list. iOS lane green (5m7s).
