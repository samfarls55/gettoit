---
issue: bug-05
title: Info.plist missing NSLocationWhenInUseUsageDescription — ITMS-90683 on build 125
github_issue: null  # exception: ITMS warning fixed in-branch same day before any agent dispatch — no GH mirror filed; documented here per vault audit 2026-05-25
status: fixed-in-branch
type: AFK
created: 2026-05-14
prd: 0.1.0-prd
---

# bug-05 — Info.plist missing location purpose string

## Parent

[[../_index|0.1.0 backlog]]. Captured from Apple Developer Relations email received 2026-05-14 after the build 125 upload (TestFlight delivery succeeded but Apple flagged ITMS-90683).

## What's broken

App Store Connect ingest emitted ITMS-90683 against version 0.1.0 build 125:

> The Info.plist file for the "GetToIt.app" bundle should contain a NSLocationWhenInUseUsageDescription key with a user-facing purpose string explaining clearly and completely why your app needs the data.

Root cause: `ios/Sources/App/PlacesService.swift:13` and `ios/Sources/App/MapKitPlacesFallback.swift:21` both `import CoreLocation`. Apple's static binary scan flags the API reference at ingest regardless of whether the runtime path is actually exercised — the purpose string is mandatory whenever the symbol is linked. The sg-04 flow lets a denied user pick a place manually, so the surface S00b pre-prime is "soft", but the underlying CoreLocation linkage is unconditional.

Delivery was not blocked (Apple labels this a warning, not a rejection). Left as-is, the next ingest will continue to warn and the iOS system dialog at runtime would show a generic fallback string, breaking continuity with the S00b pre-prime voice.

## Fix scope

Single-key Info.plist addition, plus close the design-system spec gap that allowed the omission in the first place.

- Add `NSLocationWhenInUseUsageDescription` to `ios/project.yml` `info.properties`. Info.plist is XcodeGen-generated from this YAML, so hand-editing `Sources/App/Info.plist` would not survive the next regenerate.
- Register the locked copy in `design-system/surfaces/00b-location-permission.md` under "Copy register" so the string is part of the spec, not buried in build config.
- Append a `CHANGELOG.md` entry referencing this issue.

Locked copy (matches the S00b body register verbatim for surface continuity): `"So we can line up restaurants close enough to walk to, instead of asking your neighborhood every time."`

## Acceptance criteria

- [x] `ios/project.yml` declares `NSLocationWhenInUseUsageDescription` with the locked string.
- [x] `design-system/surfaces/00b-location-permission.md` Copy register includes the system-dialog purpose string entry.
- [x] `design-system/CHANGELOG.md` entry referencing this issue.
- [ ] Next TestFlight upload (build > 125) does not emit ITMS-90683.
- [ ] On a real iOS device with permission state `notDetermined`, tapping the S00b primary CTA shows the system dialog with the locked string verbatim.

## Blocked by

None — the surface S00b spec already exists from sg-04. This bug only closes the plist-side omission.

## Adjacencies

- No other CoreLocation-adjacent permission keys are needed: the app does not background, does not request "Always" authorization, and does not access bluetooth / motion / camera / mic / contacts. Verified by grep of iOS sources on 2026-05-14.
- If a future surface adds background location, photo library, or any other gated capability, the same plist-key-plus-S00b-style-spec pattern applies. Don't repeat this gap.
- **TB-03 hand-edit superseded.** TB-03's PR landed a different `NSLocationWhenInUseUsageDescription` string directly in `ios/Sources/App/Info.plist` (`"GetToIt uses your location to line up restaurants close enough to walk to. Sharing is optional — you can type a place in instead."`) without registering it in the design-system spec and without touching `ios/project.yml`. bug-05 overrides that string with the locked option-A copy, makes `ios/project.yml` the canonical source (per the existing XcodeGen pattern for every other Info.plist key), and adds the registration the original PR skipped. No regression — TB-03 shipped *after* build 125, so its string never reached an uploaded build.
