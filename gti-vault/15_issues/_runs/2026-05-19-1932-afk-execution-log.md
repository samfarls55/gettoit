---
run: 2026-05-19-1932
status: done
---

# AFK Execution Run — 2026-05-19 19:32

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
- 19:32 — Run opened. Preflight green (clean tree, on main, in sync, gh auth ok). Work set built: 3 ready, 1 waiting.
- 19:33 — Wave 1 batch 1 spawned: bug-12, bug-13 (cap 2).
- 19:51 — bug-12 MERGED — PR #147 (code) + #149 (tracker). DebugTrace instrumentation reverted; public.debug_trace dropped from gettoit-prod and verified.
- 19:51 — bug-13 MERGED — PR #146 (code) + #148 (tracker). compute-verdict writes terminal no-survivor verdict on empty pool. Unblocks ops-01.
- 19:52 — main fast-forwarded to ea92c20. Re-ran ready-issues: ready=bug-14, ops-01.
- 19:52 — Wave 2 spawned: bug-14, ops-01 (cap 2).
- 20:25 — bug-14 MERGED — PR #150. submit() now awaits the member candidate-fetch + member_fetches persist before the verdict-firing votes write; persist failures surfaced via new member_fetch_persist_failed telemetry; empty fetch persisted as a real empty row.
- 20:25 — ops-01 MERGED — PR #151. Enumerated 856 firing rooms; re-fired 558 (firing + no verdict + has votes) -> all resolved to no_survivor. Canary confirmed the deployed compute-verdict already carried the bug-13 fix; no function deploy needed.
- 20:26 — main fast-forwarded to 506b09c. Re-ran ready-issues: ready=0, waiting=0, excluded=0. Backlog drained — run closed.

## Close-out

**Completed (4/4 — all merged, 0 escalated, 0 failed):**
- bug-12 — post-Q5 routing idempotency + DebugTrace revert + debug_trace table dropped — PR #147, #149
- bug-13 — compute-verdict writes terminal no-survivor verdict on empty pool — PR #146, #148
- bug-14 — iOS submit awaits member_fetches persist before firing the verdict — PR #150
- ops-01 — re-fired 558 wedged prod rooms; all resolved to no_survivor — PR #151

**Skipped (needs-info / unparseable):** none.
**Excluded (HITL-blocked):** none.
**Escalated / failed:** none.
**Stranded on unmerged blocker:** none.

**Finding flagged for triage (out of scope, surfaced by ops-01):** ~300 vote-less abandoned `firing` rooms in `gettoit-prod` — a failure mode distinct from the bug-13 empty-pool wedge (`compute-verdict` hard-404s them as `no_votes`). Documented at [[../../60_engineering/2026-05-19-voteless-firing-rooms|60_engineering/2026-05-19-voteless-firing-rooms]]. Not yet a tracked issue — needs triage (sweep to `expired`, fix the fire dispatch, or leave).
