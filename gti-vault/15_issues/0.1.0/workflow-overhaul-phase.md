---
folder: 15_issues/0.1.0
purpose: 0.1.0 workflow-overhaul phase (formerly "workflow-overhaul") â€” Plans as persistent named items, list-as-landing, collapsed Setup screen, three nav verbs (Back/Exit/Delete)
status: filed 2026-05-19; all 22 issues (8 spec-gaps + 14 tracer-bullets) merged, plus one follow-up spec-gap (sg-WF-9, the web-01 Â§C no-survivor gap)
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0.1.0 workflow-overhaul phase

> Previously labeled `workflow-overhaul`. Renamed 2026-05-25 â€” collapsed into the 0.1.0 pre-launch cycle.

Decomposed via `/to-issues` on 2026-05-19 from [[../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] (the locked outcomes of an 11-question `/grill-with-docs` session that day).

## Framing

The next coherent feature phase after the dogfood batch, focused on the post-dogfood user workflow:

1. Rename *decision* â†’ **Plan** (1 syllable, casual, scales to v2+ categories).
2. Make Plans persistent, named, list-backed items in the Reminders-app spirit.
3. Collapse today's S01 + S01b into a single Setup screen.
4. Replace the walking-vs-driving binary with a distance-only slider (walk-vs-drive implicit at 1.0 mi).
5. Define three navigation verbs (`Back`, `Exit`, `Delete`) with clear scope.

The decision doc captures the eleven grilled outcomes with rejected alternatives; this phase holds the implementation issues.

## Published issues

### Spec-gaps

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| sg-WF-1 | [[issues/sg-wf-1-plan-setup-surface\|Plan setup surface â€” design-system spec + JSX]] | AFK | [#154](https://github.com/samfarls55/gettoit/issues/154) | done 2026-05-19 |
| sg-WF-2 | [[issues/sg-wf-2-quiz-back-exit-chrome\|Quiz Back + Exit chrome â€” S03 surface additions]] | AFK | [#155](https://github.com/samfarls55/gettoit/issues/155) | done 2026-05-19 |
| sg-WF-3 | [[issues/sg-wf-3-s04-timer-sweep\|S04 timer sweep â€” finalize removal beyond the stale marker]] | AFK | [#156](https://github.com/samfarls55/gettoit/issues/156) | done 2026-05-19 |
| sg-WF-4 | [[issues/sg-wf-4-plan-list-surface\|Plan list surface â€” design-system spec + JSX]] | AFK | [#157](https://github.com/samfarls55/gettoit/issues/157) | done 2026-05-20 |
| sg-WF-5 | [[issues/sg-wf-5-web-invitee-flow\|Web invitee single-link flow â€” design-system surface doc]] | AFK | [#158](https://github.com/samfarls55/gettoit/issues/158) | done 2026-05-21 |
| sg-WF-6 | [[issues/sg-wf-6-reroll-window-deadline\|Reroll window deadline mechanism]] | AFK | [#159](https://github.com/samfarls55/gettoit/issues/159) | done 2026-05-21 |
| sg-WF-7 | [[issues/sg-wf-7-web-invitee-account-claim\|Web invitee account claim â€” cross-context identity bridge]] | HITL | [#191](https://github.com/samfarls55/gettoit/issues/191) | done 2026-05-22 |
| sg-WF-8 | [[issues/sg-wf-8-account-claim-design-system\|Account-claim design-system amendment â€” S00a + web mint affordance]] | AFK | [#194](https://github.com/samfarls55/gettoit/issues/194) | done 2026-05-21 |
| sg-WF-9 | [[issues/sg-wf-9-verdict-card-no-survivor\|web-01-invitee-shell Â§C does not spec the no-survivor decided-plan case]] | AFK | [#215](https://github.com/samfarls55/gettoit/issues/215) | done 2026-05-22 â€” PR #217 |

### Tracer-bullets

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| tb-WF-1 | [[issues/tb-wf-1-plans-table-schema\|Plans table + lifecycle schema + Plan store]] | AFK | [#160](https://github.com/samfarls55/gettoit/issues/160) | done 2026-05-20 |
| tb-WF-2 | [[issues/tb-wf-2-quiz-back-exit-wire\|Wire Quiz Back + Exit chrome on iOS]] | AFK | [#161](https://github.com/samfarls55/gettoit/issues/161) | done 2026-05-20 |
| tb-WF-3 | [[issues/tb-wf-3-s04-timer-sweep-ios\|S04 timer sweep â€” iOS port (retire TimerCoordinator)]] | AFK | [#162](https://github.com/samfarls55/gettoit/issues/162) | done 2026-05-19 |
| tb-WF-4 | [[issues/tb-wf-4-wire-plan-setup-surface\|Wire Plan setup surface â€” replaces S01 + S01b]] | AFK | [#163](https://github.com/samfarls55/gettoit/issues/163) | done 2026-05-20 |
| tb-WF-5 | [[issues/tb-wf-5-plan-list-solo-cycle\|iOS Plan list â€” Solo creation cycle (foundation)]] | AFK | [#174](https://github.com/samfarls55/gettoit/issues/174) | done 2026-05-20 |
| tb-WF-6 | [[issues/tb-wf-6-plan-list-group-disambig\|iOS Plan list â€” Group creation + FAB + disambig sheet]] | AFK | [#175](https://github.com/samfarls55/gettoit/issues/175) | done 2026-05-20 |
| tb-WF-7 | [[issues/tb-wf-7-plan-list-joiner-resume\|iOS Plan list â€” Joiner journey (JOINED chip + resume-from-state)]] | AFK | [#176](https://github.com/samfarls55/gettoit/issues/176) | done 2026-05-20 |
| tb-WF-8 | [[issues/tb-wf-8-plan-list-decided-history\|iOS Plan list â€” Decided + History sections + lifecycle transitions]] | AFK | [#177](https://github.com/samfarls55/gettoit/issues/177) | done 2026-05-20 |
| tb-WF-9 | [[issues/tb-wf-9-plan-list-destructive-actions\|iOS Plan list â€” Three-dot menu + delete + leave]] | AFK | [#178](https://github.com/samfarls55/gettoit/issues/178) | done 2026-05-20 |
| tb-WF-10 | [[issues/tb-wf-10-web-quiz-v11-port\|Web quiz dogfood-phase port + shared votes-wire extraction]] | AFK | [#190](https://github.com/samfarls55/gettoit/issues/190) | done 2026-05-21 |
| tb-WF-11 | [[issues/tb-wf-11-web-invitee-shell-foundation\|Web invitee shell foundation â€” landing, name entry, members.display_name]] | AFK | [#192](https://github.com/samfarls55/gettoit/issues/192) | done 2026-05-21 |
| tb-WF-12 | [[issues/tb-wf-12-web-invitee-shell-reclick\|Web invitee shell re-click behaviors â€” resume, read-only, leave]] | AFK | [#193](https://github.com/samfarls55/gettoit/issues/193) | done 2026-05-21 |
| tb-WF-13 | [[issues/tb-wf-13-claim-code-mint\|Claim code mint side â€” claim_codes table + mint edge function + web affordance]] | AFK | [#195](https://github.com/samfarls55/gettoit/issues/195) | done 2026-05-21 |
| tb-WF-14 | [[issues/tb-wf-14-claim-code-redeem\|Claim code redeem side â€” redeem edge function + S00a code entry + linkApple]] | AFK | [#196](https://github.com/samfarls55/gettoit/issues/196) | done 2026-05-21 |

## Schema cleanup follow-ups

Items knowingly left in place by current slices â€” separate, low-risk cleanup tasks that can land any time without blocking forward work.

| Column / artifact | Why it stays | Cleanup trigger |
|---|---|---|
| `rooms.timer_minutes` | Retired by sg-WF-3 â€” iOS no longer offers a timer chip, no client writes a non-default value. `tb-WF-3` left the column populated at the migration default (10). | Drop in an additive migration once any downstream readers are gone. |
| `rooms.deadline_at` | Retired by sg-WF-3 â€” there is no client-side timer, no row receives a `deadline_at`, no cron consumes it. | Drop in an additive migration once production rows are confirmed all-NULL. |

## Cross-references

- [[../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] â€” the locked decisions doc.
- [[../../../CONTEXT|CONTEXT.md]] â†’ Plan vocabulary â€” canonical terms.
- [[prd-phase|0.1.0 PRD phase]] and [[dogfood-phase|0.1.0 dogfood phase]] â€” prior phases of the 0.1.0 cycle.
