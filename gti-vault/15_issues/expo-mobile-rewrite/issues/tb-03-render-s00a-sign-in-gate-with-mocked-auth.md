---
status: ready-for-agent
type: AFK
github_issue: 328
---

# TB-03: Render S00a Sign-in Gate with mocked auth

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement the S00a Sign-in Gate behavior against mocked auth boundaries. The screen should render whenever the mobile auth state is not Linked-Apple, expose Sign in with Apple as the iOS entry action, and include the Account claim path before Apple sign-in. This slice proves the product auth model locally without real Apple runtime.

## Acceptance criteria

- [ ] The router sends idle or Anonymous session states to S00a.
- [ ] Linked-Apple session state bypasses S00a and routes to the signed-in landing placeholder.
- [ ] S00a renders Sign in with Apple as the only primary auth action.
- [ ] S00a includes the Account claim path before Apple sign-in.
- [ ] Tests cover idle, Anonymous, Linked-Apple, successful mocked Apple sign-in, claim-code success, and claim-code error behavior.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-02: Add explicit app-state router harness.

