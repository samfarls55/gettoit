---
issue: sg-WF-6
title: Reroll window deadline mechanism
status: done
type: AFK
feature: 0.1.0
github_issue: 159
created: 2026-05-19
grilled: 2026-05-21
adr: 0016
---

# sg-WF-6 — Reroll window deadline mechanism

## Parent

[[../../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] §Q9 — the Plan reroll window. The enforcement *how* was resolved by the `/grill-with-docs` session on 2026-05-21; outcomes are recorded in [[../../../60_engineering/adr/0016-plan-reroll-window-enforcement|ADR 0016]] and inlined into the §Q9 amendment. This issue is now a fully-specified AFK build slice.

## Locked decisions (from the grill)

1. **Timezone anchor — search-area TZ.** `reroll_window_closes_at` is anchored to the Plan's search-area timezone (`plans.location->>'timeZoneIdentifier'`), not the creator's device timezone (never stored). UTC fallback when absent.
2. **Server-authoritative, time-exact close.** `apply_reroll` rejects a reroll past the deadline, reading the deadline directly so the per-minute cron's ~60s lag cannot admit a stale reroll.
3. **Three-way close ratified as built.** The tb-WF-8 mechanism (per-minute `cron_expire_reroll_windows` worker + 3rd-burn `rerolls` trigger + any-outcome `check_ins` trigger, all converging on `set_plan_decided_expired`) stands unchanged. No work here.
4. **Client reflection — fetch-on-appear.** No Realtime subscription, no poll on `plans`. The Decided-card tap path resolves current Plan `status` at tap/appear time.

## Implementation scope

### 1. Migration — real deadline computation

A new migration sorting after `20260522000000000_plans_decided_history_lifecycle.sql`. Amend `set_plan_decided_active(uuid)` to replace the tb-WF-1 placeholder (`reroll_window_closes_at = now() + interval '2 days'`) with the search-area-TZ calendar-day computation:

```sql
-- v_area_tz := coalesce(plans.location->>'timeZoneIdentifier', 'UTC')
reroll_window_closes_at =
    (date_trunc('day', now() AT TIME ZONE v_area_tz)
       + interval '2 days' - interval '1 second') AT TIME ZONE v_area_tz
```

Keep the function `SECURITY DEFINER`, keep the idempotent `where status = 'pending'` gate, keep the `verdict_fired_at = now()` stamp tb-WF-8 added. The function already receives the plan id, so it reads `plans.location` directly.

### 2. Migration — server-authoritative reroll guard

Same migration. Amend `apply_reroll(uuid, text, text, text, int)` to reject a reroll when the room's linked Plan is past its window. After the existing member check and before the 3-cap check (ordering is not load-bearing — any point before the `rerolls` INSERT is fine):

- Resolve the room's `plan_id`. If `NULL` (legacy S01-path room, no Plan), skip the check entirely.
- Reject when the linked Plan's `status = 'decided-expired'`, **or** `status = 'decided-active'` AND `reroll_window_closes_at <= now()`.
- Return `{"error": "window_closed"}` — same JSONB error shape as the existing `cap_exhausted` / `not_a_member` returns.

### 3. iOS — fetch-on-appear

The Decided-card tap path must resolve the Plan's *current* `status` at tap/appear time (not from a possibly-stale list snapshot) so a Plan that expired since the list was last loaded routes to the read-only `VerdictScreen` — which already suppresses the reroll affordance — rather than the full one. No `VerdictScreen` API change is anticipated; confirm against `DecidedHistoryTapDestination` and the tb-WF-8 tap router.

### 4. design-system — S07 additive amendment

Add an additive amendment section to `design-system/surfaces/07-reroll.md` documenting:
- the **outer time bound** — the reroll window closes at end of the next calendar day (search-area TZ), independent of the burn budget;
- the **three-way close** — window close / 3rd burn / check-in, whichever first;
- what the verdict-screen reroll affordance shows once the window has closed (a `decided-expired` Plan opens the read-only verdict screen, which renders no reroll tertiary — distinct from the cap-exhausted `"No rerolls left"` edge case already documented).

Append a `CHANGELOG.md` line. The S07 friction model (3-burn cap, reason-as-constraint, initiator-only) is unchanged — this is purely additive.

## Acceptance criteria

- [ ] Migration amends `set_plan_decided_active` to the search-area-TZ deadline formula; the `reroll_window_closes_at` placeholder is gone.
- [ ] Migration amends `apply_reroll` with the time-exact `window_closed` guard; null-`plan_id` rooms pass through.
- [ ] `supabase/functions` Deno tests cover: the TZ formula (incl. a non-UTC zone and the UTC fallback), the guard rejecting an expired Plan, the guard rejecting a `decided-active` Plan past `reroll_window_closes_at`, and the null-`plan_id` passthrough.
- [ ] iOS Decided-card tap resolves current Plan `status` at tap time; an expired Plan routes to the read-only verdict screen.
- [ ] `design-system/surfaces/07-reroll.md` carries the additive amendment; `CHANGELOG.md` updated.
- [ ] `node design-system/scripts/verify.mjs` green.

## Adjacency flagged (NOT in scope)

The existing check-in feature has a latent inconsistency surfaced during the grill: `CheckinScreen` writes a terminal `snoozed` row for "Ask me later", and the `check_ins` `(room_id, user_id)` PK plus the iOS conflict-swallow mean the user can never replace it with a real outcome — the copy promises a re-ask the system never delivers. Pre-existing, unrelated to reroll windows. Should be filed as a separate bug, not fixed here.

## History

- **2026-05-19** — filed as HITL, `needs-triage`, pending a grill.
- **2026-05-21** — `/grill-with-docs` session resolved the timezone anchor, the server-authoritative guard, and the client-reflection rule; ratified the tb-WF-8 three-way close. Outcomes recorded in [[../../../60_engineering/adr/0016-plan-reroll-window-enforcement|ADR 0016]] and the §Q9 amendment. Re-triaged to `ready-for-agent` / AFK.

## Comments

- **2026-05-21** — done. AFK run on `afk/sg-WF-6` (PR #201). New migration `20260523000000000_reroll_window_deadline.sql` amends `set_plan_decided_active` to the search-area-TZ `date_trunc('day', now() AT TIME ZONE tz) + interval '2 days' - interval '1 second' AT TIME ZONE tz` deadline (placeholder removed) and adds the time-exact `{"error":"window_closed"}` guard to `apply_reroll` (null-`plan_id` rooms pass through). The deadline formula is also ported to `supabase/functions/_shared/reroll-window.ts` so the Deno lane can exercise the math end-to-end (non-UTC zone, UTC fallback, calendar-boundary, spring-forward DST). iOS: `PlansStore.fetchPlanStatus(planID:)` + a pure `PlanListScreen.tapRoute(role:status:)` overload — the Decided-card tap path re-resolves the Plan's live `status` at tap time, so a Plan whose window closed since the list loaded routes to the read-only verdict screen. `design-system/surfaces/07-reroll.md` carries the additive reroll-window amendment + CHANGELOG line. The check-in `snoozed` adjacency (flagged above, NOT in scope) is tracked separately as a 0.1.0 bug.
