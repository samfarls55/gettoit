---
status: done
github_issue: 343
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Expo native runtime parity

## Scope

TB-17 verifies the native iOS runtime pieces that Windows-local mobile tests cannot prove. The Expo app replaces the Swift app outright, so the production bundle identity is `app.gettoit.GetToIt`; no side-by-side install constraint remains.

## Build path

- EAS production iOS build from `mobile/`.
- Bundle identifier: `app.gettoit.GetToIt`.
- Marketing version: `0.1.0`.
- Starting build number: `1000`, to avoid colliding with earlier Swift TestFlight builds for the same marketing version.
- Universal Links domain: `applinks:gettoit.app`.
- Apple team: `WXTMNYM34A`.

## Agent checks

- [x] Mobile local verification passed before TB-17 edits: `npm run mobile:verify` on 2026-06-05.
- [x] Mobile local verification passed after TB-17 edits: `npm run mobile:verify` on 2026-06-05.
- [x] Production bundle check passed: `npx expo export:embed --eager --platform ios --dev false` on 2026-06-05.
- [x] EAS config exists for store/TestFlight build.
- [x] Expo app config carries production bundle id, Apple Sign-In capability, Universal Links domain, and location usage copy.
- [x] Runtime Apple Sign-In boundary uses native `expo-apple-authentication`.
- [x] Runtime link/share boundaries use iOS Linking and Share APIs.
- [x] EAS production iOS build succeeded for build `1002`: `https://expo.dev/accounts/sfarls/projects/gettoit-mobile/builds/a2c7d5aa-b7a3-4646-9369-5c28a7e161ab`.
- [x] EAS submitted build `1002` to App Store Connect/TestFlight: `https://expo.dev/accounts/sfarls/projects/gettoit-mobile/submissions/000ab671-9d75-4cd2-b78b-fa7bb350431d`.
- [x] Diagnosed build `1002` Apple Sign-In device failure on 2026-06-05: the IPA had the Apple Sign-In entitlement, but its JS bundle did not inline the Supabase URL because config read `process?.env?.EXPO_PUBLIC_*` instead of direct `process.env.EXPO_PUBLIC_*`.
- [x] Fixed Supabase public env bundling in `mobile/src/auth/authRepository.ts` and verified an iOS production bundle contains the Supabase URL literal.
- [x] Mobile local verification passed after Apple Sign-In fix: `npm run mobile:verify` on 2026-06-05.
- [x] EAS production iOS build succeeded for build `1003`: `https://expo.dev/accounts/sfarls/projects/gettoit-mobile/builds/935e2e91-46a8-406e-9ffc-957f5cdc3d9b`.
- [x] Inspected build `1003` IPA: provisioning profile includes `com.apple.developer.applesignin`; JS bundle includes the Supabase URL literal.
- [x] EAS submitted build `1003` to App Store Connect/TestFlight: `https://expo.dev/accounts/sfarls/projects/gettoit-mobile/submissions/02f7e6f1-3b95-4099-aef2-a517f0d1f981`.

## Build notes

- First EAS build `1001` failed in Metro because `mobile/` was uploaded as the project root and the app imported `../../../design-system/tokens.json`. Fixed by bundling the mobile-used token snapshot inside `mobile/src/design/`.
- Local production bundling then exposed Supabase Realtime's Node `ws` fallback import. Fixed by making Metro prefer package ESM and stubbing the unreachable Node `ws` fallback for React Native.
- EAS production env now has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` copied from the repo Supabase public config, so TestFlight builds do not launch into missing-env errors.
- `mobile/eas.json` records App Store Connect app id `6769440299`, so future production submits can run non-interactively after a successful build.
- App Store Connect API key is EAS-managed: `[Expo] EAS Submit 0HzlJc-8Qf`, key id `8V755S87PA`, role App Manager.
- Build `1002` still launched to S00a because `restoreSession` swallows missing Supabase env and returns idle, but tapping Apple Sign-In constructed the Supabase client before the native Apple sheet and threw the missing-env error behind the generic `"Couldn't reach Apple. Try again."` UI.
- Build `1003` is the first TestFlight build with the env-inline fix.

## Closure note

2026-06-05 founder closure: build `1003` can be opened on device and Apple account creation works. Founder accepts that the app still needs product/runtime work and explicitly requested TB-17 close. Remaining checklist items below are accepted residual risks for later Expo rewrite work, not blockers for TB-17.

## Human checklist

Record device, iOS version, build number, and pass/fail notes for each item.

| Check | Expected result | Result |
| --- | --- | --- |
| Install/update | TestFlight installs Expo build for `app.gettoit.GetToIt`; opening app shows S00a or restored signed-in state. | Pass on build `1003`: founder can open app. |
| Apple auth | Tapping "Sign in with Apple" opens Apple's native sheet and returns to app as Linked-Apple. | Pass on build `1003`: founder can create an account. |
| Account claim | "Voted on the web?" accepts a valid claim code before Apple sign-in and preserves the claimed session through Apple sign-in. | Accepted residual risk; not blocking TB-17 close. |
| Universal Link cold launch | `https://gettoit.app/join/<room>` opens app from killed state and routes through invite resolver. | Accepted residual risk; not blocking TB-17 close. |
| Universal Link warm launch | Same link opens/reroutes while app is already foreground/background. | Accepted residual risk; not blocking TB-17 close. |
| Location prompt | Search area current-location action triggers iOS location prompt with approved copy. | Accepted residual risk; not blocking TB-17 close. |
| Search area/map feel | Search area editor supports current location, typed place jump, radius controls, and preview pins at native speed/feel. | Accepted residual risk; deterministic preview remains known gap. |
| Share sheet | Group Plan launch opens iOS share sheet with `https://gettoit.app/join/<room>`. | Accepted residual risk; not blocking TB-17 close. |
| Push/APNs | App can register for push/APNs or this gap is marked unresolved with a follow-up issue. | Accepted residual risk; Expo push/APNs remains unwired. |
| Lifecycle | Background/foreground, cold launch, and auth restore do not lose active route or session. | Accepted residual risk; not blocking TB-17 close. |
| Settings/account | Sign-out and account delete return to S00a without stuck state. | Accepted residual risk; not blocking TB-17 close. |

## Human commands

Run from `mobile/` after repo changes are merged or checked out:

```sh
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

If EAS asks to manage Apple credentials, choose automatic credential management for `app.gettoit.GetToIt` on team `WXTMNYM34A`.

## Accepted residual risks

- APNs/push has no Expo runtime implementation wired yet.
- Search area still uses the deterministic preview surface in code.
- Account claim, Universal Links, location prompt, share sheet, lifecycle, and Settings/account flows need deeper device sweeps in later Expo rewrite work.
