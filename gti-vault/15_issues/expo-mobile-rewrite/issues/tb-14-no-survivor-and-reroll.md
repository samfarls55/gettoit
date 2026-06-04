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

- [ ] Verdict dispatch can route to no-survivor when no winner exists.
- [ ] No-survivor surface supports widen-and-rerun through a repository seam.
- [ ] Live verdict supports reroll eligibility display and reroll action.
- [ ] Reroll burn/window constraints are represented in the screen model.
- [ ] Tests cover no-survivor dispatch, widen action, reroll eligible/ineligible states, and repository errors.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-13: Live verdict and solo verdict.

