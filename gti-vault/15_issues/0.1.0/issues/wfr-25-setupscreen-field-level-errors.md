---
issue: wfr-25
title: Move SetupScreen errors to field-level
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 266
---

# wfr-25 — SetupScreen errors rendered top-of-dock, not field-local

## What to build

`SetupScreen.swift:616-621` renders a single error string at the top of the dock for both Save and Launch failures. Render errors inline beneath the field that failed, or scroll the failing field into view with localised copy.

## Acceptance criteria

- [ ] Field-local error rendering on invalid name, invalid distance.
- [ ] Top-of-dock error reserved for cross-field / network failures.
- [ ] Snapshot test covers error placement.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Error Messages]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #25.
