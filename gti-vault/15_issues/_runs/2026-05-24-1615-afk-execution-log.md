---
run: 2026-05-24-1615
status: running
---

# AFK Execution Run — 2026-05-24-1615

Goal: execute all open AFK issues not blocked by a HITL issue.

## Work set
- Ready (wave 1): bug-21, bug-22, bug-23, bug-24, bug-25, bug-26, bug-28
- Waiting (blocked by open AFK): none
- Excluded (HITL-blocked): none
- Skipped (needs-info / unparseable): bug-27 — `status: needs-info` (reroll broken end-to-end; reporter must supply repro before AFK can act)

Preflight green: clean tree, on main, even with origin/main, `gh` authed.
`ready-issues.mjs` initial run reported `ready=0, outOfScope=109` because
bug-21..28 vault files were missing `type: AFK` frontmatter. Orchestrator
patched the field on all 8 files (GitHub labels already had `AFK`) and re-ran:
`ready=8, waiting=0, excluded=0, outOfScope=101`. The 8th is bug-27, dropped to
the skipped row above on the `status:needs-info` flag.

Concurrency cap: 2 (default).

## Issue ledger

| Issue | GitHub | State | Branch | PR | Notes |
|---|---|---|---|---|---|
| bug-21 | #221 | merged | afk/bug-21 | [#229](https://github.com/samfarls55/gettoit/pull/229) | C-25 Action Dot hit area expanded to HIG 44pt; merged `fddf598` |
| bug-22 | #222 | merged | afk/bug-22 | [#230](https://github.com/samfarls55/gettoit/pull/230) | Start over -> Home in top-leading chrome row; merged `cdf018e` |
| bug-23 | #223 | merged | afk/bug-23 | [#231](https://github.com/samfarls55/gettoit/pull/231) | C-26 FAB T1 ink-fill rework + `GTIShadow.fab` token; merged `d0e7dd6` |
| bug-24 | #224 | building | afk/bug-24 | — | Bottom-sheet iOS shape |
| bug-25 | #225 | building | afk/bug-25 | — | Quiz progress strip layout regression |
| bug-26 | #226 | queued | afk/bug-26 | — | Remove verdict "See what got cut" drawer |
| bug-28 | #228 | queued | afk/bug-28 | — | Solo verdict time-badge subtitle copy |

## Event log
- 16:15 — Run opened. Preflight green. Patched missing `type: AFK` frontmatter on bug-21..28 vault files so `ready-issues.mjs` scopes them in. Wave 1 = [bug-21, bug-22, bug-23, bug-24, bug-25, bug-26, bug-28]. bug-27 skipped (`status:needs-info`).
- 16:16 — Spawned wave-1 batch-1: bug-21, bug-22.
- 16:27 — bug-21 MERGED via PR #229 (`fddf598`). #221 closed, vault `status: done`, `v1.1/_index.md` row updated, remote branch deleted. Slot freed; spawned bug-23.
- 16:39 — bug-22 MERGED via PR #230 (`cdf018e`). Slot freed; spawned bug-24. Spec amendment lands with PR: S05 `Start over` -> `Home` repositioned to top-leading chrome row; `accessibility.md` VO read order updated.
- 16:58 — bug-23 MERGED via PR #231 (`d0e7dd6`). Slot freed; spawned bug-25. Spec changes: C-26 FAB rework (T1 ink-fill), new `GTIShadow.fab` token + `.gtiShadow(_:)` extension, CHANGELOG marked BREAKING (FAB visual treatment changes).
