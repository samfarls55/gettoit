---
issue: wfr-10
title: Add global footer with Privacy/Terms/Help links to web layout
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 251
---

# wfr-10 — web/app/layout.tsx has no global footer, no Help affordance

## What to build

Add a global `<footer>` to `web/app/layout.tsx` with links to `/privacy`, `/terms`, and a Help affordance. Footer renders on every page including legal pages and terminal join states.

**Support email handling (soft block — see [[../../../../home/node/.claude/projects/-workspace/memory/project_support_email_todo|project_support_email_todo]]):** `support@gettoit.app` mailbox does not exist yet (v1 launch blocker tracked in TB-16). For now, render the Help link as a placeholder element (e.g., link to `/contact` route stub, or label as "Help (coming soon)"). Do NOT add `mailto:support@gettoit.app` until the mailbox exists. Land everything else (Privacy, Terms, layout, responsive collapse).

## Acceptance criteria

- [ ] Footer visible on every web route.
- [ ] Links to `/privacy` and `/terms` resolve correctly on `/`, `/privacy`, `/terms`, `/join/[roomId]`, `/s/[sessionId]`, `/places-fallback`.
- [ ] Help affordance present but does not yet point at `mailto:support@gettoit.app`.
- [ ] Footer collapses gracefully on mobile widths.

## Blocked by

None (soft block on support email — ships without mailto, see body).

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Help Systems]]
- [[../../30_design/interaction-patterns/principles#S-01. Consistency]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #10.

## Comments

