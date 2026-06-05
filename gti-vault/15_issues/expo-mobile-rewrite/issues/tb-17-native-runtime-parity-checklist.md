---
status: done
type: HITL
github_issue: 343
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-17: Native runtime parity checklist

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Prepare and run the native iOS runtime parity gate for the Expo app. This slice verifies the things Windows-local tests cannot prove: Apple auth, Universal Links, iOS location prompts and map feel, share sheet, push/APNs, app lifecycle, and EAS/dev-build/TestFlight installation.

## Runtime checklist

- [[../../../60_engineering/expo-native-runtime-parity|Expo native runtime parity]]

## Acceptance criteria

- [x] A native runtime parity checklist exists and covers Apple auth, Account claim, Universal Links, location/Search area, share sheet, push, lifecycle, and install/update flows.
- [x] EAS/dev build or TestFlight path can produce an installable iOS build.
- [x] Human/device validation results are recorded in the issue or linked vault notes. _(2026-06-05 founder confirmed build `1003` opens and Apple account creation works; remaining runtime work accepted as residual risk.)_
- [x] Any native-only defects discovered are filed as follow-up issues or fixed within this slice if small. _(Build `1002` Apple Sign-In failure fixed in build `1003`; see linked parity note.)_
- [x] The mobile local test suite still passes after native validation changes. _(`npm run mobile:verify`, 91/91 passing on 2026-06-05.)_
- [x] The slice clearly marks which runtime checks remain unresolved, if any. _(Linked parity note marks build `1003` device retest, APNs/push, and Search area native feel as unresolved until human run.)_

## Blocked by

- TB-04: Wire Supabase auth repository.
- TB-09: Group invite and Universal Link resolver.
- TB-16: Plan delete, leave, and Settings.
