---
issue: wfr-26
title: Add persistent label to SetupScreen name field
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 267
---

# wfr-26 — SetupScreen name field uses placeholder-as-label (anti-pattern)

## What to build

`SetupScreen.swift:484-502` uses the prompt as the only label. Once the user starts typing the label disappears. Add a persistent floating label or a static label above the field.

## Acceptance criteria

- [ ] Label persists during and after typing.
- [ ] VoiceOver reads the label.
- [ ] Snapshot test covers empty + typed states.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Input Prompt]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #26.
