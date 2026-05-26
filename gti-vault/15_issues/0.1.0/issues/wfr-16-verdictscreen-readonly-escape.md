---
issue: wfr-16
title: Restore Escape affordance on VerdictScreen .readOnly
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 257
---

# wfr-16 — VerdictScreen .readOnly mode suppresses Home chrome

## What to build

`.readOnly` currently hides the Home chrome row (`VerdictScreen.swift:391-413`). Add a "Close" or "Done" affordance that fires the existing `onAdvance` callback — for the late-joiner branch this opens Solo Setup (the existing re-invite CTA), but the chrome should be visible regardless.

## Acceptance criteria

- [ ] `.readOnly` mode renders a Close/Done affordance.
- [ ] Tap fires `onAdvance`.
- [ ] Snapshot test covers `.readOnly` render with chrome.

## Blocked by

None — ships as a chrome-only add now.

**Entanglement (soft):** finding #1 in the workflow-review run report ([[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]]) is a grill on VerdictScreen's 5-mode collapse. If that grill splits `.readOnly` out into its own surface, this chrome add migrates there cleanly. Ship now, revisit if/when the grill resolves.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/surfaces#Focus]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #16.
