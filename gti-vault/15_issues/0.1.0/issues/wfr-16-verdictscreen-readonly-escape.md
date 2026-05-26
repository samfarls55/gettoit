---
issue: wfr-16
title: Restore Escape affordance on VerdictScreen .readOnly
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 257
pr: 289
merged: 2026-05-26
---

# wfr-16 — VerdictScreen .readOnly mode suppresses Home chrome

## What to build

`.readOnly` currently hides the Home chrome row (`VerdictScreen.swift:391-413`). Add a "Close" or "Done" affordance that fires the existing `onAdvance` callback — for the late-joiner branch this opens Solo Setup (the existing re-invite CTA), but the chrome should be visible regardless.

## Acceptance criteria

- [x] `.readOnly` mode renders a Close/Done affordance.
- [x] Tap fires `onAdvance`.
- [x] Snapshot test covers `.readOnly` render with chrome.

## Blocked by

None — ships as a chrome-only add now.

**Entanglement (soft):** finding #1 in the workflow-review run report ([[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]]) is a grill on VerdictScreen's 5-mode collapse. If that grill splits `.readOnly` out into its own surface, this chrome add migrates there cleanly. Ship now, revisit if/when the grill resolves.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/surfaces#Focus]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #16.

## Comments

- 2026-05-26 — Shipped via PR #289 (squash-merged). `.readOnly` now renders the chrome row with a `Done` verb (not `Home`) wired to `onAdvance` — Solo Setup is the only honest destination for the late-joiner since they have no Plan list. Every iOS-reachable verdict mode now carries a top-leading escape slot. Spec amendment: `design-system/surfaces/05-verdict.md` §"Verdict chrome (Home / Done)" replaces the prior "Home omitted on read-only" rule. No new tokens / components; reused the existing eyebrow row primitive. `ModeSnapshot` gained `homeChromeLabel` + `chromeFiresAdvance` so the view body stays free of mode branching.
