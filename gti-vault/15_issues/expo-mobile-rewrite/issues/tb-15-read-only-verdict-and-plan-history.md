---
status: ready-for-agent
type: AFK
github_issue: 341
---

# TB-15: Read-only verdict and Plan history

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement read-only verdict behavior and Plan history routing. Closed verdicts should render as records, suppress live-only actions, and be reachable from History or sealed deep-link contexts through the app-state router.

## Acceptance criteria

- [x] History Plan rows can route to read-only verdict.
- [x] Sealed or closed verdict contexts route to read-only verdict instead of live verdict.
- [x] Read-only verdict suppresses reroll, ratify, countdown, and live-only actions.
- [x] Read-only verdict preserves recommendation details and record copy.
- [x] Tests cover History tap routing, sealed-context routing, and action suppression.
- [x] Typecheck and mobile tests pass.

## Implementation note

Completed 2026-06-04 on `sandcastle/issue-341`. Added an explicit Expo mobile read-only verdict route phase, routed History rows and decided invite links to that phase, preserved resolved deep-link room IDs before dispatch, and added read-only `VerdictScreen` rendering that keeps recommendation details/receipts while suppressing time badge, ratify/save, and reroll. `npm run verify --prefix mobile` passed with existing non-failing React `act(...)` warnings from async Quiz/Waiting hydration.

## Blocked by

- TB-13: Live verdict and solo verdict.

