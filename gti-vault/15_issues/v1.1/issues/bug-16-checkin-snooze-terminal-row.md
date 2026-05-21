---
issue: bug-16
title: Check-in "Ask me later" writes a terminal row; the real outcome can never be reported
status: needs-triage
type: HITL
github_issue: 197
created: 2026-05-21
prd: v1-prd
---

# bug-16 — Check-in "Ask me later" writes a terminal row

## Symptom

The S08 next-day check-in offers three options: `We went` / `We skipped` / `Ask me later`. "Ask me later" is meant as a snooze — `design-system/surfaces/08-checkin.md` says it "exists because users at 6:43 PM the next day might not be ready to answer truthfully. Forcing a binary at that moment corrupts the metric." The copy implies the user gets re-asked.

They never do. Worse: once a user taps "Ask me later", they can **never** report a real outcome for that verdict.

## Root cause

- `CheckinScreen.handleTap` routes every outcome except `.skipped` straight to `commit(...)`. `.snoozed` is not `.skipped`, so a snooze tap immediately writes a `check_ins` row with `outcome = 'snoozed'` via `SupabaseCheckinWriter.record`.
- `check_ins` has a primary key on `(room_id, user_id)` — exactly one row per user per room. `SupabaseCheckinWriter` swallows the `23505` unique-violation on any later write. So once the `snoozed` row exists, a subsequent `We went` / `We skipped` tap is a silent no-op.
- The check-in push is dispatched exactly once per verdict (`checkin_dispatches` PK blocks re-dispatch). Nothing re-prompts a snoozer.
- The no-signal sweeper (`cron_mark_no_signal_checkins`) writes `no_signal` only where **no** `check_ins` row exists. A snoozer already has a row, so they never roll to `no_signal` either — they are frozen as `snoozed`.

Net: "Ask me later" is a one-way terminal state. The copy promises a deferral the system never honors.

## Impact

- North-star metric (% of verdicts followed through on): a user who genuinely went or skipped but tapped snooze first is permanently excluded from both the numerator and the denominator. `snoozed` and `no_signal` are metric-excluded by design — but `snoozed` is supposed to be a *temporary* state, not a sink.
- Pre-existing since TB-14 (v1). Surfaced during the sg-WF-6 `/grill-with-docs` session on 2026-05-21 — the tb-WF-8 `check_ins` AFTER INSERT trigger that closes the reroll window also fires on a `snoozed` row (harmless for the reroll window, since the meal is over by check-in time, but it exposed the snooze write path).

## Fix fork (needs triage)

Two coherent directions:

- **A — Make snooze genuinely deferrable.** "Ask me later" does not write a `check_ins` row; it re-arms a check-in dispatch (or dismisses and a re-prompt mechanism is added). The user can still report `went` / `skipped` later. Requires a re-prompt path — the current scheduler fires once per verdict.
- **B — Accept the terminal state, fix the copy.** Keep the immediate `snoozed` write but rename the option so it stops promising a re-ask (a "Skip" / "Not this time" register). Cheapest and honest; loses the "snooze is cheaper than a wrong answer" property the S08 spec values.

A honors the locked S08 intent; B is a one-surface copy change. Recommendation deferred to triage.

## Acceptance criteria (after triage)

- [ ] Fork resolved; `design-system/surfaces/08-checkin.md` reconciled with the chosen behavior.
- [ ] If A: snooze no longer writes a terminal `check_ins` row; a snoozer can later report `went` / `skipped`; the re-prompt path (or its deliberate absence) is specified.
- [ ] If B: the option copy no longer implies a re-ask; the S08 copy register is updated.
- [ ] `node design-system/scripts/verify.mjs` green if any design-system file is touched.

## References

- `design-system/surfaces/08-checkin.md` — S08 spec ("Three options (not yes/no)").
- `ios/Sources/App/CheckinScreen.swift` — `handleTap` / `SupabaseCheckinWriter.record`.
- `supabase/migrations/20260514000400000_checkins_and_events.sql` — `check_ins` schema (`(room_id, user_id)` PK).
- `supabase/migrations/20260514000430000_checkin_no_signal_sweeper.sql` — the no-signal sweeper.
- Surfaced during the sg-WF-6 grill (2026-05-21) — flagged as an adjacency in [[sg-wf-6-reroll-window-deadline|sg-WF-6]].
