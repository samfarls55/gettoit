-- TB-07 — fire_verdict(room_id) RPC.
--
-- The initiator's "Decide now" tap on S04 Waiting calls this RPC. It
-- enforces the v1 minimum-quorum rule and flips `rooms.status` to
-- `firing` if the rule passes. The downstream verdict computation
-- (the actual EBA engine + `verdicts` / `option_cuts` writes) lives
-- in the Edge Function `compute-verdict`; this RPC is intentionally
-- the dispatcher, not the engine.
--
-- Quorum rule (PRD §"Group size, fire trigger, timer"):
--   * Minimum 2 answers to fire: initiator + at least one invitee.
--   * Initiator-only — the room creator is the only caller allowed to
--     manually fire. RPC checks `creator_user_id = auth.uid()`.
--
-- Outcomes the RPC surfaces in its return JSON:
--   * `{"status":"firing"}`             — happy path, status flipped
--   * `{"status":"already_firing"}`     — concurrent press OR cron beat
--     the caller; the row is already in `firing` / `verdict_ready` /
--     `locked` / `expired`. Treated as a no-op success so the iOS UI
--     doesn't surface a spurious failure on a double-tap or a race
--     against the cron job.
--   * `{"error":"not_initiator"}`       — caller isn't the room owner.
--   * `{"error":"below_quorum"}`        — fewer than 2 votes exist.
--   * `{"error":"room_not_found"}`      — no row, or RLS hides it.
--
-- The RPC is SECURITY DEFINER so it can run the votes count + the
-- rooms UPDATE without the caller needing direct write permission
-- on `rooms.status`. Without DEFINER the UPDATE would need a wider
-- UPDATE policy on `rooms` than the v1 schema admits (the iOS client
-- never writes `rooms.status` directly).
--
-- Idempotency:
--   * Re-entry on a row already in `firing` returns `already_firing`
--     without re-flipping. The downstream `compute-verdict` is
--     idempotent (`verdicts.room_id` unique constraint) so even if
--     the iOS client invokes the function twice in quick succession,
--     the second call returns the already-computed verdict.
--   * Concurrent calls from two clients are race-safe: the UPDATE
--     uses a `WHERE status = 'open'` predicate, so the second call
--     touches zero rows and falls through to the already_firing
--     branch.

create or replace function public.fire_verdict(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller    uuid := (select auth.uid());
    v_room      public.rooms%rowtype;
    v_vote_cnt  integer;
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

    -- A room that already left `open` is either firing, already
    -- verdict_ready, locked, or expired. All four are terminal-ish
    -- states for the "Decide now" tap path — return as no-op success.
    if v_room.status <> 'open' then
        return jsonb_build_object('status', 'already_firing', 'room_status', v_room.status);
    end if;

    -- Quorum check — strictly ≥ 2 distinct user votes.
    select count(*)::int
    into v_vote_cnt
    from public.votes
    where room_id = p_room_id;

    if v_vote_cnt < 2 then
        return jsonb_build_object('error', 'below_quorum', 'vote_count', v_vote_cnt);
    end if;

    -- Race-safe flip — only succeeds if the row is still in `open`.
    update public.rooms
    set status = 'firing'
    where id = p_room_id
      and status = 'open';
    get diagnostics v_updated = row_count;

    if v_updated = 0 then
        -- Another tap or cron got here between our SELECT and the
        -- UPDATE. The room is no longer `open`; treat as a success.
        return jsonb_build_object('status', 'already_firing');
    end if;

    return jsonb_build_object('status', 'firing', 'vote_count', v_vote_cnt);
end;
$$;

comment on function public.fire_verdict(uuid) is
    'TB-07 manual-fire RPC. Initiator-only. Enforces min quorum 2. Flips rooms.status from open to firing. The actual verdict computation is invoked downstream by the AFTER INSERT ON votes trigger or the pg_cron auto-fire path, both of which check status=''firing'' as part of their fire predicate.';

-- The fire_verdict RPC is the only path that flips rooms.status to
-- 'firing'. Authenticated callers invoke it via PostgREST RPC. We
-- grant EXECUTE to `authenticated` only; anonymous (signed-out)
-- sessions can't even reach the function.
revoke all on function public.fire_verdict(uuid) from public;
grant execute on function public.fire_verdict(uuid) to authenticated;
