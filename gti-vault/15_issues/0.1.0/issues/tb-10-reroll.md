---
issue: tb-10
title: Reroll sheet (S07) + reason-to-constraint mechanics + 3-cap
github_issue: 11
status: done
completed: 2026-05-14
type: AFK
created: 2026-05-12
prd: 0.1.0-prd
---

# TB-10 — Reroll

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

The friction surface that converts a rejected verdict into a stated revision of the group's constraints. Capped at 3 per session; each reroll requires a reason from a fixed taxonomy; the reason becomes a real new constraint; the reason is visible to the group on the next verdict.

- **Schema** — `rerolls (id uuid, room_id uuid, user_id uuid, reason text, detail text null, created_at)`. Constraint: `count(rerolls WHERE room_id = X) <= 3`.
- **S07 SwiftUI port** — full port of [[../../../../design-system/surfaces/07-reroll|S07]] Reroll Sheet. 5-reason taxonomy: `cost · dist · mood · diet · avail`. Each tile shows a glyph + label. Reason-required gate on the primary CTA. "2 LEFT" stamp prominent. CTA copy: `"Reroll · burns 1 of 3"` (changes to `"Reroll · last one"` on the 3rd). Optional detail input under the selected tile. Cancel CTA reads `"Cancel · keep <Place>"`.
- **Reason-to-constraint mapping** — server-side function applies the reroll reason as a new constraint before re-running the engine:
  - `cost` → tighten `q2_budget` by one tier (engine-applied, not user-edited).
  - `dist` → reduce `q3_walk_minutes` cap by 5 (floor at 5).
  - `mood` → re-prompt Q4 only for the initiating user; their new vibe value replaces the prior.
  - `diet` → add a new EBA veto to Q1 for the initiating user (prompts which dietary constraint).
  - `avail` → remove the current verdict's `option_id` from the candidate set; engine re-runs on the remaining candidates.
- **Verdict surface — rule chip on rerolled verdict** — when the verdict is the result of a reroll, the rule chip surfaces the reroll reason in aggregate-rule register: `"Cost reroll cut Pico's. Sushi Ren had the next-lowest regret."` Never names the rerolling member.
- **Engine integration** — the reroll handler RPC writes the `rerolls` row, applies the constraint, calls VerdictEngine, returns the new verdict.
- **Tests** — `rerolls` writes succeed up to 3 per room; 4th reroll RPC fails; each reason produces the documented constraint; rule_text on rerolled verdicts surfaces the reason without naming the rerolling member.

## Acceptance criteria

- [x] `rerolls` migration lands with the 3-per-room cap enforced server-side (`supabase/migrations/20260514000300000_rerolls.sql` — `rerolls` table + `apply_reroll(p_room_id, p_reason, p_detail, p_diet_chip)` RPC + `count(rerolls WHERE room_id = X) <= 3` constraint enforced via the RPC's pre-check).
- [x] S07 SwiftUI port matches the locked spec (`ios/Sources/App/RerollScreen.swift` — five-reason taxonomy tiles, reason-required gate on primary CTA, "N LEFT" stamp, dynamic CTA copy `"Reroll · burns 1 of 3"` → `"Reroll · last one"`, optional detail input under the selected tile, `"Cancel · keep <Place>"` secondary).
- [x] Each reroll reason applies the documented constraint and triggers a fresh VerdictEngine run (`supabase/functions/compute-verdict/handler.ts` extended with reroll branch; `verdict-engine.ts` accepts the reroll constraint deltas; `supabase/functions/_shared/verdict-engine-reroll.test.ts` covers `cost` budget tier tighten, `dist` walk-cap −5min, `mood` Q4 re-prompt, `diet` per-user EBA veto, `avail` candidate exclusion).
- [x] Verdict surface rule chip surfaces the reroll reason in aggregate-rule attribution (rule_text uses aggregate register — `"Cost reroll cut Pico's. Sushi Ren had the next-lowest regret."` — and `verdict-engine-reroll.test.ts` asserts the reroll member name never appears in rule_text).
- [x] Last-reroll state (`"1 LEFT"`, `"Reroll · last one"`, `"After this, tonight is committed."`) renders correctly (`RerollScreen.swift` reroll-count-aware copy; `RerollScreenSnapshotTests.swift` smoke tests 0/1/2/3-burned states).
- [x] Integration tests for cap, reason-to-constraint mapping, post-reroll engine run (`compute-verdict/index-reroll.test.ts` — 418 LOC end-to-end coverage; engine fixture suite — 316 LOC).

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]

## Comments

**2026-05-14** — closed. PR [#38](https://github.com/samfarls55/gettoit/pull/38) merged to main as `86b84ff`. The TB-10 subagent burned through its allocation mid-task; the orchestrator recovered the uncommitted work, opened the PR, and applied two follow-up fixes.

- Implementation landed in one migration (`20260514000300000_rerolls.sql`), three iOS modules (`RerollScreen.swift` ~560 LOC, `RerollStore.swift` ~172 LOC, `VerdictScreen.swift` reroll-gated tertiary), and ~734 LOC of test coverage (`RerollScreenSnapshotTests` + `verdict-engine-reroll.test.ts` + `compute-verdict/index-reroll.test.ts`).
- **Rebase fix.** PR-build `supabase db push` lane failed initially with `"Remote migration versions not found in local migrations directory"` because the branch was forked from main before TB-14's five migrations (`20260514000400000`–`…000440000`) merged. The remote DB has them; the local history did not. Rebasing onto current main brought TB-14's migrations into local history and the lane passed. This is the PR-build db push race adjacency flagged on TB-02 + TB-04 — the recovery is always rebase-on-main.
- **Build fix at `326fe3e`.** The agent's TB-10 commit added `rerollsUsed: Int` + `onReroll: () -> Void` to the `VerdictScreen` init and referenced `rerollTertiary` at the default and committed-mode call sites (lines 611, 636) but never defined the `@ViewBuilder private var rerollTertiary`. Xcode 16.2 then failed with `cannot find 'rerollTertiary' in scope`. The fix adds the view: tappable `"REROLL"` button (eyebrow-style, 0.65 alpha ink) firing `onReroll` when `rerollsUsed < 3`; non-tappable `"No rerolls left"` footer at 0.55 alpha when `rerollsUsed >= 3`. Suppression in `.readOnly` / `.noSurvivor` is enforced by the surrounding branch structure, which doesn't reference `rerollTertiary`.

## Adjacencies

- **S05 surface doc lacks reroll-tertiary spec.** `design-system/surfaces/05-verdict.md` mentions reroll only in the suppressed list for `read-only` / `no-survivor` and as the friction-bearing path conceptually. The default/committed-mode tertiary affordance — `"REROLL"` button → `"No rerolls left"` exhausted footer — is implemented in SwiftUI but not documented on the surface. A spec-doc-only follow-up would add a row to the modes table and a "reroll affordance" section. Flag, not block.
- **`ScreenVerdict.jsx` has no reroll affordance.** The JSX twin is not updated to mirror the Swift tertiary button. Follow-up to keep the spec / Swift / JSX triangle synced.
