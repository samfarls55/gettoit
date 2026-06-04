---
status: ready-for-agent
type: AFK
github_issue: 330
---

# TB-05: Plan list landing with fake repository

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Build the Plan list landing surface against a fake Plan repository. The surface should cover empty and populated states and model Created, Joined, Decided, and History buckets enough for routing and visual inspection in Expo web.

## Acceptance criteria

- [ ] Linked-Apple auth routes to Plan list.
- [ ] Empty Plan list renders a clear create-Plan entry path.
- [ ] Populated Plan list renders Created, Joined, Decided, and History rows from a fake repository.
- [ ] Row taps route to the correct placeholder destination for pending, joined, decided, and history states.
- [ ] Tests cover grouping, empty state, populated state, and tap routing behavior.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-03: Render S00a Sign-in Gate with mocked auth.

