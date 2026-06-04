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

## Implementation notes

- Added a mobile Supabase auth repository in `mobile/src/auth/authRepository.ts` with Expo public env config (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), a Supabase JS client factory, and typed repository methods for session restore/current state, Apple sign-in, claim-code redemption, sign-out, and account delete.
- Kept Apple credential acquisition behind an injected `AppleCredentialProvider`; tests inject a fake provider and fake Supabase client so local Windows checks do not require native Apple runtime.
- Repository mapping treats missing Supabase session as `idle`, `user.is_anonymous !== false` as Anonymous, and `user.is_anonymous === false` as Linked-Apple.
- Claim-code redemption invokes `redeem-claim-code`, installs the returned refresh token with `auth.refreshSession`, and remains idle-only so the Account claim flow stays before Apple sign-in.
- Verification: `npm run typecheck` and `npm run test -- --runInBand` passed in `mobile/`.

