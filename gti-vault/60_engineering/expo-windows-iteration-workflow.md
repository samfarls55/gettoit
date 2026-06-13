---
status: approved
---

# Expo Windows iteration workflow

Use EAS builds as native-runtime checkpoints, not as the normal UI iteration
loop. A feature change should usually consume zero iOS builds.

## Lanes

1. Web smoke on laptop

   Use for UI layout, navigation, Supabase reads/writes, plan/quiz/verdict
   workflows, and regression checks.

   ```powershell
   cd C:\development\gettoit\mobile
   $env:EXPO_PUBLIC_ENABLE_WEB_DEV_LOGIN = "1"
   npx expo start --web
   ```

2. Expo Go on device

   Use when the current Expo Go version supports this project's SDK. This gives
   real touch/device behavior and Metro reloads without consuming EAS builds.
   The active app is Expo SDK 56.

   ```powershell
   cd C:\development\gettoit\mobile
   npx expo start
   ```

   If iOS Expo Go App Store availability lags the SDK, use Expo's SDK-specific
   Expo Go/TestFlight path (`eas go`) rather than changing app code to fit an
   older client.

3. Development build

   Use once Expo Go is no longer enough, or when native config/dependencies need
   verification. A dev build costs an EAS build only when the native runtime
   changes. After it is installed, daily JavaScript changes reload from local
   Metro.

   ```powershell
   cd C:\development\gettoit\mobile
   npx expo start --dev-client
   ```

4. EAS Update preview

   Use to send JavaScript/style/asset fixes to an installed preview/TestFlight
   binary without creating a new binary. Do not use for native dependency,
   plugin, entitlement, SDK, or app config changes.

5. Production/TestFlight build

   Use for native-runtime changes, release candidates, Apple entitlement checks,
   TestFlight launch checks, and App Store validation.

## Build trigger rule

No EAS build is needed for TypeScript, React component, style, copy, navigation,
repository, Supabase query, or asset changes that stay within the existing
native runtime.

Create a new EAS build for app config changes, Expo SDK upgrades, native
dependency changes, plugin changes, entitlements, deep-link associated domains,
or anything that must prove the App Store/TestFlight binary path.

## Budget rule

Default to Expo Free while builds remain under quota. Use Expo Starter only when
queue time or build quota becomes the bottleneck. Do not keep a monthly cloud Mac
for this workflow; rent one only for an exceptional native debugging session.
