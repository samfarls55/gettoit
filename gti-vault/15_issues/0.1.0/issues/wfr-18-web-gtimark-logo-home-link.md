---
issue: wfr-18
title: Wrap GTIMark logo as Link to /
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
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

## Comments

- 2026-05-26 — Closed via PR #292. Modified the shared `GTIMark` primitive in `web/components/SunsetPop.tsx` to render as a `next/link` `<Link href="/">` with `aria-label="GetToIt — home"`. Visual lockup byte-identical (`display: inline-flex`, `text-decoration: none` reset). Single-point change propagates the home affordance to every surface that mounts the wordmark (NameEntry, InviteShell error/closed/left/verdict, InviteShellSurfaces verdict + post-flow terminals, WaitingScreen). New `SunsetPop.test.tsx` covers the link role + accessible name. wfr-20's contextual terminal CTA is now a strict-secondary affordance, as wfr-20's "Blocked by" note anticipated.
