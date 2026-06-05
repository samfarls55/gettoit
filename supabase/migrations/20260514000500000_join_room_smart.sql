-- Legacy mobile note: references to iOS/Swift/TestFlight in this historical schema file refer to the retired Swift app; active mobile app is React Native / Expo in mobile/.
-- TB-11 â€” late-joiner read-only routing RPC.
--
-- When a user taps an invite Universal Link AFTER the verdict has
-- fired, we need to:
--
--   1. Check `rooms.status`. If it's `open` or `firing`, behave like
--      the legacy `RoomStore.joinRoom` path (write a `members` row,
--      route to the quiz).
--   2. Otherwise route the late-joiner to the S05 surface in
--      Â§`read-only`). They MUST NOT be added to `members` of the
--      closed room â€” that would imply they contributed.
--
-- Two problems make this awkward to do client-side:
--
--   * The base `rooms_select_members` RLS policy only admits rows
--     for users who are already in `members`. A late-joiner reading
--     `rooms.status` before they've inserted membership gets nothing
--     back â€” the mobile client can't distinguish "wrong room id" from
--     "closed room I'm not a member of".
--   * Reading the verdict + cuts + receipts for the read-only render
--     hits the same RLS shape on `verdicts`, `option_cuts`, `votes`.
--     A non-member can't see any of them.
--
-- The cleanest fix is a `SECURITY DEFINER` RPC that:
--
--   * Decides the route server-side, atomically.
--   * For the open / firing branch, inserts the `members` row inline
--     (same shape as `RoomStore.joinRoom`).
--   * For the closed branch, returns a self-contained read-only
--     payload â€” room status + the S01 control defaults (timer +
--     radius) the iOS re-invite CTA pre-populates with â€” without
--     ever touching `members`.
--
-- The verdict + cuts + receipts payload for the read-only render is
-- fetched by a companion RPC (`fetch_read_only_verdict`) below.
-- Keeping them as two RPCs lets the join handler stay cheap (one
-- write OR one cheap status read) while the read-only render still
-- gets the full payload it needs.
--
-- Return shapes:
--
--   {"status":"joined", "role":"participant"}
--       Late-but-still-open. members row inserted; client routes to
--       the quiz path (TB-04).
--
--   {"status":"already_member", "role":"owner|participant"}
--       The caller is already a member of this room. The client
--       routes the same way they would on cold-restart: into the
--       quiz / waiting / verdict surface for the current room status.
--
--   {"status":"read_only", "room_status":"verdict_ready|locked|expired",
--    "timer_minutes":N, "radius_meters":N}
--       Late-joiner â€” the verdict was sealed before they tapped.
--       Client renders S05 read-only and surfaces the timer + radius
--       as defaults for the re-invite CTA. No members row is
--       inserted.
--
--   {"error":"room_not_found"}     room id doesn't exist
--   {"error":"unauthenticated"}    caller has no JWT
--
-- The RPC runs SECURITY DEFINER so the status check + read-only
-- payload assemble work even when the caller is not a member of
-- the room. We never expose member identities or verdict bodies
-- through this RPC â€” the read-only render fetches those via
-- `fetch_read_only_verdict` (also SECURITY DEFINER).

