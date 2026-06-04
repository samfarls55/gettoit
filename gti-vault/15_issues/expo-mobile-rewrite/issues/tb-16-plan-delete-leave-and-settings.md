---
status: ready-for-agent
type: AFK
github_issue: 342
---

# TB-16: Plan delete, leave, and Settings

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Complete destructive and account-management flows needed for parity: Plan delete, Plan exit/leave, session-ended feedback, Settings entry, sign-out/account delete seams, and post-action routing.

## Acceptance criteria

- [ ] Created Plan delete calls a repository seam and removes/routes the Plan appropriately.
- [ ] Active Room delete/end states produce session-ended feedback for affected surfaces.
- [ ] Plan exit/leave behavior is consistent across quiz and waiting contexts.
- [ ] Settings is reachable from the signed-in app and can return to Plan list.
- [ ] Account delete/sign-out behavior is represented through auth repository seams and routes back to S00a when appropriate.
- [ ] Tests cover delete confirm, leave/exit, session-ended feedback, Settings navigation, and account-delete route outcomes.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-12: Submit quiz and Waiting surface.

