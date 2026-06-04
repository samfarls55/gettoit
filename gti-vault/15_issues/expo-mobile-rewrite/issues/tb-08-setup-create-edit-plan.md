---
status: ready-for-agent
type: AFK
github_issue: 333
---

# TB-08: Setup create/edit Plan

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement Setup create/edit behavior for solo and group Plans. The slice should connect Plan list create/edit entry points to a Setup state model, Search area picker contract, session Parameters, launch guards, and repository writes.

## Acceptance criteria

- [ ] Plan list create actions route to Setup in solo or group mode.
- [ ] Pending Plan edit routes hydrate Setup from the selected Plan.
- [ ] Setup captures Plan name, participant scope, Search area, and session Parameters needed for launch.
- [ ] Launch is blocked until required Search area data is committed.
- [ ] Plan create/edit writes go through a typed repository interface with fakes in tests.
- [ ] Tests cover create, edit, missing Search area guard, successful save, and route outcomes.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-06: Plan repository direct Supabase read model.
- TB-07: Search area picker feasibility build.

