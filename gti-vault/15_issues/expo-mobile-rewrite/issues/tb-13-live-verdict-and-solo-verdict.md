---
status: ready-for-agent
type: AFK
github_issue: 339
---

# TB-13: Live verdict and solo verdict

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement live verdict rendering and solo verdict behavior. The slice should map verdict repository data into the live verdict screen model, dispatch the solo flavor correctly, and preserve group-specific receipts/actions only where appropriate.

## Acceptance criteria

- [x] Verdict repository maps a successful verdict response into a typed live verdict view model.
- [x] Group live verdict renders recommendation details, receipts, and live actions.
- [x] Solo verdict suppresses group-only behavior and uses solo-specific copy/actions.
- [x] Post-quiz routing lands on the correct verdict flavor based on session context.
- [x] Tests cover repository mapping, group verdict rendering, solo verdict rendering, and route dispatch.
- [x] Typecheck and mobile tests pass.

## Implementation note

Completed 2026-06-04 on `sandcastle/issue-339`. Added the Expo mobile live verdict repository seam, the live verdict screen, group/solo flavor dispatch from the active quiz session, and focused repository/screen/App route tests. `npm run verify --prefix mobile` passed with the existing non-failing React `act(...)` warnings from async Quiz/Waiting hydration.

## Blocked by

- TB-12: Submit quiz and Waiting surface.

