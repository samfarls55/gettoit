---
status: ready-for-agent
type: AFK
github_issue: 340
---

# TB-14: No-survivor and reroll

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Add the no-survivor and reroll branches to the verdict path. The slice should render no-survivor when the engine cannot pick a winner, allow widening and re-running through a repository seam, and preserve reroll burn/window behavior for live verdicts.

## Acceptance criteria

- [x] Verdict dispatch can route to no-survivor when no winner exists.
- [x] No-survivor surface supports widen-and-rerun through a repository seam.
- [x] Live verdict supports reroll eligibility display and reroll action.
- [x] Reroll burn/window constraints are represented in the screen model.
- [x] Tests cover no-survivor dispatch, widen action, reroll eligible/ineligible states, and repository errors.
- [x] Typecheck and mobile tests pass.

## Blocked by

- TB-13: Live verdict and solo verdict.

## Completion note

2026-06-04: Expo mobile verdict path now uses a discriminated verdict model for `live` and `noSurvivor`. The no-survivor branch renders inline radius widening and calls the injected `widenAndRerun` repository seam. Live verdicts render reroll burn eligibility and call the injected `reroll` seam. Verified with `npm run verify --prefix mobile`; tests pass with existing non-failing React act warnings from async Quiz/Waiting hydration.

