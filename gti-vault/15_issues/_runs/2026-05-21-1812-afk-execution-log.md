---
run: 2026-05-21-1812
status: done
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# AFK Execution Run â€” 2026-05-21-1812

Goal: execute all open AFK issues not blocked by a HITL issue.

## Work set
- Ready (wave 1): bug-11, sg-WF-5, sg-WF-6, sg-WF-8, tb-WF-10
- Waiting (blocked by open AFK):
  - tb-WF-11 <- sg-WF-5
  - tb-WF-12 <- tb-WF-11
  - tb-WF-13 <- sg-WF-8, tb-WF-12
  - tb-WF-14 <- sg-WF-8, tb-WF-13
- Excluded (HITL-blocked): none
- Skipped (needs-info / unparseable): none â€” bug-11 carried a `blockers-unparseable`
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
| tb-WF-13 | #195 | merged | afk/tb-WF-13 | [#205](https://github.com/samfarls55/gettoit/pull/205) | wave 4; claim-code mint side; needs CLAIM_CODE_ENC_KEY secret (HITL) |
| tb-WF-14 | #196 | merged | afk/tb-WF-14 | [#206](https://github.com/samfarls55/gettoit/pull/206) | wave 5; claim-code redeem side + S00a entry; final issue |

## Event log
- 18:12 â€” Preflight: tree was dirty (in-progress vault triage); user authorised
  commit + push. Committed as 529f8f5, pushed to origin/main. Tree clean.
