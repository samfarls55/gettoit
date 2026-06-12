---
status: done
type: AFK
github_issue: 327
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-02: Add explicit app-state router harness

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Add the tested app-state router that will own mobile product navigation. The router should model the core precedence chain in a reducer/state-machine style so auth, deep-link, active quiz, waiting, verdict, settings, setup, and Plan list routing can be tested without iOS runtime.

## Acceptance criteria

- [ ] A central app-state router exists and is used by the mobile app shell.
- [ ] Router state distinguishes at least sign-in gate, Plan list, Setup placeholder, quiz placeholder, waiting placeholder, verdict placeholder, settings placeholder, and deep-link placeholder routes.
- [ ] Tests cover route outcomes for representative auth and deep-link events.
- [ ] Routing tests assert user-visible route outcomes, not reducer implementation details.
- [ ] The placeholder app still renders in Expo web through the router.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-01: Scaffold Expo mobile dev loop.

