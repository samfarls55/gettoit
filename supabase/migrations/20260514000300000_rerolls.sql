-- TB-10 — rerolls schema + reason-to-constraint plumbing + apply_reroll RPC.
--
-- The reroll surface is the friction-bearing correctability path on
-- S05. A reroll must (a) cost a slot (capped at 3/room), (b) state a
-- reason from a fixed taxonomy, and (c) translate that reason into a
-- mechanical change to the next engine run. This migration lands the
-- durable plumbing for all three.
--
-- Tables:
--   * `rerolls` — one row per reroll attempt. Enforces the 3/room cap
--     via an AFTER INSERT trigger (counts existing rows, raises an
--     exception if > 3). The cap is server-authoritative — clients
--     can't bypass it by tampering with the count.
--
-- New columns:
--   * `votes.q1_vetoes_extra text[]` — additional Q1 dietary chips
--     appended after the initial vote, sourced from `diet`-reason
--     rerolls. Lets the apply_reroll RPC add an EBA veto for the
--     initiating user without breaking the "votes are write-once"
--     invariant (the original q1_vetoes column stays immutable).
--     The engine reads BOTH columns and merges.
--   * `rooms.budget_tier_override int` — engine-applied cap below the
--     member-derived MIN(q2_budget). Set by `cost` rerolls. Each
--     `cost` reroll decrements the override by 1 (floored at 1).
--   * `rooms.walk_minutes_override int` — engine-applied cap below the
--     member-derived MIN(q3_walk_minutes). Set by `dist` rerolls.
--     Each `dist` reroll subtracts 5 from the current effective MIN
--     (floored at 5).
--   * `rooms.excluded_option_ids uuid[]` — option ids the engine must
--     filter out of the candidate pool BEFORE pruning. Populated by
--     `avail` rerolls (current verdict's option is added) so the
--     re-run picks a different candidate.
--   * `verdicts.reroll_reason text` — set on the new verdict row written
--     after a reroll. The engine's rule_text generator reads this to
--     prefix the rule chip with the aggregate-reroll attribution
--     ("Cost reroll cut Pico's. Sushi Ren had the next-lowest regret.").
--
-- RPC:
--   * `apply_reroll(p_room_id uuid, p_reason text, p_detail text,
--                   p_diet_chip text, p_new_vibe int)` — SECURITY DEFINER.
--     Validates caller is a room member; enforces 3-cap; mutates state
--     per reason (q1_vetoes_extra append, budget_tier_override --,
--     walk_minutes_override -=5, q4_vibe update for caller, or the
--     current verdict's option_id appended to excluded_option_ids);
--     deletes the prior verdict (FK cascade drops option_cuts); returns
--     a JSONB shape the iOS RerollStore can consume:
--       {"status": "rerolled", "reroll_id": "...", "remaining": 2,
--        "reason": "cost", "last_reroll_reason": "cost"}
--     The downstream `compute-verdict` Edge Function invocation reads
--     the new state and writes the new verdict row with
--     `verdicts.reroll_reason = last_reroll_reason`.
--
-- Why the cap is enforced inside the RPC AND a trigger:
--   * The RPC's authentication-aware check returns a clean JSONB error
--     for the iOS surface (3-cap exceeded → `{"error":"cap_exhausted"}`).
--   * The trigger is the belt-and-suspenders defense: a bypass attempt
--     via direct INSERT (e.g. a hypothetical service-role-key leak)
--     still trips at the DB layer.
--
-- Why all dietary chips are private:
--   * Per verdict-screen-spec §"Copy register" and verdict-engine.md
--     §"Anonymization rules", the diet reroll never names the chip in
--     the rule chip. The handler prefix surfaces "Diet reroll cut
--     Pico's" without naming the chip. The chip is stored in
--     `q1_vetoes_extra` for the engine, but is anonymized in any
--     surface copy.

-- ── rerolls ──────────────────────────────────────────────────────────
create table if not exists public.rerolls (
    id          uuid        primary key default gen_random_uuid(),
    room_id     uuid        not null references public.rooms (id) on delete cascade,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    reason      text        not null
        check (reason in ('cost', 'dist', 'mood', 'diet', 'avail')),
    detail      text,
    created_at  timestamptz not null default now()
);

comment on table public.rerolls is
    'TB-10 — one row per reroll attempt. Capped at 3 per room (enforced by the trg_rerolls_cap trigger AND by the apply_reroll RPC). Reason taxonomy: cost · dist · mood · diet · avail. detail is the optional one-line note shown to the group on the next verdict.';

create index if not exists rerolls_room_id_idx on public.rerolls (room_id);
create index if not exists rerolls_room_id_created_at_idx on public.rerolls (room_id, created_at);

-- ── 3-cap trigger (belt-and-suspenders) ──────────────────────────────
-- The apply_reroll RPC enforces the cap with a clean JSONB error for
-- the iOS surface; this BEFORE INSERT trigger is the DB-layer defense
-- against a direct write that bypasses the RPC.
create or replace function public.tg_rerolls_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_count integer;
begin
    select count(*)::int into v_count
    from public.rerolls
    where room_id = new.room_id;

    if v_count >= 3 then
        raise exception 'reroll cap exceeded for room %', new.room_id
            using errcode = '23514';
    end if;

    return new;
end;
$$;

comment on function public.tg_rerolls_cap() is
    'TB-10 BEFORE INSERT trigger on rerolls. Enforces the 3-per-room cap at the DB layer. Raises 23514 check_violation when the 4th attempt lands.';

drop trigger if exists trg_rerolls_cap on public.rerolls;
create trigger trg_rerolls_cap
    before insert on public.rerolls
    for each row
    execute function public.tg_rerolls_cap();

-- ── RLS on rerolls ───────────────────────────────────────────────────
alter table public.rerolls enable row level security;

-- Room members can read every reroll for their room — the next verdict
-- surfaces the reroll's reason + detail to the group.
drop policy if exists "rerolls_select_room_members" on public.rerolls;
create policy "rerolls_select_room_members" on public.rerolls
    for select
    to authenticated
    using (
        room_id in (
            select m.room_id from public.members m
            where m.user_id = (select auth.uid())
        )
    );

-- No client-side INSERT / UPDATE / DELETE policies — the apply_reroll
-- RPC is the only sanctioned write path. RLS denies direct writes by
-- default (no INSERT policy = no inserts admitted for `authenticated`).
-- The RPC runs SECURITY DEFINER so it can bypass RLS for its own
-- writes; clients invoke it via PostgREST RPC.

-- ── New columns on existing tables ───────────────────────────────────

-- votes.q1_vetoes_extra: per-user dietary chips appended after the
-- initial vote, sourced from diet-reason rerolls. The engine reads
-- BOTH q1_vetoes and q1_vetoes_extra and merges before applying.
-- Default '{}' so existing rows have a sane value; the RPC writes new
-- entries via array_append.
alter table public.votes
    add column if not exists q1_vetoes_extra text[] not null default '{}';

comment on column public.votes.q1_vetoes_extra is
    'TB-10 — additional Q1 dietary chips appended via the apply_reroll RPC after a diet-reason reroll. Engine merges with q1_vetoes before pruning. Keeps the original quiz answer immutable.';

-- rooms.budget_tier_override: caller-tightened budget cap below the
-- member-derived MIN(q2_budget). Null means "no override". Each cost
-- reroll decrements this by 1 (floor 1).
alter table public.rooms
    add column if not exists budget_tier_override int
        check (budget_tier_override is null or budget_tier_override between 1 and 4);

comment on column public.rooms.budget_tier_override is
    'TB-10 — engine-applied budget cap below the per-member MIN(q2_budget). Set by cost-reason rerolls. Null = no override. The engine uses MIN(member q2_budget, this).';

-- rooms.walk_minutes_override: caller-tightened walk-time cap below
-- the member-derived MIN(q3_walk_minutes). Floor 5. Null means
-- "no override". Each dist reroll subtracts 5 from current.
alter table public.rooms
    add column if not exists walk_minutes_override int
        check (walk_minutes_override is null or walk_minutes_override >= 5);

comment on column public.rooms.walk_minutes_override is
    'TB-10 — engine-applied walk-time cap below the per-member MIN(q3_walk_minutes). Set by dist-reason rerolls. Floor 5. Null = no override.';

-- rooms.excluded_option_ids: option ids removed from the candidate pool
-- BEFORE pruning. Populated by avail-reason rerolls.
alter table public.rooms
    add column if not exists excluded_option_ids uuid[] not null default '{}';

comment on column public.rooms.excluded_option_ids is
    'TB-10 — option ids removed from the engine candidate pool before pruning. Set by avail-reason rerolls. Each entry is the option_id of a verdict the user rerolled away from.';

-- rooms.last_reroll_reason: persisted so the NEXT verdict run can read
-- it and stamp verdicts.reroll_reason. The apply_reroll RPC sets this;
-- compute-verdict reads it; once a new verdict lands it stays for the
-- next reroll cycle (or until the room is locked).
alter table public.rooms
    add column if not exists last_reroll_reason text
        check (last_reroll_reason is null or last_reroll_reason in ('cost', 'dist', 'mood', 'diet', 'avail'));

comment on column public.rooms.last_reroll_reason is
    'TB-10 — the reason of the most recent reroll on this room. Read by compute-verdict to stamp verdicts.reroll_reason for the rule chip. Null = clean run (no reroll yet).';

-- verdicts.reroll_reason: stamped on verdicts produced by a re-run
-- after a reroll. The engine's rule_text generator reads this to
-- prefix the rule chip with the aggregate-reroll attribution.
alter table public.verdicts
    add column if not exists reroll_reason text
        check (reroll_reason is null or reroll_reason in ('cost', 'dist', 'mood', 'diet', 'avail'));

comment on column public.verdicts.reroll_reason is
    'TB-10 — set by compute-verdict on verdicts produced after a reroll. Drives the rule_chip prefix ("Cost reroll cut Pico''s..."). Null = clean run / no reroll.';

-- ── apply_reroll RPC ─────────────────────────────────────────────────

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
    -- the initiator; the original admits any member per the spec's "initiator-only
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
    -- lock — the original does NOT — but be defensive) → 'firing' so the
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
    'TB-10 reroll RPC. Validates caller is a room member, enforces 3/room cap, writes the rerolls row, mutates state per the reason taxonomy (cost/dist/mood/diet/avail), drops the current verdict, and stamps rooms.last_reroll_reason. The downstream compute-verdict invocation reads the new state and writes a fresh verdict row with verdicts.reroll_reason set.';

revoke all on function public.apply_reroll(uuid, text, text, text, int) from public;
grant execute on function public.apply_reroll(uuid, text, text, text, int) to authenticated;
