---
issue: bug-13
title: compute-verdict wedges the room on an empty candidate pool instead of writing a terminal no-survivor verdict
status: ready-for-agent
type: AFK
github_issue: 143
created: 2026-05-19
prd: v1.1-quiz-redesign-prd
---

# bug-13 — Engine wedges the room on an empty candidate pool

## Parent

[[../_index|v1.1 backlog]] — found during the 2026-05-19 verdict-spinner diagnosis. The separate, second defect behind "the app gets stuck at the verdict screen."

## What's broken

When the candidate pool for a room is empty, `compute-verdict` returns `{"error":"no_candidates"}` as an HTTP 404. No `verdicts` row is written, so the room stays in `status='firing'` forever and iOS polls a verdict that never lands. On 2026-05-19 this wedged **46 of 160 rooms** (~29% of sessions).

## Root cause

`compute-verdict` treats an empty candidate pool as a hard error rather than as a valid terminal outcome. The verdict schema already supports a no-survivor result — a no-survivor `method` value plus a nullable `option_id` — and iOS `VerdictScreen` already renders the `.noSurvivor` mode. The engine simply never writes that row; it 404s instead.

[[tb-26-remove-fictitious-fallback-venues|tb-26]] (commit `609c115`) removed the fictitious fallback venues that used to mask empty fetches — that is the "still" in "the app *still* gets stuck."

## Desired behavior

On an empty candidate pool, `compute-verdict` writes a terminal `no_survivor` `verdicts` row instead of returning a 404. The room leaves `status='firing'`, the verdict poll resolves, and iOS renders the no-survivor verdict screen. An empty pool becomes a normal terminal outcome a user can see and act on — never an infinite wedge.

## Agent Brief

**Category:** bug
**Summary:** `compute-verdict` 404s on an empty candidate pool and never writes a verdict row, wedging the room. Make it write a terminal no-survivor verdict instead.

**Current behavior:** With no `options` rows for the room, `compute-verdict` returns `{"error":"no_candidates"}` HTTP 404. No `verdicts` row is written; `rooms.status` stays `firing`.

**Desired behavior:** With an empty candidate pool, `compute-verdict` writes a terminal no-survivor `verdicts` row (no-survivor method, null `option_id`) and advances the room out of `firing`, exactly as a normal verdict would. The function returns success, not 404.

**Key interfaces:**
- The `compute-verdict` edge function — the empty-pool branch that currently returns the `no_candidates` error must instead persist a no-survivor verdict and run the same room-status advance the success path runs.
- The `verdicts` schema / verdict-write path — confirm the no-survivor method value and nullable `option_id` are accepted by the write (the schema already models this; iOS already renders it).
- Room status — an empty-pool resolution must leave `status='firing'` the same way a normal verdict does.

**Acceptance criteria:**
- [ ] A `compute-verdict` invocation on a room with an empty candidate pool writes a terminal no-survivor `verdicts` row instead of returning `{"error":"no_candidates"}`.
- [ ] The room advances out of `status='firing'` on an empty-pool resolution, the same as a normal verdict.
- [ ] A non-empty candidate pool still resolves to a normal ranked verdict — no regression.
- [ ] iOS renders the existing `.noSurvivor` verdict screen for an empty-pool room (no iOS change expected — verify the existing path).
- [ ] `compute-verdict` edge-function tests cover empty-pool → no-survivor verdict and non-empty → ranked verdict.

**Out of scope:**
- Why a pool is empty in the first place — that is [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] (the iOS fire-before-persist race).
- Cleaning up the rooms already wedged in prod — that is [[ops-01-wedged-firing-rooms-cleanup|ops-01]], which is blocked by this slice.

## Blocked by

None — self-contained edge-function change. Can start immediately.

## Related

- [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] — the iOS race that produces empty pools; parallel slice
- [[ops-01-wedged-firing-rooms-cleanup|ops-01]] — re-fires the 46 already-wedged rooms; blocked by this slice
- [[tb-21-raw-fetch-to-options|tb-21]] — the server-side `options` union this resolves over
- [[tb-26-remove-fictitious-fallback-venues|tb-26]] — removed the fallback that used to mask empty pools

## Comments

**2026-05-19 — filed.** Found during the 2026-05-19 verdict-spinner diagnosis — confirmed by directly re-invoking `compute-verdict` on a wedged room and getting `no_candidates`. Triaged `ready-for-agent` / AFK — self-contained, clear contract, the no-survivor verdict shape already exists end-to-end.
