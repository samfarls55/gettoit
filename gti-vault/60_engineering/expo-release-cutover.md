---
status: approved
github_issue: 336
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Expo release cutover

TB-18 swaps active iOS release ownership from the retired SwiftUI app in `ios/` to the Expo managed app in `mobile/`.

## Active release path

- Active iOS client: `mobile/`
- Release tool: Expo EAS
- TestFlight/App Store continuity bundle id: `app.gettoit.GetToIt`
- Marketing version: `0.1.0`
- Apple team: `WXTMNYM34A`
- App Store Connect app id: `6769440299`
- Universal Links entitlement: `applinks:gettoit.app`

## TestFlight shipping workflow

Active TestFlight shipping is owned by `.github/workflows/testflight.yml`.

- Trigger: manual `workflow_dispatch`.
- Codex command: `/ship`, backed by `.codex/commands/ship.md` and `scripts/ship-testflight.ps1`.
- Default ref: `main`; explicit branch, tag, or SHA override is allowed.
- EAS profile: `production`.
- Submit mode: defaults to TestFlight submit; build-only is available for CI shakedown.
- Required GitHub secret: `EXPO_TOKEN`.
- Required GitHub Environment: `testflight`, with required reviewer approval.

The workflow checks out the requested ref, installs `mobile/` dependencies, runs `npm run verify`, then runs `eas build` for iOS with `--wait` and JSON summary output. When submit mode is true, it uses EAS auto-submit with the production submit profile. Optional `/ship` notes are recorded in the GitHub run summary, not forwarded to EAS/TestFlight; EAS currently treats that field as an Enterprise-plan-only changelog parameter for this account.

## Build number source of truth

As of June 10, 2026, TestFlight build numbers are owned by EAS remote versioning, not `mobile/app.json`.

- `mobile/eas.json` must keep `cli.appVersionSource` set to `remote`.
- `mobile/eas.json` keeps `build.production.autoIncrement: true`.
- `mobile/app.json` must not define `expo.ios.buildNumber`.
- `.github/workflows/testflight.yml` fails before creating an EAS build if these invariants regress.

Reason: local build numbers repeatedly drifted behind App Store Connect. A committed `buildNumber` of `1004` produced CI builds that auto-incremented only inside the runner to `1005`, colliding with an already-uploaded TestFlight build. EAS remote versioning makes the EAS server the durable counter so repeated CI dispatches keep incrementing.

## Build 1012 native map hotfix

On June 12, 2026, App Store Connect accepted build `1012` but sent ITMS-90863 for Apple silicon Mac support, listing missing `ExpoModulesCore` Swift symbols. Build `1012` was built from `c13d8d1` and was the first submitted build after `6e160f4`, which introduced `expo-maps`.

Working diagnosis: `expo-maps` added an Apple native SwiftUI/MapKit module that depends on `ExpoModulesCore`, correlating with both the Apple silicon Mac symbol warning and the reported mobile launch crash. The EAS production environment for build `1012` did include `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, so the launch crash was not explained by missing Supabase public env vars.

Hotfix direction: remove `expo-maps` from the production binary, keep the existing non-native search-area preview, keep `expo-location` geocoding/current-location support, and update Expo SDK 56 patch dependencies so `expo-doctor` and `expo install --check` pass before uploading the next binary.

## Manual fallback commands

Run from `mobile/`:

```sh
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

If EAS asks to manage Apple credentials, choose automatic credential management for `app.gettoit.GetToIt` on team `WXTMNYM34A`.

## Agent-verifiable configuration

- `mobile/app.json` carries bundle id `app.gettoit.GetToIt`, Apple Sign-In, associated domain `applinks:gettoit.app`, location usage copy, and EAS project id. It intentionally does not carry `expo.ios.buildNumber`.
- `mobile/eas.json` uses a production store build profile, remote app version source, auto-incremented build numbers, and App Store Connect app id `6769440299`.
- `.github/workflows/ci.yml` verifies the active Expo mobile app with `npm run verify` in `mobile/`.
- `.github/workflows/ci.yml` disables the legacy Swift `ios` and Swift TestFlight jobs; old Swift release upload is no longer an active CI path.

## Legacy Swift status

`ios/` is retired as active product scope and kept as legacy reference only. Do not add new product work or ship Swift TestFlight builds unless a human explicitly reopens the Swift path for an emergency.

## TB-17 handoff

TB-17 closed native runtime parity on June 5, 2026:

- EAS production iOS build `1003` succeeded.
- Build `1003` was submitted to App Store Connect/TestFlight.
- Founder confirmed build `1003` opens on device and Apple account creation works.
- Remaining native runtime gaps were accepted as residual risk for later Expo rewrite work, not blockers for TB-17.

Accepted residual risks from TB-17:

- APNs/push has no Expo runtime implementation wired yet.
- Search area still uses the deterministic preview surface in code.
- Account claim, Universal Links, location prompt, share sheet, lifecycle, and Settings/account flows need deeper device sweeps in later Expo rewrite work.

## Founder approval

Founder approved all TB-18 HITL gates on June 5, 2026:

- Cutover timing is approved as June 5, 2026.
- `ios/` SwiftUI is retired as active product scope and kept only as legacy reference.
- Expo TestFlight build `1003` is accepted as the installable build for TB-18 closure.

Founder noted there are multiple issues with TB-18, to be addressed after closure as follow-up work.
