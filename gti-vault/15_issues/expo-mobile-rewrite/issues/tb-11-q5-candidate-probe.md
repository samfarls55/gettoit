---
status: ready-for-agent
type: AFK
github_issue: 337
---

# TB-11: Q5 candidate probe

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement Q5 candidate loading and the preference probe. The slice should port the factorial card generation behavior into testable TypeScript, never show fictitious venues, and render the Q5 no-results path when usable cards cannot be produced.

## Acceptance criteria

- [ ] Q5 loads real candidate data through a repository/loader interface.
- [ ] Q5 factorial card generation is implemented as a pure, tested module.
- [ ] Q5 renders candidate cards when a valid probe can be generated.
- [ ] Q5 renders no-results behavior when the candidate pool cannot produce usable cards.
- [ ] Tests cover generated card invariants, empty/invalid pools, and no fictitious venue behavior.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-10: Quiz Q1-Q4 flow.

