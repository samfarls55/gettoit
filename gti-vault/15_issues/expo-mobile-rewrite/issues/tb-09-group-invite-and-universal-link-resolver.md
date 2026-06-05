---
status: implemented
type: AFK
github_issue: 334
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-09: Group invite and Universal Link resolver

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Build the group invite and deep-link routing path with local simulation. The slice should generate/share invite links through an adapter, parse incoming links, and route cold/warm app state to the correct join, quiz, waiting, or verdict placeholder path. Real iOS Universal Link validation is deferred to native runtime parity.

## Acceptance criteria

- [x] Group Plan launch can produce an invite link through a share/link adapter.
- [x] Incoming invite URLs are parsed into typed deep-link payloads.
- [x] The app-state router handles simulated cold and warm deep-link events.
- [x] Resolver tests cover open, in-progress, waiting, decided, and invalid/stale link cases with fake data.
- [x] Share and native link handling are boundary abstractions that can be faked locally.
- [x] Typecheck and mobile tests pass.

## Implementation notes

- Added a local invite-link parser/resolver for `https://.../join/:roomId` and `gettoit://join/:roomId`.
- Wired Expo app launch through fakeable invite/share and native-link boundaries.
- Added a `join` placeholder route plus resolver routing for join, quiz, waiting, and verdict states; invalid/stale links clear back to the Plan list.
- Verified with `npm run verify --prefix mobile`.

## Blocked by

- TB-08: Setup create/edit Plan.

