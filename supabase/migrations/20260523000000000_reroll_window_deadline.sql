-- sg-WF-6 (workflow-overhaul) — Plan reroll-window deadline mechanism.
--
-- Two earlier tracer-bullets shipped around the reroll window before
-- the enforcement *how* was grilled:
--
--   * tb-WF-1 provisioned `plans.reroll_window_closes_at` and stamped
--     it with an explicit placeholder — `set_plan_decided_active`
--     writes `now() + interval '2 days'`.
--   * tb-WF-8 built the full three-way close on top of that placeholder
--     (per-minute `cron_expire_reroll_windows`, the 3rd-burn `rerolls`
--     trigger, the any-outcome `check_ins` trigger).
--
-- The `/grill-with-docs` session on 2026-05-21 resolved the three
-- open sub-decisions, recorded in ADR 0016
-- (`60_engineering/adr/0016-plan-reroll-window-enforcement.md`):
--
--   1. **Timezone anchor — search-area TZ.** The deadline is anchored
--      to the Plan's search-area IANA timezone
--      (`plans.location->>'timeZoneIdentifier'`), NOT the creator's
--      device timezone (never stored). UTC fallback when absent.
--   2. **Server-authoritative, time-exact close.** `apply_reroll`
--      rejects a reroll past the deadline, reading the deadline
--      directly so the per-minute cron's ~60s lag cannot admit a
--      stale reroll.
--   3. **Three-way close ratified as built.** The tb-WF-8 mechanism
--      stands unchanged — no work here.
--
-- This migration:
--
--   * Amends `set_plan_decided_active(uuid)` — replaces the
--     `now() + interval '2 days'` placeholder with the search-area-TZ
--     calendar-day computation. The window closes at 23:59:59 on the
--     calendar day AFTER the verdict fired, measured in the search
--     area's wall clock.
--   * Amends `apply_reroll(uuid, text, text, text, int)` — adds the
--     time-exact `window_closed` guard: a reroll is rejected when the
--     room's linked Plan is `decided-expired`, OR `decided-active` with
--     `reroll_window_closes_at <= now()`. Rooms with `plan_id IS NULL`
--     (legacy S01-path rooms) skip the check entirely.
--
-- References:
--   * gti-vault/15_issues/workflow-overhaul/issues/sg-wf-6-reroll-window-deadline.md
--   * gti-vault/60_engineering/adr/0016-plan-reroll-window-enforcement.md
--   * supabase/migrations/20260519000000000_workflow_overhaul_plans_table.sql
--     (tb-WF-1 — the placeholder this migration replaces)
--   * supabase/migrations/20260522000000000_plans_decided_history_lifecycle.sql
--     (tb-WF-8 — the verdict_fired_at stamp + three-way close this
--      migration leaves intact)
--   * supabase/migrations/20260514000300000_rerolls.sql
--     (TB-10 — the apply_reroll RPC the guard is added to)

-- ── 1. set_plan_decided_active — real search-area-TZ deadline ────────
-- Amends the tb-WF-8 function. The body keeps every prior behavior —
-- the idempotent `where status = 'pending'` gate, the
-- `verdict_fired_at = now()` stamp, the `updated_at = now()` stamp,
-- SECURITY DEFINER — and replaces ONLY the `reroll_window_closes_at`
-- computation.
--
-- The deadline formula (ADR 0016 §1):
--
--   v_area_tz := coalesce(plans.location->>'timeZoneIdentifier', 'UTC')
--   reroll_window_closes_at =
--       (date_trunc('day', now() AT TIME ZONE v_area_tz)
--          + interval '2 days' - interval '1 second') AT TIME ZONE v_area_tz
--
-- Reading the formula:
--   * `now() AT TIME ZONE v_area_tz` — the instant rendered as the
--     search area's wall clock (a `timestamp` without zone).
--   * `date_trunc('day', ...)` — midnight at the start of the search
--     area's current calendar day.
--   * `+ interval '2 days' - interval '1 second'` — 23:59:59 on the
--     NEXT calendar day (today's midnight + 2 days lands at the start
--     of the day-after-tomorrow; minus one second steps back to the
--     final second of tomorrow).
--   * `... AT TIME ZONE v_area_tz` — converts that wall-clock instant
--     back to a fixed `timestamptz`.
--
-- Because the result is a fixed instant, a later device-timezone
-- change does not move the deadline. The per-minute cron only ever
-- compares `reroll_window_closes_at <= now()`, so it needs no
-- timezone awareness.
--
-- The function already receives the plan id and reads
-- `plans.location` directly. The `v_area_tz` resolution and the
-- UPDATE run in one statement against the same row so a concurrent
-- location edit cannot interleave between the read and the write.

