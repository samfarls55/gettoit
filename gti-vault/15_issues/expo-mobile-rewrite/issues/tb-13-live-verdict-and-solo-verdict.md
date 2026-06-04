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

- [ ] Verdict repository maps a successful verdict response into a typed live verdict view model.
- [ ] Group live verdict renders recommendation details, receipts, and live actions.
- [ ] Solo verdict suppresses group-only behavior and uses solo-specific copy/actions.
- [ ] Post-quiz routing lands on the correct verdict flavor based on session context.
- [ ] Tests cover repository mapping, group verdict rendering, solo verdict rendering, and route dispatch.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-12: Submit quiz and Waiting surface.

