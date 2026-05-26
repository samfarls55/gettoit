---
issue: wfr-22
title: Add Q1..Q5 labels to QuizScreen progress capsules
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 263
---

# wfr-22 — QuizScreen Progress Indicator capsules lack step labels

## What to build

The progress strip (`QuizScreen.swift:184-201`) animates fill state but the capsules are visual-only. Add "Q1 of 5" / step-number labels adjacent to or inside the row so screen readers and sighted users get position.

## Acceptance criteria

- [ ] Step indicator carries human-readable text.
- [ ] VoiceOver reads "Question N of 5".
- [ ] Snapshot test covers Q1..Q5.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Progress Indicator]]
- [[../../30_design/interaction-patterns/surfaces#Do]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #22.