create or replace function public.set_plan_decided_active(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.plans p
        set status = 'decided-active',
            verdict_fired_at = now(),
            reroll_window_closes_at = (
                date_trunc(
                    'day',
                    now() at time zone coalesce(
                        p.location ->> 'timeZoneIdentifier', 'UTC'
                    )
                )
                + interval '2 days'
                - interval '1 second'
            ) at time zone coalesce(
                p.location ->> 'timeZoneIdentifier', 'UTC'
            ),
            updated_at = now()
        where p.id = p_plan_id
          and p.status = 'pending';
end;
$$;

comment on function public.set_plan_decided_active(uuid) is
    'tb-WF-1 (amended in tb-WF-8, then sg-WF-6) — pending → '
    'decided-active transition. Stamps verdict_fired_at = now() and '
    'computes the real reroll_window_closes_at: 23:59:59 on the '
    'calendar day AFTER the verdict fired, measured in the Plan''s '
    'search-area timezone (plans.location->>''timeZoneIdentifier'', '
    'UTC fallback). SECURITY DEFINER. Idempotent — re-invoke on a '
    'non-pending plan is a no-op.';

-- The grant from tb-WF-1 / tb-WF-8 carries over; re-issue it
-- defensively (the grant keys on the function signature, unchanged
-- here, but the re-issue keeps the migration self-contained).
revoke all on function public.set_plan_decided_active(uuid) from public;
grant execute on function public.set_plan_decided_active(uuid) to authenticated;

-- ── 2. apply_reroll — server-authoritative, time-exact window guard ──
-- Amends the TB-10 RPC. After the existing member check and before the
-- 3-cap check, the RPC now resolves the room's linked Plan and rejects
-- the reroll when the reroll window has closed (ADR 0016 §3).
--
-- The guard reads the deadline DIRECTLY — not the cron-maintained
-- `status` — so the ~60s lag between the deadline passing and the
-- per-minute cron flipping the row to `decided-expired` never admits a
-- stale reroll. The cron still performs the durable `status` flip
-- (that is what the Plan list + iOS fetch-on-appear read); it is just
-- not the reroll gate.
--
-- Reject conditions:
--   * The linked Plan's `status = 'decided-expired'` — the window is
--     definitively closed (whichever of the three-way-close paths got
--     there first).
--   * The linked Plan's `status = 'decided-active'` AND
--     `reroll_window_closes_at <= now()` — the deadline has passed but
--     the cron has not yet flipped the row.
--
-- Pass-through:
--   * `rooms.plan_id IS NULL` — a legacy S01-path room with no Plan.
--     No window applies; skip the check entirely.
--   * The Plan is `decided-active` and `reroll_window_closes_at` is in
--     the future (or NULL — defensive: a Plan with no deadline cannot
--     be "past" it).
--
-- Return shape: `{"error": "window_closed"}` — the same JSONB error
-- shape as the existing `cap_exhausted` / `not_a_member` returns, so
-- the iOS RerollStore consumes it through the existing error path.

create or replace function public.apply_reroll(
    p_room_id     uuid,
    p_reason      text,
    p_detail      text default null,
    p_diet_chip   text default null,
    p_new_vibe    int  default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller          uuid := (select auth.uid());
    v_room            public.rooms%rowtype;
    v_count           int;
    v_reroll_id       uuid;
    v_current_verdict public.verdicts%rowtype;
    v_existing_budget int;
    v_existing_walk   int;
    v_is_member       boolean;
    v_plan            public.plans%rowtype;
begin
    if v_caller is null then
        return jsonb_build_object('error', 'unauthenticated');
    end if;

    if p_reason not in ('cost', 'dist', 'mood', 'diet', 'avail') then
        return jsonb_build_object('error', 'invalid_reason', 'reason', p_reason);
    end if;

    select * into v_room from public.rooms where id = p_room_id;
    if not found then
        return jsonb_build_object('error', 'room_not_found');
    end if;

    -- Member-only — anyone in the room can reroll. (v2 may restrict to
    -- the initiator; v1 admits any member per the spec's "initiator-only
    -- reroll trigger" being a UI-level rule, not a server-side gate.
    -- TB-10's iOS surface only exposes the affordance on the initiator
    -- path; the RPC is generous so a future role widening doesn't need
    -- a migration.)
    select exists (
        select 1 from public.members
        where room_id = p_room_id
          and user_id = v_caller
    ) into v_is_member;

    if not v_is_member then
        return jsonb_build_object('error', 'not_a_member');
    end if;

    -- sg-WF-6 — server-authoritative reroll-window guard. The room's
    -- linked Plan owns the reroll window; a reroll past the window's
    -- deadline is rejected here, time-exactly, regardless of whether
    -- the per-minute cron has flipped the Plan's status yet.
    --
    -- Ordering note: this runs after the member check and before the
    -- 3-cap check. The placement is not load-bearing — any point
    -- before the `rerolls` INSERT is correct. It sits here so a
    -- non-member never even reaches the Plan lookup.
    if v_room.plan_id is not null then
        select * into v_plan from public.plans where id = v_room.plan_id;
        if found then
            if v_plan.status = 'decided-expired'
               or (
                    v_plan.status = 'decided-active'
                    and v_plan.reroll_window_closes_at is not null
                    and v_plan.reroll_window_closes_at <= now()
                  )
            then
                return jsonb_build_object('error', 'window_closed');
            end if;
        end if;
    end if;
    -- A NULL plan_id (legacy S01-path room) falls straight through —
    -- no Plan, no window, no guard.

    -- 3-cap check. The trigger is the belt; this is the suspender that
    -- surfaces a clean JSONB error rather than letting the iOS layer
    -- see a raw SQL exception.
    select count(*)::int into v_count
    from public.rerolls
    where room_id = p_room_id;

    if v_count >= 3 then
        return jsonb_build_object(
            'error', 'cap_exhausted',
            'count', v_count,
            'cap',   3
        );
    end if;

    -- Reason-specific input validation (the RPC accepts but doesn't
    -- require the per-reason params; we validate when the reason
    -- demands them).
    if p_reason = 'diet' and (p_diet_chip is null or length(p_diet_chip) = 0) then
        return jsonb_build_object('error', 'diet_chip_required');
    end if;
    if p_reason = 'mood' and (p_new_vibe is null or p_new_vibe < 0 or p_new_vibe > 4) then
        return jsonb_build_object('error', 'new_vibe_required');
    end if;

    -- Locate the current verdict for the room (needed for avail's
    -- excluded-option append). Null is fine for the other reasons —
    -- the engine just re-runs against the current state.
    select * into v_current_verdict from public.verdicts where room_id = p_room_id;

    -- Write the rerolls row. The trg_rerolls_cap trigger is the DB-
    -- layer 3-cap defense if the RPC's check above is ever short-
    -- circuited.
    insert into public.rerolls (room_id, user_id, reason, detail)
    values (p_room_id, v_caller, p_reason, p_detail)
    returning id into v_reroll_id;

    -- Per-reason mutations.
    if p_reason = 'cost' then
        -- Tighten budget by one tier below current effective MIN.
        -- Current effective = least(MIN(votes.q2_budget), existing override).
        select least(
            coalesce(min(q2_budget), 4),
            coalesce(v_room.budget_tier_override, 4)
        )::int
        into v_existing_budget
        from public.votes
        where room_id = p_room_id;

        update public.rooms
        set budget_tier_override = greatest(1, v_existing_budget - 1)
        where id = p_room_id;

    elsif p_reason = 'dist' then
        -- Reduce walk cap by 5, floor at 5.
        select least(
            coalesce(min(q3_walk_minutes), 30),
            coalesce(v_room.walk_minutes_override, 30)
        )::int
        into v_existing_walk
        from public.votes
        where room_id = p_room_id;

        update public.rooms
        set walk_minutes_override = greatest(5, v_existing_walk - 5)
        where id = p_room_id;

    elsif p_reason = 'mood' then
        -- Replace the caller's q4_vibe value. The votes table has no
        -- UPDATE policy for clients, but SECURITY DEFINER lets us
        -- bypass RLS for this one update on the caller's own row.
        update public.votes
        set q4_vibe = p_new_vibe
        where room_id = p_room_id and user_id = v_caller;

    elsif p_reason = 'diet' then
        -- Append the new dietary chip to the caller's q1_vetoes_extra.
        -- Uses array_append to keep idempotency of the RPC simple —
        -- if the caller already added the same chip we tolerate the
        -- duplicate; the engine's chip lookup is set-based.
        update public.votes
        set q1_vetoes_extra = array_append(coalesce(q1_vetoes_extra, '{}'::text[]), p_diet_chip)
        where room_id = p_room_id and user_id = v_caller;

    elsif p_reason = 'avail' then
        -- Append the current verdict's option_id to the excluded list,
        -- if a verdict exists with an option_id. If there's no current
        -- option_id (e.g. no_survivor), this is a no-op other than the
        -- rerolls row.
        if v_current_verdict.option_id is not null then
            update public.rooms
            set excluded_option_ids = array_append(
                coalesce(excluded_option_ids, '{}'::uuid[]),
                v_current_verdict.option_id
            )
            where id = p_room_id;
        end if;
    end if;

    -- Stamp the most-recent reroll reason on the room so the next
    -- compute-verdict run can read it.
    update public.rooms
    set last_reroll_reason = p_reason
    where id = p_room_id;

    -- Drop the current verdict so the next compute-verdict run can
    -- write a fresh row under the verdicts.room_id UNIQUE constraint.
    -- The FK cascade on option_cuts.verdict_id drops the prior cuts.
    -- We don't gate on existence — DELETE on no rows is a no-op.
    delete from public.verdicts where room_id = p_room_id;

    -- Reset the room back to verdict_ready=false so the iOS Realtime
    -- subscriber routes back to S04/S05 cleanly. Status flip: from
    -- 'verdict_ready' (or 'locked' if we ever admit reroll past
    -- lock — v1 does NOT — but be defensive) → 'firing' so the
    -- compute-verdict invocation has a fresh slate.
    update public.rooms
    set status = 'firing'
    where id = p_room_id
      and status in ('verdict_ready', 'firing');

    return jsonb_build_object(
        'status',              'rerolled',
        'reroll_id',           v_reroll_id,
        'reason',              p_reason,
        'count',               v_count + 1,
        'remaining',           greatest(0, 3 - (v_count + 1)),
        'last_reroll_reason',  p_reason
    );
end;
$$;

comment on function public.apply_reroll(uuid, text, text, text, int) is
    'TB-10 reroll RPC (amended in sg-WF-6). Validates caller is a room '
    'member, rejects a reroll past the linked Plan''s reroll window '
    '({"error":"window_closed"} — time-exact, reads '
    'reroll_window_closes_at directly so cron lag cannot admit a '
    'stale reroll; null-plan_id rooms skip the guard), enforces the '
    '3/room cap, writes the rerolls row, mutates state per the reason '
    'taxonomy (cost/dist/mood/diet/avail), drops the current verdict, '
    'and stamps rooms.last_reroll_reason. The downstream '
    'compute-verdict invocation reads the new state and writes a '
    'fresh verdict row with verdicts.reroll_reason set.';

revoke all on function public.apply_reroll(uuid, text, text, text, int) from public;
grant execute on function public.apply_reroll(uuid, text, text, text, int) to authenticated;
