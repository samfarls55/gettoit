# GetToIt Mobile

Active iOS client. Expo managed React Native + TypeScript app.

## Status

`mobile/` replaces the legacy SwiftUI app under `ios/` as the active iOS product path. New mobile product work goes here.

The App Store/TestFlight bundle identity remains:

- Bundle identifier: `app.gettoit.GetToIt`
- Marketing version: `0.1.0`
- Apple team: `WXTMNYM34A`
- App Store Connect app id: `6769440299`
- Universal Links domain: `applinks:gettoit.app`

## Local Checks

```sh
npm run typecheck --prefix mobile
npm test --prefix mobile
npm run verify --prefix mobile
```

Root aliases:

```sh
npm run mobile:typecheck
npm run mobile:test
npm run mobile:verify
```

## Dev Preview

Expo web is a development-only preview target for mobile surfaces. It does not replace the Next.js web fallback in `web/`.

```sh
npm run web --prefix mobile
```

## EAS TestFlight Release

Run from `mobile/` after the release branch is ready:

```sh
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

`mobile/app.json` owns the iOS bundle id, build number, Apple Sign-In capability, associated domains, and iOS usage strings. `mobile/eas.json` owns the production store build profile and App Store Connect app id.

If EAS asks to manage Apple credentials, choose automatic credential management for `app.gettoit.GetToIt` on team `WXTMNYM34A`.

## Legacy Swift App

`ios/` is frozen and retired as active product scope. Do not ship Swift TestFlight builds for product release unless a human explicitly reopens the legacy path for an emergency.
