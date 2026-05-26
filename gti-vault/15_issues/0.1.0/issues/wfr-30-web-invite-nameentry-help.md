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

- 2026-05-26 — Closed via AFK PR #308 (squash-merged into main). Folded into wfr-10's global footer: that footer was already mounted in `RootLayout` with a Help (coming soon) affordance, but the `/join/[roomId]` route's `<main style={position:"fixed", inset:0}>` sat in a separate stacking context and visually covered the footer, defeating wfr-10's "footer visible on every web route" acceptance for the InviteShell route. Fix: switched `<main>` on `web/app/join/[roomId]/page.tsx` to a flex child of the body column (`flex: 1; position: relative; min-height: 0`); body is already `display: flex; flex-direction: column; min-height: 100vh` with the Footer carrying `margin-top: auto`, so the gradient surface fills `<main>` and Privacy / Terms / Help render below it in the column. TDD: `web/app/join/[roomId]/page.test.tsx` asserts `<main>` is not `position: fixed`. 167 vitest tests green, typecheck clean, `node design-system/scripts/verify.mjs` green. No NameEntry-internal Help link was added — the issue body explicitly says "Folds into wfr-10 ... ensure the footer's Help link is visible on the InviteShell route", so this is the pointer/fold path.