create or replace function public.join_room_smart(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller       uuid := (select auth.uid());
    v_room         public.rooms%rowtype;
    v_existing     text;
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

    -- Already a member? Surface that explicitly so the mobile client
    -- can avoid a redundant insert that would just race against the
    -- (room_id, user_id) primary-key constraint.
    select role into v_existing
    from public.members
    where room_id = p_room_id
      and user_id = v_caller;

    if v_existing is not null then
        return jsonb_build_object(
            'status', 'already_member',
            'role', v_existing
        );
    end if;

    -- open / firing â€” write the membership row and route to quiz.
    -- We accept `firing` here because the verdict hasn't been
    -- COMMITTED yet (the engine flips firing â†’ verdict_ready as it
    -- writes the verdict row); the joiner's vote can still land in
    -- the next compute-verdict invocation if they answer in time.
    if v_room.status in ('open', 'firing') then
        insert into public.members (room_id, user_id, role)
        values (p_room_id, v_caller, 'participant');

        return jsonb_build_object(
            'status', 'joined',
            'role', 'participant'
        );
    end if;

    -- verdict_ready / locked / expired â€” read-only late-joiner.
    -- DO NOT insert a members row. Return the prior room's S01
    -- defaults so the re-invite CTA can pre-populate them.
    return jsonb_build_object(
        'status', 'read_only',
        'room_status', v_room.status,
        'timer_minutes', v_room.timer_minutes,
        'radius_meters', v_room.radius_meters
    );
end;
$$;

comment on function public.join_room_smart(uuid) is
    'TB-11 â€” invite-link router. Atomically checks rooms.status and either inserts a members row (open / firing) or returns the read-only routing payload (verdict_ready / locked / expired). Late-joiners are NEVER added to members of a closed room.';

revoke all on function public.join_room_smart(uuid) from public;
grant execute on function public.join_room_smart(uuid) to authenticated;


-- â”€â”€ fetch_read_only_verdict â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--
-- Read-only verdict payload for the late-joiner S05 render. Returns
-- the verdict + cuts + receipts + member_count assembled the same
-- way VerdictStore.fetchVerdict would, but accessible to a caller
-- who is NOT a member of the room.
--
-- Receipts include only members who actually voted before the
-- verdict committed. The late-joiner is not in the list â€” they
-- didn't contribute. The function ignores the caller's identity
-- entirely; it returns the same payload to every late-joiner who
-- knows the room id.
--
-- Return shape:
--
--   {"verdict": {
--       "id": uuid,
--       "method": text,
--       "rule_text": text,
--       "option": { "id": uuid, "payload": jsonb } | null,
--       "computed_at": text
--    },
--    "cuts": [ { "option_id": uuid, "option_name": text,
--                 "cut_reason": text, "cut_text": text }, ... ],
--    "receipts": [ { "user_id": uuid, "q1_vetoes": text[], ... } ],
--    "member_count": int,
--    "room": { "timer_minutes": int, "radius_meters": int, "status": text }
--   }
--
--   {"error":"no_verdict"}     room exists but no verdict yet
--   {"error":"room_not_found"} room id doesn't exist
--   {"error":"unauthenticated"} caller has no JWT
--
-- This RPC is intentionally NOT idempotent-write â€” it's a pure
-- read. We still gate on `auth.uid()` for parity with the rest of
-- the API surface, even though every authenticated caller sees the
-- same payload.

create or replace function public.fetch_read_only_verdict(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller   uuid := (select auth.uid());
    v_room     public.rooms%rowtype;
    v_verdict  public.verdicts%rowtype;
    v_option   jsonb;
    v_cuts     jsonb;
    v_receipts jsonb;
    v_members  integer;
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

    select * into v_verdict
    from public.verdicts
    where room_id = p_room_id
    order by computed_at desc
    limit 1;

    if not found then
        return jsonb_build_object('error', 'no_verdict');
    end if;

    -- Winning option (null for no_survivor).
    if v_verdict.option_id is not null then
        select jsonb_build_object('id', id, 'payload', payload)
        into v_option
        from public.options
        where id = v_verdict.option_id;
    else
        v_option := null;
    end if;

    -- Cuts â€” verdict-scoped. Stitch option name from `options`.
    select coalesce(jsonb_agg(jsonb_build_object(
        'option_id', oc.option_id,
        'option_name', o.payload->>'name',
        'cut_reason', oc.cut_reason,
        'cut_text', oc.cut_text
    ) order by oc.option_id), '[]'::jsonb)
    into v_cuts
    from public.option_cuts oc
    left join public.options o on o.id = oc.option_id
    where oc.verdict_id = v_verdict.id;

    -- Receipts â€” every vote row for the room. Late-joiner is not
    -- here because they never inserted a vote.
    select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', v.user_id,
        'q1_vetoes', v.q1_vetoes,
        'q2_budget', v.q2_budget,
        'q3_walk_minutes', v.q3_walk_minutes,
        'q4_vibe', v.q4_vibe,
        'q5_regret', v.q5_regret
    ) order by v.user_id), '[]'::jsonb)
    into v_receipts
    from public.votes v
    where v.room_id = p_room_id;

    -- Member count for the time-badge audience copy ("ALL N OF YOU").
    select count(*)::int
    into v_members
    from public.members
    where room_id = p_room_id;

    return jsonb_build_object(
        'verdict', jsonb_build_object(
            'id', v_verdict.id,
            'method', v_verdict.method,
            'rule_text', v_verdict.rule_text,
            'option', v_option,
            'computed_at', v_verdict.computed_at
        ),
        'cuts', v_cuts,
        'receipts', v_receipts,
        'member_count', v_members,
        'room', jsonb_build_object(
            'timer_minutes', v_room.timer_minutes,
            'radius_meters', v_room.radius_meters,
            'status', v_room.status
        )
    );
end;
$$;

comment on function public.fetch_read_only_verdict(uuid) is
    'TB-11 â€” read-only verdict payload for late-joiner S05 render. SECURITY DEFINER so a non-member can read the verdict the engine already sealed. Receipts list excludes the caller because the caller is by definition NOT in members of a closed room.';

revoke all on function public.fetch_read_only_verdict(uuid) from public;
grant execute on function public.fetch_read_only_verdict(uuid) to authenticated;
