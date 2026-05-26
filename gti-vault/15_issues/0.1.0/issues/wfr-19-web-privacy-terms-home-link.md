---
issue: wfr-19
title: Add home link to privacy + terms pages
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 260
---

# wfr-19 — web/app/privacy + terms have no in-page back-to-home

## What to build

If [[wfr-18-web-gtimark-logo-home-link|wfr-18]] (clickable logo) ships first, the global logo home link covers both pages — close this issue with a pointer.

If shipping wfr-18 is deferred, add an explicit "Back to home" link at the top of `web/app/privacy/page.tsx` and `web/app/terms/page.tsx`.

## Acceptance criteria

- [ ] Either logo-as-home-link (via wfr-18) or in-page home link is visible on both `/privacy` and `/terms`.

## Blocked by

- [[wfr-18-web-gtimark-logo-home-link|wfr-18]] — folds into that fix if it ships first.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #19.
