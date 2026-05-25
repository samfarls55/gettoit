---
issue: tb-13
title: Verdict firing on the new Q5-complete signal
status: done
type: AFK
github_issue: 74
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

# tb-13 — Verdict firing on Q5-complete

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] — verdict-firing user stories (33-36). Not a labelled PRD module; small slice re-pointing the existing firing mechanism.

## What to build

Re-point the existing verdict-firing mechanism (the 0.1.0 close-voting control, auto-fire-on-all-complete, and solo-verdict paths — `verdict-engine-solo.test.ts` already exists) at the **new quiz's "completed Q5" signal**. The verdict fires when all participants complete Q5, or when the initiator closes voting — no timer, no shot clock. A dead session with only the initiator still resolves.

## Acceptance criteria

- [ ] The verdict fires automatically once all participants have completed Q5.
- [ ] The initiator's "close voting" control produces the verdict without waiting on a straggler.
- [ ] A solo session (initiator alone) still produces a verdict.
- [ ] There is no shot clock or timer on the quiz.
- [ ] Tests cover all-complete auto-fire and solo firing on the new Q5-complete signal.

## Blocked by

- [[tb-08-q5-factorial-probe|tb-08]] — defines the Q5-complete signal.
- [[tb-11-verdict-engine-rewrite|tb-11]] — the verdict the firing path triggers.

## Comments

**2026-05-16 — done (AFK, branch `afk/tb-13`, PR #88).** Re-pointed the
verdict-firing mechanism off the 0.1.0 timer / shot-clock / minimum-quorum
path onto the 0.1.0 Q5-complete signal.

- **Pure predicate** — `supabase/functions/_shared/verdict-firing.ts`
  (`decideFiring`) is the canonical, fixture-tested statement of *when*
  a verdict fires. `FiringInput` carries no time field by construction
  — the absence of a deadline channel is the 0.1.0 "no shot clock"
  contract, and a test asserts the shape has exactly three keys as a
  regression guard. Two fire signals: all-participants-complete
  auto-fire (`method = "quorum"`) and the initiator's close-voting
  control (`method = "manual"`). No minimum quorum; a solo room fires
  on either signal.
- **Migration** — `20260515020000000_verdict_fire_on_q5_complete.sql`
  mirrors the predicate at the DB layer. Unschedules the per-minute
  `gettoit_verdict_auto_fire` timer cron (a leftover timer cron would
  expire a live 0.1.0 room whose members simply haven't finished the
  quiz). Re-points the `AFTER INSERT ON votes` trigger to auto-fire on
  all-members-Q5-complete via a new `count_q5_complete_members(room)`
  helper, dropping the `deadline_at <= now()` time channel and the
  two-vote minimum quorum. Rewrites `fire_verdict` as the initiator's
  close-voting RPC with the quorum gate removed (solo resolves).
- **Decision — firing predicate extracted as pure TypeScript, not
  pgTAP.** CI runs `deno test` over `supabase/functions/` but has no
  SQL test lane. The pure predicate is the testable, canonical home for
  the firing contract; the SQL trigger / RPC mirror it. Same pattern as
  `verdict-engine.ts` vs the verdict-fire migration.
- **Decision — "completed Q5" = a `regret`-kind votes slot.** A quiz
  submit inserts the `votes` row; the Q5 probe (tb-08) writes a
  `regret`-kind slot. `count_q5_complete_members` joins `members` to
  `votes` so a stale vote from a departed member never counts toward
  all-complete.
- **Decision — `dispatch_compute_verdict` gained a 2-arg overload**
  that forwards a `method` body field so the durable `verdicts.method`
  reflects how the fire happened (`quorum` vs `manual`); the 1-arg form
  is retained for the orphaned cron function.
- **Decision — timer columns left in place.** `rooms.timer_minutes` /
  `rooms.deadline_at` are now inert but not dropped — `fetch_read_only_verdict`
  still reads `timer_minutes` and dropping columns is out of scope.
  Only the timer *firing* path is retired.
- **iOS test fallout.** `FireVerdictIntegrationTests` encoded the 0.1.0
  quorum contract: `testBelowQuorumRejectsWithRoomStillOpen` (the
  `below_quorum` reject is gone) and `testInitiatorWithQuorumFlipsRoomToFiring`
  (two votes now auto-fire before the RPC is called). Both were
  re-pointed onto the 0.1.0 contract — solo close-voting, all-complete
  auto-fire, and close-voting-without-a-straggler. The straggler tests
  join the second member *before* the initiator votes so the room has
  two members when the first vote lands (otherwise a solo room
  auto-fires on that single member).
- **Tests.** 13 new pure `deno test` cases in `verdict-firing.test.ts`;
  the full `edge` lane is green (169 cases). The `ios` lane's
  FireVerdict integration suite is green on the 0.1.0 contract.
