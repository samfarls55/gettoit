-- TB-13 (v1.1) — re-point verdict firing onto the Q5-complete signal.
--
-- The v1.1 quiz redesign (PRD module H, user stories 33-36) retires
-- the v1 timer / shot-clock firing path entirely. v1 fired the
-- VerdictEngine on three coupled mechanisms, all defined in
-- `20260513224000000_verdict_fire_trigger_and_cron.sql`:
--
--   * `rooms.deadline_at` + a per-minute `pg_cron` job that fired the
--     engine when the deadline elapsed (or expired the room below
--     quorum).
--   * An `AFTER INSERT ON votes` trigger gated on
--     `deadline_at <= now()` OR `status = 'firing'`, AND a minimum
--     quorum of two votes.
--   * The initiator's `fire_verdict` RPC, which also enforced the
--     two-vote minimum quorum.
--
-- v1.1 fires on exactly two signals — no timer, no shot clock, no
-- minimum quorum:
--
--   1. All participants completed Q5 — the verdict auto-fires the
--      moment every CURRENT room member has submitted their quiz
--      (their `votes` row carries a `regret`-kind Q5 slot). User
--      story 35.
--   2. The initiator pressed "close voting" — `fire_verdict` produces
--      the verdict on demand, without waiting on a straggler. User
--      story 33.
--
-- A solo session (the initiator alone) still resolves on either
-- signal — there is no minimum quorum (user story 36). A member is
-- never rushed: there is no deadline channel at all (user story 34).
--
-- The canonical, fixture-tested statement of this firing contract is
-- the pure predicate in
-- `supabase/functions/_shared/verdict-firing.ts` (`decideFiring`).
-- The trigger + RPC below mirror that predicate at the database
-- layer; keep the two in sync.
--
-- "Completed Q5" signal
-- ─────────────────────
-- A member completes Q5 by submitting their quiz, which inserts their
-- `votes` row. The row carries five generic jsonb slots (TB-04); the
-- Q5 preference probe (TB-08) writes a `regret`-kind slot. We treat a
-- member as Q5-complete iff one of their slots q1..q5 carries
-- `meta.question_kind = 'regret'`. A votes row without a regret slot
-- (a partial / legacy write) does NOT count toward all-complete.
--
-- Down-migration: this migration supersedes the TB-07 trigger / RPC /
-- cron. Reverting means re-applying `20260513224000000_*`.

-- ── 1. Drop the v1 timer cron ───────────────────────────────────────
-- The per-minute `gettoit_verdict_auto_fire` job fired on deadline
-- expiry. v1.1 has no deadline, so the job has nothing to do — and
-- leaving it scheduled would mean it keeps scanning `rooms.status =
-- 'open' AND deadline_at <= now()` and could expire a perfectly live
-- v1.1 room whose members simply haven't finished the quiz yet. We
-- unschedule it. The `cron_auto_fire_or_expire()` function itself is
-- left defined but orphaned (no schedule references it); dropping the
-- function is a no-op cleanup deferred to avoid a dependency surprise.
do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_verdict_auto_fire'
    ) then
        perform cron.unschedule('gettoit_verdict_auto_fire');
    end if;
end $$;

