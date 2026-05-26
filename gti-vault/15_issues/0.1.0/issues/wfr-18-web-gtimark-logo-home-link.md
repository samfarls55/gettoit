---
issue: wfr-18
title: Wrap GTIMark logo as Link to /
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 259
---

# wfr-18 — Web global logo not clickable as home link

## What to build

Make the GTIMark / logo a `<Link href="/">` in the shared layout. Currently the logo is non-interactive on every web surface.

## Acceptance criteria

- [ ] Logo is a clickable link to `/` on every web route.
- [ ] Visual style unchanged.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/principles#P-07. Habituation]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #18.