- 18:12 â€” Work set built: 5 ready, 4 waiting, 0 HITL-excluded.
- 18:12 â€” Run log opened. Starting wave 1, batch 1 (cap 2).
- 18:13 â€” Dispatched bug-11 (#140) and sg-WF-5 (#158) to subagents in isolated worktrees.
- 18:22 â€” bug-11 MERGED via PR #198 (squash 1465436). Vault status:done, v1.1 _index synced by subagent. Local main realigned to origin/main (mixed reset; trees identical â€” squash vs pre-squash history only).
- 18:25 â€” sg-WF-5 MERGED via PR #199 (squash 826f656). Web-01 invitee shell surface doc + 6th verify.mjs check. Unblocks tb-WF-11.
- 18:25 â€” Orchestrator note: the Bash shell cwd had drifted into a subagent worktree; all orchestrator git ops now pinned with `git -C /workspace`. Subagent worktrees were correctly isolated â€” no cross-contamination.
- 18:25 â€” Both slots free; wave 1 has 3 ready left (sg-WF-6, sg-WF-8, tb-WF-10). Dispatching sg-WF-6 (#159) + sg-WF-8 (#194); tb-WF-10 queued.
- 18:38 â€” sg-WF-8 MERGED via PR #200 (squash 45db9a6). S00a account-claim surface + web mint affordance. Unblocks tb-WF-13, tb-WF-14.
- 18:38 â€” Slot freed; dispatching tb-WF-10 (#190) â€” last wave-1 issue. sg-WF-6 still building.
- 18:58 â€” sg-WF-6 MERGED via PR #201 (squash b67dc6f). Subagent rebased cleanly, resolving a CHANGELOG conflict vs sg-WF-8. Wave 1 complete: bug-11, sg-WF-5, sg-WF-6, sg-WF-8 merged; tb-WF-10 still building.
- 18:58 â€” Re-scan: tb-WF-11 ready (sg-WF-5 cleared); tb-WF-13/14 blockers narrowed to the chain only (sg-WF-8 cleared). Dispatching tb-WF-11 (#192) into the free slot â€” runs parallel to tb-WF-10.
- 19:22 â€” tb-WF-10 MERGED via PR #202 (squash 4961e18). 5/9 done. Adjacency flagged by subagent (not fixed, out of scope): web verdict-*read* path (`web/lib/verdict.ts` VoteSummaryRow + SessionRoom verdict load) still references the retired v1 typed `votes` columns dropped by the generic-jsonb migration â€” read-side receipts should move to the `verdict_for_room` RPC projection. Candidate follow-up issue; surfaced to user at close-out.
- 19:22 â€” Free slot cannot be filled: only remaining work is the sequential chain tb-WF-12â†’13â†’14, all blocked behind tb-WF-11 (still building). Holding at 1 in flight.
- 19:48 â€” tb-WF-11 MERGED via PR #203 (squash 3807085). 6/9 done. Subagent noted a pre-existing `tsc --noEmit` type error in `web/lib/quiz.test.ts:128-129` left by tb-WF-10 â€” not CI-gated (web lane runs test+build only). Surfaced to user at close-out.
- 19:48 â€” Re-scan: tb-WF-12 ready. Dispatching tb-WF-12 (#193). tb-WF-13/14 still chained behind it â€” 1 in flight by necessity.
- 20:18 â€” tb-WF-12 MERGED via PR #204 (squash fb0161d). 7/9 done. ADR 0017 added (web-invitee re-click RLS routing). Adjacency flagged by subagent: `web/components/InviteWebCard.tsx` is genuinely dead code (referenced only by its own test) â€” candidate cleanup issue. (Note: tb-WF-11's earlier claim that `/s/[sessionId]` is dead was wrong â€” that route still hosts SessionRoom.)
- 20:18 â€” Re-scan: tb-WF-13 ready. Dispatching tb-WF-13 (#195). tb-WF-14 chained behind it.
- 20:26 â€” tb-WF-13 subagent CRASHED (API socket closed, transient infra error) after 39 tool calls. Investigated: no remote branch, no PR, issue #195 still open, the crashed worktree's afk/tb-WF-13 branch never advanced past base â€” zero salvageable work. Not an issue-level failure; the run continues.
- 20:26 â€” Force-removed the crashed worktree + deleted the stale afk/tb-WF-13 branch to free the name. Re-dispatching tb-WF-13 fresh from current main (173a42a).
- 20:47 â€” tb-WF-13 (retry) MERGED via PR #205 (squash 986fca4). 8/9 done. HITL follow-up: a `CLAIM_CODE_ENC_KEY` GitHub repo secret must be added (`openssl rand -base64 32`) â€” until then the live `mint-claim-code` function returns `mint_claim_code_misconfigured`. Surfaced to user at close-out.
- 20:47 â€” Re-scan: tb-WF-14 ready â€” the final issue, 0 waiting. Dispatching tb-WF-14 (#196).
- 21:10 â€” tb-WF-14 MERGED via PR #206 (squash 2033ba1). 9/9 done. Subagent needed one CI iteration (S00a affordance state lifted to an `@Observable` model to be unit-testable). Orchestrator fixed a tracker-sync gap: the subagent's close-out commit added the closing note + `_index.md` row but left the vault `status:` at `ready-for-agent` â€” corrected to `done`.
- 21:10 â€” Final re-scan from /workspace: 0 ready, 0 waiting, 0 excluded. Work set fully drained. Run complete.

## Close-out

**Result: 9/9 AFK issues merged. 0 escalated, 0 failed, 0 stranded.**

Completed (issue â€” PR):
- bug-11 â€” [#198](https://github.com/samfarls55/gettoit/pull/198) â€” iOS fixture factories moved off the app target + hygiene guard
- sg-WF-5 â€” [#199](https://github.com/samfarls55/gettoit/pull/199) â€” Web-01 invitee shell surface doc
- sg-WF-8 â€” [#200](https://github.com/samfarls55/gettoit/pull/200) â€” S00a account-claim design-system amendment
- sg-WF-6 â€” [#201](https://github.com/samfarls55/gettoit/pull/201) â€” reroll-window deadline mechanism + ADR 0016
- tb-WF-10 â€” [#202](https://github.com/samfarls55/gettoit/pull/202) â€” web quiz v1.1 port + votes-wire leaf module
- tb-WF-11 â€” [#203](https://github.com/samfarls55/gettoit/pull/203) â€” web invitee shell foundation + members.display_name
- tb-WF-12 â€” [#204](https://github.com/samfarls55/gettoit/pull/204) â€” web invitee shell re-click behaviors + ADR 0017
- tb-WF-13 â€” [#205](https://github.com/samfarls55/gettoit/pull/205) â€” claim-code mint side
- tb-WF-14 â€” [#206](https://github.com/samfarls55/gettoit/pull/206) â€” claim-code redeem side

Skipped / excluded: none. No HITL-blocked issues; no needs-info issues.

Incidents:
- tb-WF-13's first subagent crashed on a transient API socket error before pushing anything; cleaned up and re-dispatched fresh â€” second attempt merged cleanly.

### Follow-ups for the human (action required / suggested)

1. **[ACTION REQUIRED] Add the `CLAIM_CODE_ENC_KEY` GitHub repo secret** (`openssl rand -base64 32`). Until set, the live `mint-claim-code` and `redeem-claim-code` Edge Functions return `*_misconfigured` â€” the web-invitee account-claim bridge is non-functional in production without it. A missing key is only a CI *warning*, so this will not surface as a failed check.
2. **[SUGGESTED] File a follow-up issue: web verdict-read path on retired vote columns.** `web/lib/verdict.ts` (`VoteSummaryRow`) + `SessionRoom`'s verdict load still reference the v1 typed `votes` columns dropped by the generic-jsonb migration; receipts should move to the `verdict_for_room` RPC projection. Flagged by tb-WF-10.
3. **[SUGGESTED] Fix the `tsc --noEmit` type error** at `web/lib/quiz.test.ts:128-129` (left by tb-WF-10). Not CI-gated â€” the web lane runs only `npm test` + `npm run build`. Flagged by tb-WF-11.
4. **[SUGGESTED] Retire dead code `web/components/InviteWebCard.tsx`** â€” referenced only by its own test. Flagged by tb-WF-12.
