---
run: 2026-05-19-1932
status: done
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# AFK Execution Run â€” 2026-05-19 19:32

Goal: execute all open AFK issues not blocked by a HITL issue.

## Work set
- Ready (wave 1): bug-12, bug-13, bug-14
- Waiting (blocked by open AFK): ops-01 <- bug-13
- Excluded (HITL-blocked): none
- Skipped (needs-info / unparseable): none

## Issue ledger

| Issue | GitHub | State | Branch | PR | Notes |
|---|---|---|---|---|---|
| bug-12 | #142 | merged | afk/bug-12 | #147, #149 | iOS orphaned-host fix + DebugTrace revert + debug_trace table dropped |
| bug-13 | #143 | merged | afk/bug-13 | #146, #148 | compute-verdict no-survivor on empty pool |
| bug-14 | #144 | merged | afk/bug-14 | #150 | iOS fire-before-persist race; awaits member_fetches persist |
| ops-01 | #145 | merged | afk/ops-01 | #151 | re-fired 558 wedged rooms -> all no_survivor |

## Event log
- 19:32 â€” Run opened. Preflight green (clean tree, on main, in sync, gh auth ok). Work set built: 3 ready, 1 waiting.
- 19:33 â€” Wave 1 batch 1 spawned: bug-12, bug-13 (cap 2).
- 19:51 â€” bug-12 MERGED â€” PR #147 (code) + #149 (tracker). DebugTrace instrumentation reverted; public.debug_trace dropped from gettoit-prod and verified.
- 19:51 â€” bug-13 MERGED â€” PR #146 (code) + #148 (tracker). compute-verdict writes terminal no-survivor verdict on empty pool. Unblocks ops-01.
- 19:52 â€” main fast-forwarded to ea92c20. Re-ran ready-issues: ready=bug-14, ops-01.
- 19:52 â€” Wave 2 spawned: bug-14, ops-01 (cap 2).
- 20:25 â€” bug-14 MERGED â€” PR #150. submit() now awaits the member candidate-fetch + member_fetches persist before the verdict-firing votes write; persist failures surfaced via new member_fetch_persist_failed telemetry; empty fetch persisted as a real empty row.
- 20:25 â€” ops-01 MERGED â€” PR #151. Enumerated 856 firing rooms; re-fired 558 (firing + no verdict + has votes) -> all resolved to no_survivor. Canary confirmed the deployed compute-verdict already carried the bug-13 fix; no function deploy needed.
- 20:26 â€” main fast-forwarded to 506b09c. Re-ran ready-issues: ready=0, waiting=0, excluded=0. Backlog drained â€” run closed.

## Close-out

**Completed (4/4 â€” all merged, 0 escalated, 0 failed):**
- bug-12 â€” post-Q5 routing idempotency + DebugTrace revert + debug_trace table dropped â€” PR #147, #149
- bug-13 â€” compute-verdict writes terminal no-survivor verdict on empty pool â€” PR #146, #148
- bug-14 â€” iOS submit awaits member_fetches persist before firing the verdict â€” PR #150
- ops-01 â€” re-fired 558 wedged prod rooms; all resolved to no_survivor â€” PR #151

**Skipped (needs-info / unparseable):** none.
**Excluded (HITL-blocked):** none.
**Escalated / failed:** none.
**Stranded on unmerged blocker:** none.

**Finding flagged for triage (out of scope, surfaced by ops-01):** ~300 vote-less abandoned `firing` rooms in `gettoit-prod` â€” a failure mode distinct from the bug-13 empty-pool wedge (`compute-verdict` hard-404s them as `no_votes`). Documented at [[../../60_engineering/2026-05-19-voteless-firing-rooms|60_engineering/2026-05-19-voteless-firing-rooms]]. Not yet a tracked issue â€” needs triage (sweep to `expired`, fix the fire dispatch, or leave).
