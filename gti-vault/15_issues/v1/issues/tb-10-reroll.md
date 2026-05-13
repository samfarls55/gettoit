---
issue: tb-10
title: Reroll sheet (S07) + reason-to-constraint mechanics + 3-cap
github_issue: 11
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
---

# TB-10 — Reroll

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

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

- [ ] `rerolls` migration lands with the 3-per-room cap enforced server-side.
- [ ] S07 SwiftUI port matches the locked spec (visuals, copy, motion).
- [ ] Each reroll reason applies the documented constraint and triggers a fresh VerdictEngine run.
- [ ] Verdict surface rule chip surfaces the reroll reason in aggregate-rule attribution.
- [ ] Last-reroll state (`"1 LEFT"`, `"Reroll · last one"`, `"After this, tonight is committed."`) renders correctly.
- [ ] Integration tests for cap, reason-to-constraint mapping, post-reroll engine run.

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]
