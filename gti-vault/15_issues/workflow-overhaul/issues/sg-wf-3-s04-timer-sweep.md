---

issue: sg-WF-3
title: S04 timer sweep — finalize removal beyond the stale marker
status: done
type: AFK
feature: workflow-overhaul
github_issue: 156
created: 2026-05-19
closed: 2026-05-19
---

# sg-WF-3 — S04 timer sweep

## Parent

[[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] — surfaced during the grill that `design-system/surfaces/04-waiting.md` is partially stale: it still describes a timer countdown + `"Auto-fires in 7:42"` mono-tag + `rooms.deadline_at` cron-auto-fire mechanism that the v1.1 quiz redesign PRD (US34, US35, §line 115) explicitly retired on 2026-05-15.

A `partially-superseded-by` frontmatter marker + a top-of-file banner already landed in S04 on 2026-05-19 as part of the grill. **This issue completes the sweep**: actually edits the doc + JSX to remove the dead sections.

The iOS port (deleting `TimerCoordinator.swift`, removing the countdown rendering, dropping the `rooms.deadline_at` / cron-fire pieces) is **tb-WF-3**, a separate tracer-bullet that consumes this spec.

## What to build

A design-system edit pass on `design-system/surfaces/04-waiting.md` and `design-system/code/screens/ScreenWaiting.jsx` that:

1. **Deletes the retired sections** rather than leaving them stale-marked:
   - The `Countdown timer (all members)` section in the surface doc.
   - The timer-elapse branch of `Verdict fire trigger`.
   - The `Timer expiry no-quorum edge case`.
   - The `"Auto-fires in 7:42"` mono-tag rendering in the JSX.
   - The copy `"Auto-fires in 7:42"`.

2. **Rewrites the verdict fire trigger section** to reflect the v1.1 canonical model:
   - **(a) All participants have submitted Q5** (auto-fire on quorum-completion), or
   - **(b) Initiator manually closes voting** via the `Decide now` CTA (the CTA survives, may be relabeled — see [[../../../CONTEXT|CONTEXT.md]] → `Verdict trigger`).
   - Minimum quorum is one member (the initiator alone in the edge case where nobody else responds).

3. **Removes / replaces the no-quorum edge case** — there is no timer to expire, so the "couldn't reach quorum tonight" terminal is unreachable via timer. The only path to a no-survivor outcome is the new `bug-13`/`tb-WF` empty-pool engine wedge handling, which is out of scope for this issue. Document that the timer-expiry edge case is retired; leave the no-survivor terminal in place for the engine-side `no_survivor` resolution path.

4. **Drops the `partially-superseded-by` + `stale-sections` frontmatter markers and the top-of-file banner** once the sections they pointed at are removed. Restores the file to `status: locked` with a refreshed `locked-date: 2026-05-19`.

5. **Update `CHANGELOG.md`** with a one-line BREAKING entry (the timer + countdown were a documented user-visible behavior; their removal is breaking).

### Files to edit

- `design-system/surfaces/04-waiting.md` — delete retired sections, rewrite verdict-trigger section, drop the stale-markers + banner, refresh `locked-date`.
- `design-system/code/screens/ScreenWaiting.jsx` — delete the countdown mono-tag, the `"Auto-fires"` copy line, any timer-tick state, and any conditional rendering keyed on timer expiry.
- `design-system/CHANGELOG.md` — `BREAKING: ...` entry.
- Run `node design-system/scripts/verify.mjs`.

### Out of scope

- iOS port (deleting `TimerCoordinator.swift`, etc.) — tb-WF-3.
- `rooms.timer_minutes` / `rooms.deadline_at` schema cleanup — future workflow-overhaul slice (can be additive — leave the columns, mark unused).
- Any change to the `Decide now` CTA's name or label — the v1.1 PRD allows for a rename, but this issue doesn't change it (rename happens in a separate copy pass).

## Acceptance criteria

- [ ] `surfaces/04-waiting.md` no longer contains the `Countdown timer (all members)`, `Timer expiry no-quorum edge case`, or timer-elapse branch of `Verdict fire trigger`.
- [ ] `surfaces/04-waiting.md` documents the v1.1 verdict trigger (all-Q5 OR initiator-closes-voting) as the canonical rule.
- [ ] `ScreenWaiting.jsx` no longer renders the countdown mono-tag, the `"Auto-fires"` copy, or any timer-tick state.
- [ ] The `partially-superseded-by` + `stale-sections` frontmatter and the top-of-file banner are removed from `surfaces/04-waiting.md` once the retired sections are gone. `locked-date` refreshed to `2026-05-19`.
- [ ] `CHANGELOG.md` carries a `BREAKING:` entry.
- [ ] `node design-system/scripts/verify.mjs` is green.

## Blocked by

None — the v1.1 PRD ruling has been canonical since 2026-05-15; this issue is overdue cleanup.

## Comments

- **2026-05-19 — done (afk/sg-wf-3, PR #TBD).** Surface doc `surfaces/04-waiting.md` had the `Countdown timer (all members)` section, the timer-elapse branch of `Verdict fire trigger`, the `Timer expiry no-quorum edge case`, the `partially-superseded-by` + `stale-sections` frontmatter and the top-of-file banner all removed. `Verdict fire trigger` rewritten to the v1.1 canonical model (all-Q5 OR initiator-closes-voting); minimum quorum documented as one member; the `Decide now` CTA is now always tappable for the initiator (no `need 2 in` gate). `locked-date` refreshed to `2026-05-19`. `ScreenWaiting.jsx` lost the `secondsRemaining` prop, the `countdownLabel` binding, the mono-tag render, and the `quorum >= 2` gate on the Decide-now PillCTA. `motion.md` lost the `Waiting countdown tick` row and the `Decide-now CTA quorum unlock` row (the always-tappable CTA has no quorum unlock to animate) — flagged as an adjacency in the PR. `CHANGELOG.md` carries a BREAKING entry. `node design-system/scripts/verify.mjs` is green. iOS port remains tb-WF-3 (#162); `rooms.timer_minutes` / `rooms.deadline_at` schema cleanup remains out of scope.
