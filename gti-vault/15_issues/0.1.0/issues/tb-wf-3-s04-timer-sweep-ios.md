---

issue: tb-WF-3
title: S04 timer sweep â€” iOS port (retire TimerCoordinator)
status: done
type: AFK
feature: 0.1.0
github_issue: 162
created: 2026-05-19
closed: 2026-05-19
pr: 171
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-WF-3 â€” S04 timer sweep iOS port

## Parent


## What to build

End-to-end behavior delivered: the S04 Waiting surface on iOS no longer renders the `"Auto-fires in 7:42"` countdown mono-tag, never auto-fires the verdict on timer expiry, and the `TimerCoordinator` infrastructure is gone. The only verdict triggers remaining are (a) all-Q5-complete (engine-side auto-fire â€” already shipped via `tb-13`) and (b) the initiator's manual `Decide now` tap.

### iOS deletions

- **Delete:** `ios/Sources/App/TimerCoordinator.swift` and its tests, if any.
- **Delete:** any countdown timer rendering in `ios/Sources/App/WaitingScreen.swift` â€” the mono-tag countdown, the `"Auto-fires in 7:42"` copy, any `@State`/`@Observable` that ticks the countdown.
- **Delete:** the timer-expiry no-quorum edge case in `WaitingScreen.swift` (if present) â€” the "Couldn't reach quorum tonight" terminal that fires on timer expiry. The no-survivor terminal stays in place for the engine-side `no_survivor` resolution path (separate concern, leave alone).
- **Delete:** any iOS S01 timer chip group code â€” `ios/Sources/App/InitiatorScreen.swift`'s timer chip rendering, if present in isolation from the radius slider. (The full S01/S01b retirement is in tb-WF-4; this issue removes only the timer-related artifacts since they're explicitly retired by 0.1.0 PRD.)

### iOS code that stays

- The initiator's `Decide now` CTA on S04 stays â€” it's one of the two surviving verdict triggers per the 0.1.0 PRD.
- The avatar row, the "N of M are in" headline, the nudge CTA, the Decide-now CTA, the C-22 AuthUpgradeChip, the web-anonymous "Download the app" CTA â€” all stay.
- Any room-fire dispatch logic that fires on the `votes.q5_complete` quorum signal stays.

### Schema cleanup

- `rooms.timer_minutes` and `rooms.deadline_at` columns: **leave in place** for this issue. Additive removal is a separate slice (the columns can stay unused without breaking anything; cleanup is low-priority). Document the unused state alongside any other schema-cleanup tasks in [[../_index|the workflow-overhaul _index]].
- The cron job / Postgres trigger that fired on `now() >= rooms.deadline_at`: **remove**. With `TimerCoordinator` gone there's no client to set `deadline_at` for new rooms, and the cron has no work to do â€” but if it still exists it's a dangling reference. Disable the cron, drop the trigger if present, leave the columns.

### Tests

- Update `WaitingScreenTests` (or equivalent) to remove any expectation that the countdown renders or that the timer fires the verdict.
- Add (or confirm) a regression test that S04 *never* fires the verdict from a client-side timer â€” only from `votes.q5_complete` or initiator-tap.
- `ios` CI lane stays green; no new failing tests introduced.

## Acceptance criteria

- [ ] `TimerCoordinator.swift` is deleted from `ios/Sources/App/`.
- [ ] `WaitingScreen.swift` no longer renders the countdown mono-tag, the `"Auto-fires"` copy, or any timer-tick state.
- [ ] The timer-expiry no-quorum edge case is removed from `WaitingScreen.swift` (the no-survivor terminal stays in place for engine-side `no_survivor`).
- [ ] S01's timer chip group rendering is removed (if isolable from the radius slider's code path; otherwise call out the coupling and defer to tb-WF-4).
- [ ] The cron/trigger that fired on `deadline_at` is removed/disabled.
- [ ] `rooms.timer_minutes` and `rooms.deadline_at` columns are left in place (with a note in the _index that they're now unused â€” separate cleanup later).
- [ ] Existing iOS tests are updated to remove timer-related expectations; no new failures.
- [ ] `ios` CI lane is green.

## Blocked by


## Comments

- 2026-05-19 â€” Closed by [PR #171](https://github.com/samfarls55/gettoit/pull/171). `TimerCoordinator.swift` + its tests deleted; the manual-fire half was extracted to a new `FireVerdictCoordinator` so the Decide-now CTA can still call `fire_verdict(room_id)`. `WaitingScreen.swift` lost its 1Hz tick state, the `countdownLabel` view, the `accessibilityReduceMotion` env reader, and the timer-expiry no-quorum terminal. CTA is now always tappable for the initiator (min quorum = 1). `InitiatorScreen.swift` lost the timer chip group rendering; the `timerMinutes` State + downstream `createRoom` call stay at the default (10) so `rooms.timer_minutes` keeps its legacy value until the additive column drop. New migration `20260519010000000_drop_v1_timer_orphans.sql` drops the orphan `cron_auto_fire_or_expire()` worker + the 1-arg `dispatch_compute_verdict(uuid)` overload. New regression test `WaitingScreenTimerSweepRegressionTests.testHoldingTheSurfaceNeverFiresTheVerdictFromAClientTimer` locks the invariant. Schema columns `rooms.timer_minutes` and `rooms.deadline_at` left in place per spec; documented in the workflow-overhaul `_index.md` under "Schema cleanup follow-ups".
