---
folder: 15_issues/workflow-overhaul
purpose: Workflow-overhaul phase — Plans as persistent named items, list-as-landing, collapsed Setup screen, three nav verbs (Back/Exit/Delete)
status: filed 2026-05-19 — 15 issues (6 spec-gaps + 9 tracer-bullets); 2 remain HITL (sg-WF-5, sg-WF-6) pending further grilling. sg-WF-4 grilled + 5 new iOS-port tracer-bullets (tb-WF-5..9) filed 2026-05-20; tb-WF-4 amended in place + promoted to ready-for-agent.
---

# 15_issues/workflow-overhaul — Index

Workflow-overhaul phase. Decomposed via `/to-issues` on 2026-05-19 from [[../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] (the locked outcomes of an 11-question `/grill-with-docs` session that day).

## Framing

This phase is **not** part of v1 or the v1.1 batches. It is the next coherent feature phase, focused on the post-v1.1 user workflow:

1. Rename *decision* → **Plan** (1 syllable, casual, scales to v2+ categories).
2. Make Plans persistent, named, list-backed items in the Reminders-app spirit.
3. Collapse today's S01 + S01b into a single Setup screen.
4. Replace the walking-vs-driving binary with a distance-only slider (walk-vs-drive implicit at 1.0 mi).
5. Define three navigation verbs (`Back`, `Exit`, `Delete`) with clear scope.

The decision doc captures the eleven grilled outcomes with rejected alternatives; this folder holds the implementation issues.

## Published issues

### Spec-gaps

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| sg-WF-1 | [[issues/sg-wf-1-plan-setup-surface\|Plan setup surface — design-system spec + JSX]] | AFK | [#154](https://github.com/samfarls55/gettoit/issues/154) | done 2026-05-19 |
| sg-WF-2 | [[issues/sg-wf-2-quiz-back-exit-chrome\|Quiz Back + Exit chrome — S03 surface additions]] | AFK | [#155](https://github.com/samfarls55/gettoit/issues/155) | done 2026-05-19 |
| sg-WF-3 | [[issues/sg-wf-3-s04-timer-sweep\|S04 timer sweep — finalize removal beyond the stale marker]] | AFK | [#156](https://github.com/samfarls55/gettoit/issues/156) | done 2026-05-19 |
| sg-WF-4 | [[issues/sg-wf-4-plan-list-surface\|Plan list surface — design-system spec + JSX]] | AFK | [#157](https://github.com/samfarls55/gettoit/issues/157) | done 2026-05-20 |
| sg-WF-5 | [[issues/sg-wf-5-web-invitee-flow\|Web invitee single-link flow — design needed]] | HITL | [#158](https://github.com/samfarls55/gettoit/issues/158) | — |
| sg-WF-6 | [[issues/sg-wf-6-reroll-window-deadline\|Reroll window deadline mechanism — needs minor grill]] | HITL | [#159](https://github.com/samfarls55/gettoit/issues/159) | — |

### Tracer-bullets

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| tb-WF-1 | [[issues/tb-wf-1-plans-table-schema\|Plans table + lifecycle schema + Plan store]] | AFK | [#160](https://github.com/samfarls55/gettoit/issues/160) | done 2026-05-20 |
| tb-WF-2 | [[issues/tb-wf-2-quiz-back-exit-wire\|Wire Quiz Back + Exit chrome on iOS]] | AFK | [#161](https://github.com/samfarls55/gettoit/issues/161) | done 2026-05-20 |
| tb-WF-3 | [[issues/tb-wf-3-s04-timer-sweep-ios\|S04 timer sweep — iOS port (retire TimerCoordinator)]] | AFK | [#162](https://github.com/samfarls55/gettoit/issues/162) | done 2026-05-19 |
| tb-WF-4 | [[issues/tb-wf-4-wire-plan-setup-surface\|Wire Plan setup surface — replaces S01 + S01b]] | AFK | [#163](https://github.com/samfarls55/gettoit/issues/163) | sg-WF-1, tb-WF-1 (amended 2026-05-20 for Q7 lift-out; ready-for-agent) |
| tb-WF-5 | [[issues/tb-wf-5-plan-list-solo-cycle\|iOS Plan list — Solo creation cycle (foundation)]] | AFK | [#174](https://github.com/samfarls55/gettoit/issues/174) | sg-WF-4, tb-WF-4 |
| tb-WF-6 | [[issues/tb-wf-6-plan-list-group-disambig\|iOS Plan list — Group creation + FAB + disambig sheet]] | AFK | [#175](https://github.com/samfarls55/gettoit/issues/175) | tb-WF-5, tb-WF-4 |
| tb-WF-7 | [[issues/tb-wf-7-plan-list-joiner-resume\|iOS Plan list — Joiner journey (JOINED chip + resume-from-state)]] | AFK | [#176](https://github.com/samfarls55/gettoit/issues/176) | tb-WF-5 |
| tb-WF-8 | [[issues/tb-wf-8-plan-list-decided-history\|iOS Plan list — Decided + History sections + lifecycle transitions]] | AFK | [#177](https://github.com/samfarls55/gettoit/issues/177) | tb-WF-5, tb-WF-7 |
| tb-WF-9 | [[issues/tb-wf-9-plan-list-destructive-actions\|iOS Plan list — Three-dot menu + delete + leave]] | AFK | [#178](https://github.com/samfarls55/gettoit/issues/178) | tb-WF-5, tb-WF-8 |

### Dependency notes

- **sg-WF-5, sg-WF-6** remain HITL — pending follow-up grills.
- **tb-WF-2** consumes sg-WF-2 (Quiz Back+Exit chrome spec) — done.
- **tb-WF-3** consumes sg-WF-3 (S04 timer sweep spec) — done.
- **tb-WF-4** consumes sg-WF-1 (Setup spec) + tb-WF-1 (Plans table). Amended 2026-05-20 to fold in the Q7 lift-out (solo/group mode-conditional rendering, 5/6 controls); promoted to ready-for-agent. tb-WF-5 ships the Plan list as the `Save for later` destination concurrently.
- **tb-WF-5** is the foundation iOS port for the Plan list. Blocked by sg-WF-4 (spec) + tb-WF-4 (amended Setup with `.solo` mode).
- **tb-WF-6 / tb-WF-7 / tb-WF-8 / tb-WF-9** layer additional capabilities on the tb-WF-5 shell — each is a vertical user-journey slice. See per-issue blocked-by chains.

The remaining HITL items (sg-WF-5 web-invitee flow, sg-WF-6 reroll-window deadline) need follow-up `/grill-with-docs` rounds before they can be promoted to `ready-for-agent`. The downstream tracer-bullets for those (web invitee wire, reroll-window iOS lifecycle) will be filed once those grills resolve.

## Schema cleanup follow-ups

Items knowingly left in place by current slices — separate, low-risk cleanup tasks that can land any time without blocking forward work.

| Column / artifact | Why it stays | Cleanup trigger |
|---|---|---|
| `rooms.timer_minutes` | Retired by v1.1 (sg-WF-3) — iOS no longer offers a timer chip, no client writes a non-default value. `tb-WF-3` left the column populated at the migration default (10) so existing rows stay valid. | Drop in an additive migration once any downstream readers (verify with a repo-wide grep for `timer_minutes`) are gone. |
| `rooms.deadline_at` | Retired by v1.1 (sg-WF-3) — there is no client-side timer, no row receives a `deadline_at`, no cron consumes it. `tb-WF-3` dropped the orphan cron worker (`cron_auto_fire_or_expire`) and the 1-arg `dispatch_compute_verdict` overload in `20260519010000000_drop_v1_timer_orphans.sql` but left the column. | Drop in an additive migration once production rows are confirmed all-NULL. |

## Cross-references

- [[../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] — the locked decisions doc (eleven Qs + rejected alternatives + follow-ups).
- [[../../../CONTEXT|CONTEXT.md]] → Plan vocabulary — canonical terms.
- [[../v1/_index|v1 issues]] and [[../v1.1/_index|v1.1 issues]] — prior phases, for tone + structure reference.
