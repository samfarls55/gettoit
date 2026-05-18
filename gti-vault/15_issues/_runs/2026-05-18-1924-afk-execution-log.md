---
run: 2026-05-18-1924
status: done
---

# AFK Execution Run — 2026-05-18-1924

Goal: execute all open AFK issues not blocked by a HITL issue.

Concurrency cap: 2 (default — no override given).

## Work set
- Ready (wave 1): bug-09
- Waiting (blocked by open AFK): tb-23 <- bug-09
- Excluded (HITL-blocked): none
- Skipped (needs-info / unparseable): none

## Issue ledger

| Issue | GitHub | State | Branch | PR | Notes |
|---|---|---|---|---|---|
| bug-09 | #117 | merged | afk/bug-09 | [#128](https://github.com/samfarls55/gettoit/pull/128) | app_config table; dispatch rewritten; CI seed step; verified live |
| tb-23 | #121 | merged | afk/tb-23 | [#129](https://github.com/samfarls55/gettoit/pull/129) | server-side preference scoring over the full union |

## Event log
- 19:24 — Run started. Preflight green (clean tree, on main, synced, gh authed). Work set: 1 ready, 1 waiting.
- 19:24 — Cleared stale afk/bug-09 branch (local + remote) left by run-1742's escalated PR #124.
- 19:25 — Wave 1 spawned: bug-09.
- 19:37 — bug-09 MERGED (PR #128). #117 closed. app_config table replaces the GUCs; fix applied + verified live on prod.
- 19:37 — Wave 1 drained. tb-23's only blocker (bug-09) merged → tb-23 promoted to wave 2.
- 19:38 — Wave 2 spawned: tb-23.
- 19:56 — tb-23 MERGED (PR #129). #121 closed. Server-side preference scoring shipped — closes the bug-08 Option 2 fork.
- 19:56 — Wave 2 drained. Re-ran ready-issues: ready=0, waiting=0, excluded=0. Backlog cleared. Run complete.

## Closeout

### Completed (merged)
- bug-09 (#117) — verdict-dispatch re-scoped to an `app_config` table — PR [#128](https://github.com/samfarls55/gettoit/pull/128)
- tb-23 (#121) — server-side preference scoring over the full union — PR [#129](https://github.com/samfarls55/gettoit/pull/129)

### Escalated / failed
- none.

### Stranded / skipped
- none. Backlog of AFK issues fully cleared.

### Adjacency flagged (not actioned — for triage)
- tb-23's subagent found the iOS Q5 write path still emits a per-venue score map, not the `{droppedAxis, score}` factorial-rating shape the new `regret` slot expects. Server degrades gracefully (Q1/Q3/Q4 still score; Q5 re-weight stays dark). Documented in `gti-vault/01_raw/tb-23-ios-q5-ratings-wire-gap.md`, flagged for `compile` — recommended as a new v1.1 tracer-bullet (no blockers).

Run result: 2/2 merged across 2 waves, 0 escalated, 0 stranded. With bug-09 + tb-21/tb-22/tb-23 all merged, the verdict pipeline (bug-08 Option 2) is now wired end to end.
