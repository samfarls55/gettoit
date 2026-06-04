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

- [ ] History Plan rows can route to read-only verdict.
- [ ] Sealed or closed verdict contexts route to read-only verdict instead of live verdict.
- [ ] Read-only verdict suppresses reroll, ratify, countdown, and live-only actions.
- [ ] Read-only verdict preserves recommendation details and record copy.
- [ ] Tests cover History tap routing, sealed-context routing, and action suppression.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-13: Live verdict and solo verdict.

