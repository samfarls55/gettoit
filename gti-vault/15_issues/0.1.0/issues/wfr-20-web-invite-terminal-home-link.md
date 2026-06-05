---
issue: wfr-20
title: Add home link to InviteShell terminal states
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 261
---

# wfr-20 — web/app/join terminal screens have no home link

## What to build

After a join attempt resolves to closed/left, the user is stranded with no navigation. Add a "Back to GetToIt" link to terminal states inside `InviteShell` (`PlanClosedTerminal` / `PlanLeftTerminal`).

If [[wfr-18-web-gtimark-logo-home-link|wfr-18]] ships first, the global logo home link reduces the urgency but a contextual CTA at the terminal copy is still warranted.

## Acceptance criteria

- [ ] Home link visible on closed terminal.
- [ ] Home link visible on left terminal.

## Blocked by

- [[wfr-18-web-gtimark-logo-home-link|wfr-18]] — soft dependency; logo link should land first so the terminal CTA can be styled as a contextual secondary rather than the only escape.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #20.

## Comments

