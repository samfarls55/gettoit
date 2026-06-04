---
status: ready-for-agent
type: AFK
github_issue: 335
---

# TB-10: Quiz Q1-Q4 flow

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement the quiz flow through Q1-Q4 with local state, progress persistence seams, Plan back, and Plan exit/leave behavior. The slice should focus on testable quiz navigation and answer state before Q5 candidate work.

## Acceptance criteria

- [ ] Starting or joining a Room can route into Quiz at Q1.
- [ ] Q1-Q4 screens capture and preserve answers in the quiz state model.
- [ ] Plan back moves to the prior question with prior answers preserved.
- [ ] Plan exit/leave routes out through a repository seam and returns to the expected destination.
- [ ] Progress persistence is an injected dependency and can be faked in tests.
- [ ] Tests cover forward navigation, back navigation, answer preservation, exit/leave, and resume state.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-08: Setup create/edit Plan.

