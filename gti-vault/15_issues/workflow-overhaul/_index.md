---
folder: 15_issues/workflow-overhaul
purpose: Workflow-overhaul phase — Plans as persistent named items, list-as-landing, collapsed Setup screen, three nav verbs (Back/Exit/Delete)
status: filed 2026-05-19; iOS tracer-bullet sequence tb-WF-1..9 all merged 2026-05-20. sg-WF-5 grilled 2026-05-21 and decomposed via /to-issues into the web invitee shell slices (tb-WF-11 → tb-WF-12) plus sibling tb-WF-10 (web quiz port) and sibling sg-WF-7 (account claim); sg-WF-5 surface doc done 2026-05-21. sg-WF-7 grilled 2026-05-21 (claim-code bridge — ADR 0015 + decision doc) and decomposed via /to-issues into sg-WF-8 + tb-WF-13/14. sg-WF-6 grilled 2026-05-21 (reroll-window enforcement — ADR 0016) and merged 2026-05-21 (PR #201) — reroll-window deadline + server guard done. 22 issues total (8 spec-gaps + 14 tracer-bullets); 6 issues open and ready-for-agent (sg-WF-8, tb-WF-10/11/12/13/14). No HITL items remain in the phase.
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
| sg-WF-5 | [[issues/sg-wf-5-web-invitee-flow\|Web invitee single-link flow — design-system surface doc]] | AFK | [#158](https://github.com/samfarls55/gettoit/issues/158) | done 2026-05-21 |
| sg-WF-6 | [[issues/sg-wf-6-reroll-window-deadline\|Reroll window deadline mechanism]] | AFK | [#159](https://github.com/samfarls55/gettoit/issues/159) | done 2026-05-21 |
| sg-WF-7 | [[issues/sg-wf-7-web-invitee-account-claim\|Web invitee account claim — cross-context identity bridge]] | HITL | [#191](https://github.com/samfarls55/gettoit/issues/191) | grilled 2026-05-21 — decomposed |
| sg-WF-8 | [[issues/sg-wf-8-account-claim-design-system\|Account-claim design-system amendment — S00a + web mint affordance]] | AFK | [#194](https://github.com/samfarls55/gettoit/issues/194) | done 2026-05-21 |

### Tracer-bullets

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| tb-WF-1 | [[issues/tb-wf-1-plans-table-schema\|Plans table + lifecycle schema + Plan store]] | AFK | [#160](https://github.com/samfarls55/gettoit/issues/160) | done 2026-05-20 |
| tb-WF-2 | [[issues/tb-wf-2-quiz-back-exit-wire\|Wire Quiz Back + Exit chrome on iOS]] | AFK | [#161](https://github.com/samfarls55/gettoit/issues/161) | done 2026-05-20 |
| tb-WF-3 | [[issues/tb-wf-3-s04-timer-sweep-ios\|S04 timer sweep — iOS port (retire TimerCoordinator)]] | AFK | [#162](https://github.com/samfarls55/gettoit/issues/162) | done 2026-05-19 |
| tb-WF-4 | [[issues/tb-wf-4-wire-plan-setup-surface\|Wire Plan setup surface — replaces S01 + S01b]] | AFK | [#163](https://github.com/samfarls55/gettoit/issues/163) | done 2026-05-20 |
| tb-WF-5 | [[issues/tb-wf-5-plan-list-solo-cycle\|iOS Plan list — Solo creation cycle (foundation)]] | AFK | [#174](https://github.com/samfarls55/gettoit/issues/174) | done 2026-05-20 |
| tb-WF-6 | [[issues/tb-wf-6-plan-list-group-disambig\|iOS Plan list — Group creation + FAB + disambig sheet]] | AFK | [#175](https://github.com/samfarls55/gettoit/issues/175) | done 2026-05-20 |
| tb-WF-7 | [[issues/tb-wf-7-plan-list-joiner-resume\|iOS Plan list — Joiner journey (JOINED chip + resume-from-state)]] | AFK | [#176](https://github.com/samfarls55/gettoit/issues/176) | done 2026-05-20 |
| tb-WF-8 | [[issues/tb-wf-8-plan-list-decided-history\|iOS Plan list — Decided + History sections + lifecycle transitions]] | AFK | [#177](https://github.com/samfarls55/gettoit/issues/177) | done 2026-05-20 |
| tb-WF-9 | [[issues/tb-wf-9-plan-list-destructive-actions\|iOS Plan list — Three-dot menu + delete + leave]] | AFK | [#178](https://github.com/samfarls55/gettoit/issues/178) | done 2026-05-20 |
| tb-WF-10 | [[issues/tb-wf-10-web-quiz-v11-port\|Web quiz v1.1 port + shared votes-wire extraction]] | AFK | [#190](https://github.com/samfarls55/gettoit/issues/190) | done 2026-05-21 |
| tb-WF-11 | [[issues/tb-wf-11-web-invitee-shell-foundation\|Web invitee shell foundation — landing, name entry, members.display_name]] | AFK | [#192](https://github.com/samfarls55/gettoit/issues/192) | done 2026-05-21 |
| tb-WF-12 | [[issues/tb-wf-12-web-invitee-shell-reclick\|Web invitee shell re-click behaviors — resume, read-only, leave]] | AFK | [#193](https://github.com/samfarls55/gettoit/issues/193) | done 2026-05-21 |
| tb-WF-13 | [[issues/tb-wf-13-claim-code-mint\|Claim code mint side — claim_codes table + mint edge function + web affordance]] | AFK | [#195](https://github.com/samfarls55/gettoit/issues/195) | done 2026-05-21 |
| tb-WF-14 | [[issues/tb-wf-14-claim-code-redeem\|Claim code redeem side — redeem edge function + S00a code entry + linkApple]] | AFK | [#196](https://github.com/samfarls55/gettoit/issues/196) | sg-WF-8, tb-WF-13 |

### Dependency notes

- **sg-WF-6** merged 2026-05-21 (PR #201) — reroll-window deadline + server guard; see the reroll-window note below. **sg-WF-7** was grilled 2026-05-21 (claim-code bridge — see the web invitee flow note below); sg-WF-5 was also grilled 2026-05-21.
- **tb-WF-2** consumes sg-WF-2 (Quiz Back+Exit chrome spec) — done.
- **tb-WF-3** consumes sg-WF-3 (S04 timer sweep spec) — done.
- **tb-WF-4** consumed sg-WF-1 (Setup spec) + tb-WF-1 (Plans table). Amended 2026-05-20 to fold in the Q7 lift-out (solo/group mode-conditional rendering, 5/6 controls); merged 2026-05-20. The retired `InitiatorScreen.swift` + `ParametersScreen.swift` (and their tests) are deleted; the design-system JSX for the superseded surfaces stays in the tree as spec history. `Save for later` lands on S00 Landing until tb-WF-5 wires the iOS Plan list.
- **tb-WF-5** is the foundation iOS port for the Plan list. Merged 2026-05-20 — landed `PlanListScreen.swift` (empty hero state + populated 1-line Pending cards + temp top-trailing `+` chrome), `PlansStore.plansForList(userID:)`, and retired `LandingScreen.swift`. Settings access from the Plan list is a known follow-up — the legacy `LandingScreen` was the only entry to `showingSettings`.
- **tb-WF-6** merged 2026-05-20 — landed the C-26 FAB iOS port (`FloatingActionButton.swift`), the Solo/Group disambig sheet (`PlanDisambigSheet.swift`), and unified the create entries on the Plan list. Retired the temp top-trailing `+` chrome from tb-WF-5; both the FAB and the empty-state hero pill now route through the same disambig sheet, which picks Solo or Group and forwards to Setup in the chosen mode. The location pre-prime path now carries the user's disambig choice through `pendingDisambigGroupMode` so a first-launch group user lands in `.group` Setup after S00b, not `.solo`.
- **tb-WF-7** merged 2026-05-20 (PR #184) — landed the joiner journey end-to-end: JOINED eyebrow chip in `GTIColor.sun` on Joined cards, `PlanListScreen.routeFor(joinedRow:)` resume-from-state helper covering all 5 §Q8 destinations, batched `PlansStore.joinedPlansForList` RPC with per-joiner `last_answered_question_index` + `has_voted` projected inline, server-side persistence on `members.quiz_progress` (new jsonb column + `members_progress_upsert` RPC), and `QuizCoordinator(initialProgress:)` hydration so a backgrounded mid-quiz session resumes at the last-answered question with Q1..Q4 answers intact. Known limitation: a resume into Q5 lands the user on Q5 but the Q5 candidate set fires fresh on the next advance (the resume host uses the legacy `candidates:` init without a `candidateFetch`).
- **tb-WF-8** merged 2026-05-20 (PR #186) — landed the Decided + History sections end-to-end: `plans.verdict_fired_at` + `plans.expired_at` sort-key columns; `set_plan_decided_active` amended to stamp `verdict_fired_at`; new `set_plan_decided_expired` SECURITY DEFINER function with three event paths converging on it (per-minute `cron_expire_reroll_windows` worker, AFTER INSERT trigger on `rerolls` for 3rd-burn, AFTER INSERT trigger on `check_ins` for any outcome); two new RPCs (`plans_decided_for_user` + `plans_history_for_user`) inline the verdict's place name and project a `role` column so the iOS surface can render the JOINED chip + tap-route without an N+1 lookup; iOS PlanListScreen renders 2-line cards with `sortedDecided` / `sortedHistory` pure helpers, the History section is collapsible with per-user UserDefaults persistence (state held in a small `@Observable` class for unit-test friendliness), and a new `DecidedHistoryTapDestination` router mounts the full or read-only VerdictScreen per surface §"Tap behavior". The exact "23:59:59 next-calendar-day search-area-TZ" reroll-window deadline computation was sg-WF-6's territory — landed 2026-05-21 (PR #201), which replaced the tb-WF-1 `now() + interval '2 days'` placeholder; this slice's cron worker honours whatever `reroll_window_closes_at` carries.
- **tb-WF-9** merged 2026-05-20 (PR #188) — landed the destructive-action C-25 Action Dot Menu (custom popover primitive, NOT SwiftUI `Menu` so destructive items render in the same white-on-glass register with no red), the four-variant C-16 confirm sheet (`pendingDelete` / `decidedActiveDelete` / `historyDelete` / `joinedLeave` with locked copy from `surfaces/00-plan-list.md §"Confirm sheet copy (LOCKED)"`), and the end-to-end delete + leave journeys. `PlanDeleteCoordinator` flips `rooms.status='expired'` first (the existing session-ended broadcast joiners observe via `WaitingStore.RoomStatus.expired` from TB-07) then deletes the Plan; joiner leave reuses `MemberLeaveStore.leave(...)` from tb-WF-2. No new migration was needed — existing RLS (`plans_delete_creator`, `rooms_update_creator`, `members_delete_self`) covers authorization. With this merge the workflow-overhaul tracer-bullet sequence (tb-WF-1..9) is fully landed.

- **tb-WF-10** — web quiz v1.1 port + the `supabase/functions/_shared/votes-wire.ts` extraction. Filed 2026-05-21 from the sg-WF-5 grill; not blocked, but a delivery pair with the shell (tb-WF-11/12). Records [[../../60_engineering/adr/0014-web-consumes-shared-votes-wire|ADR 0014]] (web's first deliberate cross-sibling import).
- **tb-WF-11** consumes sg-WF-5 (the web invitee shell surface doc) — the shell foundation: `/join/<roomId>` scaffold, name entry, the additive `members.display_name` migration.
- **tb-WF-12** consumes tb-WF-11 — the re-click behaviors (resume / read-only / leave); adds no new schema or server code (reuses `members.quiz_progress`, the decided/history RPCs, and `members_delete_self`).

**Account-claim batch (decomposed from sg-WF-7, 2026-05-21).** The sg-WF-7 `/grill-with-docs` round was decomposed via `/to-issues` into 3 AFK issues — outcomes in [[../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]], architecture in [[../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].

- **sg-WF-8 done 2026-05-21** — the design-system amendment landed both halves in one slice (sg-WF-5 was already merged): `surfaces/00a-signin.md` gained the S00a "Voted on the web?" affordance + code-entry state (+ the two-state `ScreenSignIn.jsx`), and `surfaces/web-01-invitee-shell.md` gained the low-key "Getting the app?" mint affordance on the web Waiting screen (§B) + read-only verdict card (§C). TTL-honest copy per ADR 0006; no new component / token; `verify.mjs` + new `test-account-claim.mjs` green. tb-WF-13 / tb-WF-14 now have their spec contract.
- **tb-WF-13 done 2026-05-21** — the mint side landed end-to-end: the `claim_codes` table + migration `20260525000000000_claim_codes.sql` (service-role-only RLS — RLS on, no policies, `anon`/`authenticated` grants revoked, the `app_config` lock pattern), the `mint-claim-code` Edge Function (JWT-authed, 8-char unambiguous code, AES-GCM-encrypted refresh token, PK-collision retry, re-mintable), and the web `GettingTheAppAffordance` (lazy mint on tap) wired onto the web Waiting screen + §C read-only verdict card. Encryption is application-layer in a shared `_shared/claim-code.ts` helper so tb-WF-14's redeem side reuses it — see [[../../60_engineering/claim-code-mint-encryption|claim-code-mint-encryption]]. The live function needs a `CLAIM_CODE_ENC_KEY` repo secret (`openssl rand -base64 32`); the CI edge-deploy lane pushes it when present and warns when absent. tb-WF-14 (redeem side) now has its server-side contract.
- **tb-WF-14** consumes sg-WF-8 + tb-WF-13 — the redeem side: the `redeem-claim-code` edge function, S00a code entry, and iOS redeem → keychain → the existing `linkApple` path. The Apple round-trip itself is TestFlight-verified, not CI.

With sg-WF-6 grilled, no HITL issues remain in the phase.

**Web invitee flow (grilled 2026-05-21).** The sg-WF-5 follow-up `/grill-with-docs` round locked the web invitee single-link flow — outcomes in [[../../50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]], with the cross-sibling vote-contract import recorded in [[../../60_engineering/adr/0014-web-consumes-shared-votes-wire|ADR 0014]]. `/to-issues` decomposed it into the surface-doc spec-gap (sg-WF-5) plus two shell-wiring tracer-bullets (tb-WF-11 → tb-WF-12), with a sibling quiz-port tracer-bullet (tb-WF-10) and a sibling HITL account-claim issue (sg-WF-7). **sg-WF-5 done 2026-05-21** — landed `design-system/surfaces/web-01-invitee-shell.md`, the first `web-NN-*` namespaced surface doc (web-only; no design-system `code/screens/` JSX — its JSX is built in `web/` by tb-WF-11/12). tb-WF-10/11/12 remain `ready-for-agent`.

**Web invitee account claim (grilled 2026-05-21).** The sg-WF-7 follow-up `/grill-with-docs` round locked the cross-context identity bridge — outcomes in [[../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]], architecture in [[../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]]. A single-use claim code carries the browser anonymous session into the freshly-installed app *before* Apple sign-in, so the existing S00a `linkApple` path upgrades it (zero row migration). Same-device + before-sign-in only; after-sign-in recovery deferred to a future feature. Next step: `/to-issues` decomposition into a sg → tb pair (the web-side build slice sequences after tb-WF-11 / tb-WF-12).

**Reroll window deadline (merged 2026-05-21, PR #201).** The sg-WF-6 `/grill-with-docs` round resolved the enforcement *how* — outcomes in [[../../60_engineering/adr/0016-plan-reroll-window-enforcement|ADR 0016]] and the [[../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] §Q9 amendment — and sg-WF-6 landed it. The new migration `20260523000000000_reroll_window_deadline.sql` amends `set_plan_decided_active` to the search-area-TZ `date_trunc('day', now() AT TIME ZONE tz) + interval '2 days' - interval '1 second' AT TIME ZONE tz` deadline (tb-WF-1 placeholder removed) and adds the time-exact `{"error":"window_closed"}` guard to `apply_reroll` (null-`plan_id` rooms pass through). The deadline formula is ported to `supabase/functions/_shared/reroll-window.ts` so the Deno lane exercises the math end-to-end. iOS: `PlansStore.fetchPlanStatus(planID:)` + a pure `PlanListScreen.tapRoute(role:status:)` overload — the Decided-card tap path re-resolves the Plan's live `status` so a closed-window Plan routes to the read-only verdict screen. The tb-WF-8 three-way close (cron / 3rd burn / check-in) is ratified unchanged. `design-system/surfaces/07-reroll.md` carries the additive reroll-window amendment. With this, no HITL items remain in the phase.

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
