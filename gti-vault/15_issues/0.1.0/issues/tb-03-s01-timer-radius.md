---
issue: tb-03
title: S01 timer chip + radius slider controls
github_issue: 4
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-13
prd: 0.1.0-prd
implements_spec_gap: 01-s01-timer-radius-controls
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-03 â€” S01 timer chip + radius slider

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

Land the initiator-set timer and radius controls on the S01 Initiator Landing surface. The values are written to the `rooms` row on session create and consumed downstream by the verdict-fire trigger (TB-07) and the candidate-pool fetch (TB-05).

This is the implementation of [[01-s01-timer-radius-controls|spec-gap issue 01]] â€” the design-system surface doc update + JSX + Swift port + schema column add.

- **Schema add** â€” extend `rooms` with `timer_minutes int default 10` and `radius_meters int default 3219` (â‰ˆ 2 mi). Migration must be additive over TB-02's `rooms` migration.
- **Design-system spec update** â€” apply the changes described in [[01-s01-timer-radius-controls|spec-gap 01]]: update `surfaces/01-initiator.md` to document the timer chip + radius slider and the spec exception against "no optional fields." Update `code/screens/ScreenInitiator.jsx` to render both controls with canonical defaults. If a new `C-21 Â· Range Slider` component is introduced, add to `components.md` and `code/components.jsx`. Update `tokens.json` only if new tokens are needed (no inline hex). Run `node design-system/scripts/verify.mjs`. Append to `CHANGELOG.md`.
- **iOS port** â€” update the S01 SwiftUI view in `ios/` to render the timer chip group (`5 Â· 10 Â· 15 Â· 30` minutes, single-select, default 10) and the radius slider (0.5â€“5 mi, step 0.5, default 2.0). Both values are passed to the room-create call and written to `rooms.timer_minutes` and `rooms.radius_meters`.
- **Tap-target conformance** â€” radius slider thumb sized for â‰¥44pt tap; timer chips at the existing `C-04` height (48). Document any adjustments in `accessibility.md`.

## Acceptance criteria

- [x] `rooms.timer_minutes` and `rooms.radius_meters` columns exist with the documented defaults. _(2026-05-13)_
- [x] All [[01-s01-timer-radius-controls|spec-gap 01]] acceptance criteria pass. _(2026-05-13)_
- [x] iOS S01 SwiftUI view renders the timer chip + radius slider with the canonical defaults. _(2026-05-13)_
- [x] Selecting non-default values writes them to the `rooms` row on session create. _(2026-05-13)_
- [x] `node design-system/scripts/verify.mjs` passes. _(2026-05-13)_
- [x] Integration tests: default values persist; non-default selections persist; values round-trip through the Supabase write. _(2026-05-13)_

## Blocked by

- [[tb-02-room-create-deeplink-join|TB-02]] _(satisfied)_

## Comments

### 2026-05-13 â€” Landed (PR #27)

Landed in [PR #27](https://github.com/samfarls55/gettoit/pull/27). Agent paused mid-task waiting for a CI notification that never came; orchestrator picked up the pending CI failure and applied a one-line `@MainActor` hoist fix:

- **`@MainActor` propagation in tests.** `InitiatorScreen` is `@MainActor`-annotated, which propagates to its static helpers `metersFromMiles` and `formatRadiusLabel`. The new `InitiatorScreenTests` class was nonisolated, so every call site errored with "call to main actor-isolated static method ... in a synchronous nonisolated context". Same pattern documented in `gti-vault/60_engineering/stack-patterns.md` from TB-02 â€” annotating the test class `@MainActor` lets all tests inherit the isolation. Five CI lanes green after the fix.
