---
issue: bug-13
title: compute-verdict wedges the room on an empty candidate pool instead of writing a terminal no-survivor verdict
status: done
type: AFK
github_issue: 143
created: 2026-05-19
prd: 0.1.0-quiz-redesign-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-13 â€” Engine wedges the room on an empty candidate pool

## Parent

[[../_index|0.1.0 backlog]] â€” found during the 2026-05-19 verdict-spinner diagnosis. The separate, second defect behind "the app gets stuck at the verdict screen."

## What's broken

When the candidate pool for a room is empty, `compute-verdict` returns `{"error":"no_candidates"}` as an HTTP 404. No `verdicts` row is written, so the room stays in `status='firing'` forever and iOS polls a verdict that never lands. On 2026-05-19 this wedged **46 of 160 rooms** (~29% of sessions).

## Root cause

`compute-verdict` treats an empty candidate pool as a hard error rather than as a valid terminal outcome. The verdict schema already supports a no-survivor result â€” a no-survivor `method` value plus a nullable `option_id` â€” and iOS `VerdictScreen` already renders the `.noSurvivor` mode. The engine simply never writes that row; it 404s instead.

[[tb-26-remove-fictitious-fallback-venues|tb-26]] (commit `609c115`) removed the fictitious fallback venues that used to mask empty fetches â€” that is the "still" in "the app *still* gets stuck."

## Desired behavior

On an empty candidate pool, `compute-verdict` writes a terminal `no_survivor` `verdicts` row instead of returning a 404. The room leaves `status='firing'`, the verdict poll resolves, and iOS renders the no-survivor verdict screen. An empty pool becomes a normal terminal outcome a user can see and act on â€” never an infinite wedge.

## Agent Brief

**Category:** bug
**Summary:** `compute-verdict` 404s on an empty candidate pool and never writes a verdict row, wedging the room. Make it write a terminal no-survivor verdict instead.

**Current behavior:** With no `options` rows for the room, `compute-verdict` returns `{"error":"no_candidates"}` HTTP 404. No `verdicts` row is written; `rooms.status` stays `firing`.

**Desired behavior:** With an empty candidate pool, `compute-verdict` writes a terminal no-survivor `verdicts` row (no-survivor method, null `option_id`) and advances the room out of `firing`, exactly as a normal verdict would. The function returns success, not 404.

**Key interfaces:**
- The `compute-verdict` edge function â€” the empty-pool branch that currently returns the `no_candidates` error must instead persist a no-survivor verdict and run the same room-status advance the success path runs.
- The `verdicts` schema / verdict-write path â€” confirm the no-survivor method value and nullable `option_id` are accepted by the write (the schema already models this; iOS already renders it).
- Room status â€” an empty-pool resolution must leave `status='firing'` the same way a normal verdict does.

**Acceptance criteria:**
- [ ] A `compute-verdict` invocation on a room with an empty candidate pool writes a terminal no-survivor `verdicts` row instead of returning `{"error":"no_candidates"}`.
- [ ] The room advances out of `status='firing'` on an empty-pool resolution, the same as a normal verdict.
- [ ] A non-empty candidate pool still resolves to a normal ranked verdict â€” no regression.
- [ ] iOS renders the existing `.noSurvivor` verdict screen for an empty-pool room (no iOS change expected â€” verify the existing path).
- [ ] `compute-verdict` edge-function tests cover empty-pool â†’ no-survivor verdict and non-empty â†’ ranked verdict.

**Out of scope:**
- Why a pool is empty in the first place â€” that is [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] (the iOS fire-before-persist race).
- Cleaning up the rooms already wedged in prod â€” that is [[ops-01-wedged-firing-rooms-cleanup|ops-01]], which is blocked by this slice.

## Blocked by

None â€” self-contained edge-function change. Can start immediately.

## Related

- [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] â€” the iOS race that produces empty pools; parallel slice
- [[ops-01-wedged-firing-rooms-cleanup|ops-01]] â€” re-fires the 46 already-wedged rooms; blocked by this slice
- [[tb-21-raw-fetch-to-options|tb-21]] â€” the server-side `options` union this resolves over
- [[tb-26-remove-fictitious-fallback-venues|tb-26]] â€” removed the fallback that used to mask empty pools

## Comments

**2026-05-19 â€” filed.** Found during the 2026-05-19 verdict-spinner diagnosis â€” confirmed by directly re-invoking `compute-verdict` on a wedged room and getting `no_candidates`. Triaged `ready-for-agent` / AFK â€” self-contained, clear contract, the no-survivor verdict shape already exists end-to-end.

**2026-05-19 â€” done (PR [#146](https://github.com/samfarls55/gettoit/pull/146)).** AFK agent removed the `no_candidates` 404 branch from the `compute-verdict` handler. An empty candidate pool now flows through to the verdict engine, which already short-circuits an empty pool to a `no_survivor` output; the handler persists the terminal `no_survivor` verdict row (null `option_id`) and runs the same room-status advance the success path runs, so the room leaves `firing`. The `no_votes` 404 was retained and reordered to run before the engine call â€” a room with zero member votes genuinely has no group to render a verdict for. No iOS change: `VerdictScreen` / `VerdictStore` already render `.noSurvivor`. New `index-empty-pool.test.ts` covers empty-pool â†’ no-survivor verdict, room-advance, non-empty no-regression, and empty-pool-plus-no-votes â†’ `no_votes` 404; two pre-existing tests that asserted the old `no_candidates` contract were updated. Full edge-function suite green (313 passed). bug-14 (iOS fire-before-persist race, the cause of empty pools) and ops-01 (re-fire the 46 already-wedged rooms â€” now unblocked) remain open.
