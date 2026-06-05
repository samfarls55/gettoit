---
adr: 0016
title: Plan reroll-window enforcement â€” search-area TZ deadline, server-authoritative time-exact guard
status: accepted
date: 2026-05-21
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0016 â€” Plan reroll-window enforcement

## Status

Accepted â€” 2026-05-21. Outcome of the sg-WF-6 `/grill-with-docs` session. Implemented by sg-WF-6 (re-triaged from HITL to `ready-for-agent` / AFK the same day).

## Context

A `decided-active` Plan owns a **reroll window** â€” the interval during which its verdict may be replaced in place. The *what* was locked in [[../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] Â§Q9: the window closes at `23:59:59` on the calendar day *after* the verdict fired, and the Plan transitions to `decided-expired` on whichever happens first â€” window close, third reroll burn, or check-in completed.

Two earlier tracer-bullets built around this before the *how* was decided:

- **tb-WF-1** provisioned `plans.reroll_window_closes_at` and stamped it with an explicit placeholder â€” `set_plan_decided_active` writes `now() + interval '2 days'`. The migration comment defers the real computation to sg-WF-6.
- **tb-WF-8** built the full enforcement on top of that placeholder: a per-minute `cron_expire_reroll_windows` worker, an AFTER INSERT trigger on `rerolls` (3rd burn), an AFTER INSERT trigger on `check_ins` (any outcome), and the `set_plan_decided_expired` transition function â€” all three converging on `set_plan_decided_expired`.

So the enforcement *mechanism* shipped, but on a placeholder deadline, and three sub-decisions were never grilled: the timezone the deadline is anchored to, how the close is made authoritative, and how iOS reflects it. This ADR records those.

## Decision

### 1. Deadline anchored to the Plan's search-area timezone

`reroll_window_closes_at` is computed **once**, at the `pending â†’ decided-active` transition (inside `set_plan_decided_active`), and stored as a fixed `timestamptz`:

```sql
(date_trunc('day', now() AT TIME ZONE v_area_tz)
   + interval '2 days' - interval '1 second') AT TIME ZONE v_area_tz
```

`v_area_tz` is the Plan's **search-area** IANA timezone â€” `plans.location->>'timeZoneIdentifier'`, the zone the C-23 LocationPicker resolves from the placemark when the coordinate is committed. Fallback to `'UTC'` when the Plan has no location TZ (a Plan cannot fire a verdict without a location in practice, so the fallback is defensive only).

Because the value is a fixed instant, a device timezone change after the verdict does not move the deadline â€” and the per-minute cron only ever compares `reroll_window_closes_at <= now()`, so it needs no timezone awareness at all.

### 2. Three-way close ratified as built

The tb-WF-8 mechanism is ratified unchanged: the per-minute `cron_expire_reroll_windows` worker, the 3rd-burn `rerolls` trigger, and the `check_ins` trigger (which fires on the first check-in row from any member, any outcome â€” `went` / `skipped` / `snoozed` / `no_signal`). A check-in lands 12â€“24h post-verdict, by which point the meal has happened and a reroll is moot, so closing on any member's check-in of any outcome is harmless.

### 3. The close is server-authoritative and time-exact

`apply_reroll` gains a guard: a reroll is **rejected** (`{"error": "window_closed"}`, the same JSONB error shape as the existing `cap_exhausted`) when the room's linked Plan is either `decided-expired`, **or** `decided-active` with `reroll_window_closes_at <= now()`. Rooms with `plan_id IS NULL` (legacy S01-path rooms) skip the check â€” no window applies to them.

The guard reads the deadline **directly**, not the cron-maintained `status`, so the ~60s lag between the deadline passing and the cron flipping the row never admits a stale reroll. The cron still performs the durable `status` flip â€” that is what the Plan list and the iOS fetch-on-appear read â€” but it is not the reroll gate.

### 4. Client reflection: fetch-on-appear

iOS does **not** subscribe `plans` to Realtime and does **not** poll it. The Decided-card tap path resolves the Plan's *current* `status` at tap/appear time, so a Plan that expired since the list was last loaded routes to the read-only `VerdictScreen` (which already suppresses the reroll affordance) rather than the full one. If the window closes while the user is sitting on a full verdict screen, the stale REROLL button persists until the screen is re-opened â€” and a tap on it is cleanly rejected by the Â§3 guard.

## Why

- **Search-area TZ over device TZ.** The creator's device timezone is never stored; anchoring to it would need a new captured column and iOS write path. The search-area zone is already captured for free. For the overwhelmingly common near-home Plan the two are identical; for the rare cross-timezone Plan a few hours' difference inside a 24â€“31h window is immaterial, and the meal itself is in the search area.
- **Time-exact guard + cron, belt-and-suspenders.** A trigger cannot fire on a future wall-clock time, so a cron is unavoidable for the time-based close. But a per-minute cron has up to ~60s of lag; making the *reroll gate* read the deadline directly closes that gap without tightening the cron cadence.
- **fetch-on-appear over Realtime/poll.** The close happens ~24â€“31h after the verdict, at a moment no session is realistically open on that screen. The Â§3 server guard makes any client staleness purely cosmetic. Realtime would add a `plans` publication plus an ongoing channel subscription; a poll would burn a request every few seconds â€” both for an event that never needs sub-second latency.

## Considered options

- **Anchor the deadline to the creator's device timezone** â€” rejected. Not stored; would need new schema + iOS capture; gives no meaningful accuracy over the search-area zone for the common case.
- **Status-only reroll guard** (`status = 'decided-expired'`) â€” rejected. Leaves a ~60s window after the deadline where the cron has not yet flipped the row and a reroll slips through.
- **Realtime subscription on `plans` / poll while the verdict screen is open** â€” rejected. Ongoing connection or request cost for a close event that needs no latency, given the server guard already makes staleness harmless.

## Consequences

### Positive

- The reroll window is server-authoritative â€” a stale client, a direct RPC call, or the cron-lag race cannot reroll past the deadline.
- No new schema beyond amending two existing functions; no new iOS Realtime channel.
- The deadline is a fixed instant, immune to device-timezone drift.

### Negative / accepted tradeoffs

- A traveler's window tracks the destination's midnight, not their phone's. Accepted â€” the glossary already calls the window "acceptably asymmetric."
- The Plan list can show a Plan as `decided-active` for up to ~60s after its true deadline (cron lag). Cosmetic only â€” the reroll itself is gated time-exactly.
- A stale full-mode verdict screen can render a REROLL button after the window has closed. Cosmetic â€” a tap is rejected; re-opening the Plan routes to read-only.

## Implementation

Scope of sg-WF-6 (AFK):

- A new migration (sorting after `20260522000000000`) amends `set_plan_decided_active` to compute the search-area-TZ formula in place of the `now() + interval '2 days'` placeholder, and adds the time-exact guard to `apply_reroll`.
- iOS: the Decided-card tap path resolves current Plan `status` at tap/appear time. No `VerdictScreen` API change anticipated â€” read-only mode already suppresses the reroll affordance.

## References

- [[../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] Â§Q9 â€” the locked reroll-window decision (the *what*).
- [[../../15_issues/0.1.0/issues/sg-wf-6-reroll-window-deadline|sg-WF-6]] â€” the implementation issue.
- [[../../../CONTEXT|CONTEXT.md]] â†’ Plan reroll window â€” the canonical glossary term.
- `supabase/migrations/20260519000000000_workflow_overhaul_plans_table.sql` â€” tb-WF-1, the placeholder this ADR replaces.
- `supabase/migrations/20260522000000000_plans_decided_history_lifecycle.sql` â€” tb-WF-8, the enforcement mechanism this ADR ratifies.
- `supabase/migrations/20260514000300000_rerolls.sql` â€” TB-10, the `apply_reroll` RPC the guard is added to.
