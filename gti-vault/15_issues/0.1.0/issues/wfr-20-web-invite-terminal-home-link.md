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

- 2026-05-26 — Closed via PR for `afk/wfr-20`. Added a quiet tertiary `"Back to GetToIt"` link (eyebrow-token, white 0.6, `href="/"`, 44pt hit row) below the body on both `PlanClosedTerminal` (§D) and `PlanLeftTerminal` (§E) in `web/components/InviteShellSurfaces.tsx`. Implemented inside the shared `PostFlowTerminal` helper so both terminals stay byte-identical and gain the Escape Hatch in one place. Duplicates the destination of the global wfr-18 GTIMark wordmark link but lives in body-flow so a stranded invitee whose eye is on the copy ("Ask whoever shared it…" / "Tap the link again…") has the home affordance in their gaze. Same visual register as the §E `LeaveConfirmSheet` `STAY` dismiss row — explicitly NOT a CTA. Surface doc `design-system/surfaces/web-01-invitee-shell.md` §D/§E updated with the new row + amended `No primary CTA` section that distinguishes a Plan-side primary CTA (still forbidden) from a tertiary Escape Hatch link (now warranted). Tests in `web/components/InviteShellSurfaces.test.tsx` cover the link role + href.
