---
issue: wfr-30
title: Add Help affordance to InviteShell name entry
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 271
---

# wfr-30 — web/app/join has no Help Systems / FAQ on name entry

## What to build

New invitees arriving at `/join/[roomId]` see only a name field + Join button. Add a "What is GetToIt?" or "Help" inline link near the form. Folds into [[wfr-10-web-global-footer|wfr-10]] if the global footer ships first — in that case, ensure the footer's Help link is visible on the InviteShell route and close this issue with a pointer.

## Acceptance criteria

- [ ] Help affordance visible on NameEntry surface (either standalone or via global footer).

## Blocked by

- [[wfr-10-web-global-footer|wfr-10]] — folds into that fix if it ships first.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Help Systems]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #30.

## Comments

