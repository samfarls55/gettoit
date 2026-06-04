---
status: ready-for-agent
type: AFK
github_issue: 329
---

# TB-04: Wire Supabase auth repository

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Wire the mobile auth repository to Supabase JS using the same project URL and anon-key model as the existing app, adapted to Expo public environment variables. Keep Apple credential acquisition behind a native boundary so local tests can inject mocked Apple tokens while the repository exercises the real session and state transitions.

## Acceptance criteria

- [ ] Mobile config reads Supabase project URL and anon key from Expo-compatible environment variables.
- [ ] Auth repository exposes session restore, current auth state, mocked Apple sign-in handoff, claim-code redemption handoff, and sign-out/account-delete hooks needed by later slices.
- [ ] The repository maps Supabase session/user identity into idle, Anonymous, and Linked-Apple app auth states.
- [ ] Apple credential acquisition remains an injected native boundary and is not required for Windows-local tests.
- [ ] Tests cover repository mapping and error behavior with fakes/mocks.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-03: Render S00a Sign-in Gate with mocked auth.