-- ── 2. Q5-complete helper — does a member have a regret slot? ────────
-- A member is Q5-complete iff any of their five generic votes slots
-- carries `meta.question_kind = 'regret'`. Mirrors the
-- dispatch-on-question_kind contract of `_shared/votes-schema.ts` and
-- the `votes_slot_of_kind` helper from the TB-04 migration.
--
-- `count_q5_complete_members` returns how many of a room's CURRENT
-- members have completed Q5 — the all-complete predicate compares
-- this against `count(members)`. It joins `members` to `votes` so a
-- stale votes row for a user who has left the room never counts (the
-- v1.1 firing predicate gates on current membership).
create or replace function public.count_q5_complete_members(p_room_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
    select count(*)::int
    from public.members m
    where m.room_id = p_room_id
      and exists (
          select 1
          from public.votes v
          cross join lateral (
              values (v.q1), (v.q2), (v.q3), (v.q4), (v.q5)
          ) as s(slot)
          where v.room_id = m.room_id
            and v.user_id = m.user_id
            and s.slot is not null
            and s.slot #>> '{meta,question_kind}' = 'regret'
      );
$$;

comment on function public.count_q5_complete_members(uuid) is
    'TB-13 — count of a room''s CURRENT members who have completed Q5 (their votes row carries a regret-kind slot). Joins members→votes so a stale vote from a departed member never counts. Used by the all-participants-complete auto-fire predicate.';

revoke all on function public.count_q5_complete_members(uuid) from public;

-- ── 3. dispatch_compute_verdict — carry the fire method ─────────────
-- The TB-07 `dispatch_compute_verdict(uuid)` posted only `{room_id}`
-- to the compute-verdict Edge Function, so the durable `verdicts.method`
-- always fell back to `manual`. v1.1 fires on two distinct signals —
-- all-complete auto-fire (`quorum`) and the initiator's close-voting
-- control (`manual`) — and the durable verdict should reflect which.
-- We add a 2-arg overload that forwards a `method` body field; the
-- 1-arg form is left in place (the orphaned `cron_auto_fire_or_expire`
-- still references it) and delegates to the overload with `manual`.
create or replace function public.dispatch_compute_verdict(
    p_room_id uuid,
    p_method  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_url      text := current_setting('app.supabase_url', true);
    v_key      text := current_setting('app.service_role_key', true);
    v_endpoint text;
    v_body     jsonb;
begin
    -- Bail silently when either GUC is missing — local dev / CI
    -- environments often don't set them and we don't want the trigger
    -- to fail the votes INSERT in that case.
    if v_url is null or v_url = '' or v_key is null or v_key = '' then
        return;
    end if;

    v_endpoint := v_url || '/functions/v1/compute-verdict';

    -- Only forward `method` when it is one the handler recognises
    -- (`quorum` / `deadline`); anything else lets the handler fall
    -- back to its `manual` default.
    v_body := jsonb_build_object('room_id', p_room_id);
    if p_method in ('quorum', 'deadline') then
        v_body := v_body || jsonb_build_object('method', p_method);
    end if;

    perform net.http_post(
        url      := v_endpoint,
        headers  := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_key
                    ),
        body     := v_body
    );
end;
$$;

comment on function public.dispatch_compute_verdict(uuid, text) is
    'TB-13 (v1.1) — fire-and-forget HTTP POST to the compute-verdict Edge Function, carrying a method field so the durable verdict reflects how it fired (quorum = all-complete auto-fire, manual = close-voting). Silent no-op when the app.* GUCs are missing.';

revoke all on function public.dispatch_compute_verdict(uuid, text) from public;

-- ── 4. fire_verdict RPC — initiator's "close voting" control ─────────
-- v1.1: the initiator presses "close voting" to produce the verdict
-- on demand. This RPC drops the v1 two-vote minimum quorum entirely —
-- a solo session (initiator alone) resolves, and the initiator never
-- waits on a straggler. Initiator-only is still enforced.
create or replace function public.fire_verdict(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller    uuid := (select auth.uid());
    v_room      public.rooms%rowtype;
    v_updated   integer;
begin
    if v_caller is null then
        return jsonb_build_object('error', 'unauthenticated');
    end if;

    select * into v_room
    from public.rooms
    where id = p_room_id;

    if not found then
        return jsonb_build_object('error', 'room_not_found');
    end if;

    if v_room.creator_user_id is distinct from v_caller then
        return jsonb_build_object('error', 'not_initiator');
    end if;

    -- A room that already left `open` is firing / verdict_ready /
    -- locked / expired. All are terminal-ish for the close-voting tap
    -- — return a no-op success so a double-tap or a race against the
    -- auto-fire trigger doesn't surface a spurious failure.
    if v_room.status <> 'open' then
        return jsonb_build_object('status', 'already_firing', 'room_status', v_room.status);
    end if;

    -- v1.1 — NO quorum check. The initiator's close-voting control
    -- fires the verdict whatever the participant progress; a solo
    -- session resolves with the initiator's vote alone, and a group
    -- session resolves without waiting on a straggler. The
    -- VerdictEngine itself still needs at least one vote to run; the
    -- compute-verdict Edge Function returns `no_votes` (404) if the
    -- initiator pressed close before anyone — including themselves —
    -- submitted, which is the correct degenerate behavior.

    -- Race-safe flip — only succeeds if the row is still `open`.
    update public.rooms
    set status = 'firing'
    where id = p_room_id
      and status = 'open';
    get diagnostics v_updated = row_count;

    if v_updated = 0 then
        -- Another tap or the auto-fire trigger got here first.
        return jsonb_build_object('status', 'already_firing');
    end if;

    -- Inline dispatch — fire-and-forget HTTP POST to the engine.
    -- `manual` — this fire was the initiator's close-voting control.
    perform public.dispatch_compute_verdict(p_room_id, 'manual');

    return jsonb_build_object('status', 'firing');
end;
$$;

comment on function public.fire_verdict(uuid) is
    'TB-13 (v1.1) close-voting RPC. Initiator-only. NO minimum quorum — a solo session resolves and the initiator never waits on a straggler. Flips rooms.status open→firing and dispatches the compute-verdict engine inline. Supersedes the TB-07 quorum-gated fire_verdict.';

revoke all on function public.fire_verdict(uuid) from public;
grant execute on function public.fire_verdict(uuid) to authenticated;

-- ── 5. AFTER INSERT ON votes — all-participants-complete auto-fire ──
-- v1.1: the verdict auto-fires the moment EVERY current member has
-- completed Q5. The trigger fires after each votes INSERT (a quiz
-- submit); it checks whether the room is now all-complete and, if so,
-- flips status and dispatches the engine.
--
-- This drops the v1 trigger's `deadline_at <= now()` time channel and
-- its two-vote minimum quorum. The new gate is purely:
--   count_q5_complete_members(room) = count(members of room)
-- with a member-count >= 1 floor so an empty room never fires.
--
-- The trigger ALSO still dispatches when the room is already in
-- `firing` — the initiator's close-voting RPC flips status to firing
-- and dispatches inline, but a vote that lands in the same instant
-- (initiator closed voting, a straggler's submit races in) should
-- re-dispatch harmlessly: the compute-verdict Edge Function is
-- idempotent on `verdicts.room_id`.
create or replace function public.votes_maybe_fire_verdict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_room          public.rooms%rowtype;
    v_member_cnt    integer;
    v_complete_cnt  integer;
    v_updated       integer;
begin
    select * into v_room
    from public.rooms
    where id = new.room_id;

    if not found then
        return new;
    end if;

    -- If the room is already firing (the initiator pressed close
    -- voting), re-dispatch harmlessly — the engine is idempotent.
    -- The first dispatch (from fire_verdict) already stamped the
    -- method; the idempotency short-circuit means this redundant
    -- dispatch's method is moot, so `manual` is the honest label.
    if v_room.status = 'firing' then
        perform public.dispatch_compute_verdict(new.room_id, 'manual');
        return new;
    end if;

    -- Only an `open` room can auto-fire. verdict_ready / locked /
    -- expired rooms are terminal.
    if v_room.status <> 'open' then
        return new;
    end if;

    select count(*)::int
    into v_member_cnt
    from public.members
    where room_id = new.room_id;

    -- An empty room has no verdict to compute — never fire.
    if v_member_cnt = 0 then
        return new;
    end if;

    v_complete_cnt := public.count_q5_complete_members(new.room_id);

    -- All-participants-complete auto-fire — every current member has
    -- a regret-kind Q5 slot. No timer, no minimum quorum: a solo
    -- room (member_cnt = 1) fires the moment the initiator submits.
    if v_complete_cnt >= v_member_cnt then
        update public.rooms
        set status = 'firing'
        where id = new.room_id
          and status = 'open';
        get diagnostics v_updated = row_count;
        if v_updated > 0 then
            -- `quorum` — this fire was the all-participants-complete
            -- auto-fire (every member finished Q5), not a manual close.
            perform public.dispatch_compute_verdict(new.room_id, 'quorum');
        end if;
    end if;

    return new;
end;
$$;

comment on function public.votes_maybe_fire_verdict() is
    'TB-13 (v1.1) AFTER INSERT ON votes trigger. Auto-fires the VerdictEngine the moment every CURRENT room member has completed Q5 (has a regret-kind votes slot). No timer / deadline channel and no minimum quorum — a solo room fires on the initiator''s own submit. Mirrors the decideFiring predicate in _shared/verdict-firing.ts.';

drop trigger if exists votes_maybe_fire_verdict on public.votes;
create trigger votes_maybe_fire_verdict
    after insert on public.votes
    for each row
    execute function public.votes_maybe_fire_verdict();
