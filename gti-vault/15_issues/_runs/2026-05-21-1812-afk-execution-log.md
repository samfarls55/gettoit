---
run: 2026-05-21-1812
status: running
---

# AFK Execution Run — 2026-05-21-1812

Goal: execute all open AFK issues not blocked by a HITL issue.

## Work set
- Ready (wave 1): bug-11, sg-WF-5, sg-WF-6, sg-WF-8, tb-WF-10
- Waiting (blocked by open AFK):
  - tb-WF-11 <- sg-WF-5
  - tb-WF-12 <- tb-WF-11
  - tb-WF-13 <- sg-WF-8, tb-WF-12
  - tb-WF-14 <- sg-WF-8, tb-WF-13
- Excluded (HITL-blocked): none
- Skipped (needs-info / unparseable): none — bug-11 carried a `blockers-unparseable`
  flag; its `## Blocked by` section reads "- None." (prose the parser could not
  classify). Re-read and re-classified as unblocked. Queued in wave 1.

Concurrency cap: 2 (default).

## Issue ledger

| Issue | GitHub | State | Branch | PR | Notes |
|---|---|---|---|---|---|
| bug-11   | #140 | merged | afk/bug-11   | [#198](https://github.com/samfarls55/gettoit/pull/198) | wave 1; iOS fixture factories moved to test target + hygiene guard |
| sg-WF-5  | #158 | merged | afk/sg-WF-5  | [#199](https://github.com/samfarls55/gettoit/pull/199) | wave 1; Web-01 invitee shell surface doc; unblocked tb-WF-11 |
| sg-WF-6  | #159 | merged | afk/sg-WF-6  | [#201](https://github.com/samfarls55/gettoit/pull/201) | wave 1; reroll-window deadline + apply_reroll guard; migration live on gettoit-prod |
| sg-WF-8  | #194 | merged | afk/sg-WF-8  | [#200](https://github.com/samfarls55/gettoit/pull/200) | wave 1; S00a + web mint affordance; unblocks tb-WF-13, tb-WF-14 |
| tb-WF-10 | #190 | merged | afk/tb-WF-10 | [#202](https://github.com/samfarls55/gettoit/pull/202) | wave 1; web quiz v1.1 port + votes-wire leaf module |
| tb-WF-11 | #192 | merged | afk/tb-WF-11 | [#203](https://github.com/samfarls55/gettoit/pull/203) | wave 2; invitee shell foundation + members.display_name |
| tb-WF-12 | #193 | merged | afk/tb-WF-12 | [#204](https://github.com/samfarls55/gettoit/pull/204) | wave 3; invitee shell re-click behaviors; ADR 0017 |
| tb-WF-13 | #195 | building | afk/tb-WF-13 | — | wave 4; unblocked by tb-WF-12 |
| tb-WF-14 | #196 | waiting | afk/tb-WF-14 | — | blocked by tb-WF-13 (sg-WF-8 cleared) |

## Event log
- 18:12 — Preflight: tree was dirty (in-progress vault triage); user authorised
  commit + push. Committed as 529f8f5, pushed to origin/main. Tree clean.
- 18:12 — Work set built: 5 ready, 4 waiting, 0 HITL-excluded.
- 18:12 — Run log opened. Starting wave 1, batch 1 (cap 2).
- 18:13 — Dispatched bug-11 (#140) and sg-WF-5 (#158) to subagents in isolated worktrees.
- 18:22 — bug-11 MERGED via PR #198 (squash 1465436). Vault status:done, v1.1 _index synced by subagent. Local main realigned to origin/main (mixed reset; trees identical — squash vs pre-squash history only).
- 18:25 — sg-WF-5 MERGED via PR #199 (squash 826f656). Web-01 invitee shell surface doc + 6th verify.mjs check. Unblocks tb-WF-11.
- 18:25 — Orchestrator note: the Bash shell cwd had drifted into a subagent worktree; all orchestrator git ops now pinned with `git -C /workspace`. Subagent worktrees were correctly isolated — no cross-contamination.
- 18:25 — Both slots free; wave 1 has 3 ready left (sg-WF-6, sg-WF-8, tb-WF-10). Dispatching sg-WF-6 (#159) + sg-WF-8 (#194); tb-WF-10 queued.
- 18:38 — sg-WF-8 MERGED via PR #200 (squash 45db9a6). S00a account-claim surface + web mint affordance. Unblocks tb-WF-13, tb-WF-14.
- 18:38 — Slot freed; dispatching tb-WF-10 (#190) — last wave-1 issue. sg-WF-6 still building.
- 18:58 — sg-WF-6 MERGED via PR #201 (squash b67dc6f). Subagent rebased cleanly, resolving a CHANGELOG conflict vs sg-WF-8. Wave 1 complete: bug-11, sg-WF-5, sg-WF-6, sg-WF-8 merged; tb-WF-10 still building.
- 18:58 — Re-scan: tb-WF-11 ready (sg-WF-5 cleared); tb-WF-13/14 blockers narrowed to the chain only (sg-WF-8 cleared). Dispatching tb-WF-11 (#192) into the free slot — runs parallel to tb-WF-10.
- 19:22 — tb-WF-10 MERGED via PR #202 (squash 4961e18). 5/9 done. Adjacency flagged by subagent (not fixed, out of scope): web verdict-*read* path (`web/lib/verdict.ts` VoteSummaryRow + SessionRoom verdict load) still references the retired v1 typed `votes` columns dropped by the generic-jsonb migration — read-side receipts should move to the `verdict_for_room` RPC projection. Candidate follow-up issue; surfaced to user at close-out.
- 19:22 — Free slot cannot be filled: only remaining work is the sequential chain tb-WF-12→13→14, all blocked behind tb-WF-11 (still building). Holding at 1 in flight.
- 19:48 — tb-WF-11 MERGED via PR #203 (squash 3807085). 6/9 done. Subagent noted a pre-existing `tsc --noEmit` type error in `web/lib/quiz.test.ts:128-129` left by tb-WF-10 — not CI-gated (web lane runs test+build only). Surfaced to user at close-out.
- 19:48 — Re-scan: tb-WF-12 ready. Dispatching tb-WF-12 (#193). tb-WF-13/14 still chained behind it — 1 in flight by necessity.
- 20:18 — tb-WF-12 MERGED via PR #204 (squash fb0161d). 7/9 done. ADR 0017 added (web-invitee re-click RLS routing). Adjacency flagged by subagent: `web/components/InviteWebCard.tsx` is genuinely dead code (referenced only by its own test) — candidate cleanup issue. (Note: tb-WF-11's earlier claim that `/s/[sessionId]` is dead was wrong — that route still hosts SessionRoom.)
- 20:18 — Re-scan: tb-WF-13 ready. Dispatching tb-WF-13 (#195). tb-WF-14 chained behind it.
