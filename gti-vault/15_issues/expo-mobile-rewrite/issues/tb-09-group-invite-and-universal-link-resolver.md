---
status: ready-for-agent
type: AFK
github_issue: 334
---

# TB-09: Group invite and Universal Link resolver

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Build the group invite and deep-link routing path with local simulation. The slice should generate/share invite links through an adapter, parse incoming links, and route cold/warm app state to the correct join, quiz, waiting, or verdict placeholder path. Real iOS Universal Link validation is deferred to native runtime parity.

## Acceptance criteria

- [ ] Group Plan launch can produce an invite link through a share/link adapter.
- [ ] Incoming invite URLs are parsed into typed deep-link payloads.
- [ ] The app-state router handles simulated cold and warm deep-link events.
- [ ] Resolver tests cover open, in-progress, waiting, decided, and invalid/stale link cases with fake data.
- [ ] Share and native link handling are boundary abstractions that can be faked locally.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-08: Setup create/edit Plan.

