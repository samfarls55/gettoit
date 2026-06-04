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

- [x] Created Plan delete calls a repository seam and removes/routes the Plan appropriately.
- [x] Active Room delete/end states produce session-ended feedback for affected surfaces.
- [x] Plan exit/leave behavior is consistent across quiz and waiting contexts.
- [x] Settings is reachable from the signed-in app and can return to Plan list.
- [x] Account delete/sign-out behavior is represented through auth repository seams and routes back to S00a when appropriate.
- [x] Tests cover delete confirm, leave/exit, session-ended feedback, Settings navigation, and account-delete route outcomes.
- [x] Typecheck and mobile tests pass.

## Completion notes

- 2026-06-04: Expo mobile Plan list now exposes Settings and Created Plan delete confirmation; delete calls the Plan repository seam and refreshes/removes the Plan locally.
- 2026-06-04: Expo mobile Settings now exposes close, delete-account confirmation, and sign-out seams; successful account delete/sign-out routes back to S00a.
- 2026-06-04: Existing Quiz exit/leave and Waiting session-ended paths were covered in the TB-16 App tests.
- Verification: `npm run verify --prefix mobile` passed with existing non-failing React act warnings from async Quiz/Waiting hydration.

## Blocked by

- TB-12: Submit quiz and Waiting surface.

