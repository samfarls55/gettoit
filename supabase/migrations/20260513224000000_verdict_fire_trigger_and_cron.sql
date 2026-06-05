-- Legacy mobile note: references to iOS/Swift/TestFlight in this historical schema file refer to the retired Swift app; active mobile app is React Native / Expo in mobile/.
-- TB-07 â€” verdict fire trigger + pg_cron auto-fire path.
--
-- Two server-side paths drive the VerdictEngine originally:
--
--   1. `AFTER INSERT ON votes` trigger â€” fires the engine the moment
--      the last expected member submits. The trigger predicate is:
--      `(rooms.status = 'firing' OR now() >= rooms.deadline_at) AND
--      count(votes WHERE room_id = NEW.room_id) >= 2`.
--      Note: the initiator's `fire_verdict(room_id)` RPC sets
--      `status = 'firing'` BEFORE the vote-count threshold gates,
--      so a manual fire on a room that already has 2+ votes triggers
--      the engine on the NEXT vote insert by another memberâ€¦ which
--      is exactly the wrong shape for the Decide-now path. To handle
--      "decide now after I already voted," the trigger ALSO fires
--      when it observes the room is already in `firing` state with
--      â‰¥2 votes â€” and the manual-fire RPC + this trigger combine to
--      cover both ordering directions.
--
--      To handle the case "initiator presses Decide now AFTER they
--      already voted" (no more votes coming) the `fire_verdict` RPC
--      ALSO invokes the dispatcher inline after flipping status.
--      That's a one-line addition to the RPC below.
--
--   2. `pg_cron` job â€” runs every minute, scans rooms whose deadline
--      has elapsed, flips status, and invokes the engine. Two
--      sub-paths within the job:
--        (a) `status='open' AND deadline_at<=now() AND vote_count>=2`
--            â†’ flip to `firing` + dispatch.
--        (b) `status='open' AND deadline_at<=now() AND vote_count<2`
--            â†’ flip to `expired` (the S04 no-quorum terminal lands
--            via this path).
--
-- Dispatcher: invokes the `compute-verdict` Edge Function via
-- `net.http_post` (`pg_net` extension, pre-installed on Supabase).
-- Fire-and-forget â€” the function returns 200 with the verdict body,
-- which the iOS Realtime subscriber consumes via the existing
-- `verdicts INSERT` event. The dispatcher doesn't await the HTTP
-- response (it returns the request id immediately) so the trigger
-- doesn't block the votes INSERT.
--
-- Idempotency contracts:
--   * The `compute-verdict` Edge Function rejects duplicate
--     invocations via the `verdicts.room_id` unique constraint
--     and the `existingVerdict` short-circuit. Two dispatches for
--     the same room are safe â€” the second returns `already_computed`.
--   * The trigger fires once per votes INSERT. A votes INSERT can
--     only happen for a room in `status='open'` or `firing` (votes
--     are gated to room members; once `verdict_ready` is set the
--     downstream surfaces stop accepting new votes â€” out of scope
--     for TB-07's schema, locked by iOS-side guards).
--
-- Configuration:
--   * The dispatcher reads the Supabase project URL and the service
--     role key from two GUC settings â€” `app.supabase_url` and
--     `app.service_role_key` â€” set at the project / cluster level
--     out of band. If either is missing the dispatch is silently
--     skipped (the manual fire path through the mobile client still
--     reaches the Edge Function via the SDK invoke). This matches
--     how the local-dev Supabase CLI runs against a stack that
--     doesn't have pg_net configured â€” the trigger becomes a no-op
--     and the mobile layer's invoke is the live path.

create extension if not exists pg_net;

-- â”€â”€ 1. Dispatcher function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function public.dispatch_compute_verdict(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_url        text := current_setting('app.supabase_url', true);
    v_key        text := current_setting('app.service_role_key', true);
    v_endpoint   text;
begin
    -- Bail silently when either GUC is missing â€” local dev / CI
    -- environments often don't set them and we don't want the trigger
    -- to fail the votes INSERT in that case. The iOS-side compute
    -- invocation still drives the engine in production paths that
    -- predate this trigger.
    if v_url is null or v_url = '' or v_key is null or v_key = '' then
        return;
    end if;

    v_endpoint := v_url || '/functions/v1/compute-verdict';

    perform net.http_post(
        url      := v_endpoint,
        headers  := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_key
                    ),
        body     := jsonb_build_object('room_id', p_room_id)
    );
end;
$$;

comment on function public.dispatch_compute_verdict(uuid) is
    'TB-07 fire-and-forget HTTP POST to the compute-verdict Edge Function. Reads app.supabase_url + app.service_role_key from cluster GUC. Silent no-op when either is missing (covers local dev and CI environments without pg_net configuration). Invoked by the AFTER INSERT ON votes trigger and the per-minute pg_cron job.';

revoke all on function public.dispatch_compute_verdict(uuid) from public;
-- Only the postgres role / trigger / cron context invokes this.
-- No grant to authenticated.

-- â”€â”€ 2. fire_verdict RPC â€” inline dispatch after status flip â”€â”€â”€â”€â”€â”€â”€â”€
-- Replaces the TB-07 RPC from 20260513223500000_fire_verdict_rpc.sql.
-- Adds the dispatcher invocation after the successful status flip so
-- the iOS "Decide now" tap fires the engine without depending on a
-- subsequent votes INSERT.

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

    if v_room.status <> 'open' then
        return jsonb_build_object('status', 'already_firing', 'room_status', v_room.status);
    end if;

    select count(*)::int
    into v_vote_cnt
    from public.votes
    where room_id = p_room_id;

    if v_vote_cnt < 2 then
        return jsonb_build_object('error', 'below_quorum', 'vote_count', v_vote_cnt);
    end if;

    update public.rooms
    set status = 'firing'
    where id = p_room_id
      and status = 'open';
    get diagnostics v_updated = row_count;

    if v_updated = 0 then
        return jsonb_build_object('status', 'already_firing');
    end if;

    -- Inline dispatch â€” fire-and-forget HTTP POST.
    perform public.dispatch_compute_verdict(p_room_id);

    return jsonb_build_object('status', 'firing', 'vote_count', v_vote_cnt);
end;
$$;

revoke all on function public.fire_verdict(uuid) from public;
grant execute on function public.fire_verdict(uuid) to authenticated;

-- â”€â”€ 3. AFTER INSERT ON votes trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function public.votes_maybe_fire_verdict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_room      public.rooms%rowtype;
    v_vote_cnt  integer;
    v_updated   integer;
begin
    select * into v_room
    from public.rooms
    where id = new.room_id;

    if not found then
        return new;
    end if;

    -- Counting votes for the room â€” includes the row we just inserted
    -- because the AFTER trigger fires post-INSERT, after the row is
    -- visible to same-transaction reads.
    select count(*)::int
    into v_vote_cnt
    from public.votes
    where room_id = new.room_id;

    if v_vote_cnt < 2 then
        return new;
    end if;

    -- Fire when:
    --   * Room is already in `firing` (initiator pressed Decide now
    --     OR the cron flipped the status in the same minute), OR
    --   * The deadline has elapsed and the room is still `open`
    --     (race: a vote landed in the same minute the cron would
    --     have run; the trigger gets there first).
    if v_room.status = 'firing' then
        perform public.dispatch_compute_verdict(new.room_id);
        return new;
    end if;

    if v_room.status = 'open' and v_room.deadline_at is not null
                              and v_room.deadline_at <= now() then
        update public.rooms
        set status = 'firing'
        where id = new.room_id
          and status = 'open';
        get diagnostics v_updated = row_count;
        if v_updated > 0 then
            perform public.dispatch_compute_verdict(new.room_id);
        end if;
        return new;
    end if;

    return new;
end;
$$;

comment on function public.votes_maybe_fire_verdict() is
    'TB-07 AFTER INSERT ON votes trigger. Fires the VerdictEngine when the room is already in firing state OR the deadline has elapsed, AND at least 2 votes exist. Coexists with the pg_cron auto-fire path; whichever path wins the race flips status to firing first, the other becomes a no-op.';

drop trigger if exists votes_maybe_fire_verdict on public.votes;
create trigger votes_maybe_fire_verdict
    after insert on public.votes
    for each row
    execute function public.votes_maybe_fire_verdict();

-- â”€â”€ 4. pg_cron â€” auto-fire / expire path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function public.cron_auto_fire_or_expire()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    r           record;
    v_vote_cnt  integer;
begin
    -- Iterate over rooms whose timer has elapsed but haven't moved
    -- past `open`. Each room is either flipped to `firing` + dispatched
    -- (if quorum met) or flipped to `expired` (if quorum not met).
    for r in
        select id, deadline_at
        from public.rooms
        where status = 'open'
          and deadline_at is not null
          and deadline_at <= now()
    loop
        select count(*)::int
        into v_vote_cnt
        from public.votes
        where room_id = r.id;

        if v_vote_cnt >= 2 then
            update public.rooms
            set status = 'firing'
            where id = r.id
              and status = 'open';
            if found then
                perform public.dispatch_compute_verdict(r.id);
            end if;
        else
            update public.rooms
            set status = 'expired'
            where id = r.id
              and status = 'open';
        end if;
    end loop;
end;
$$;

comment on function public.cron_auto_fire_or_expire() is
    'TB-07 pg_cron worker. Runs every minute. Flips status to firing + dispatches the engine when deadline_at has elapsed AND vote_count >= 2; flips to expired when deadline elapsed below quorum (the S04 no-quorum terminal).';

-- Schedule the cron job. `cron.schedule` returns a (jobid, jobname)
-- pair; calling it with the same name re-uses the existing slot on
-- Supabase but bombs with a unique-violation on stock pg_cron. We
-- defensively delete the prior schedule first so this migration is
-- idempotent regardless of host pg_cron flavor. `cron.unschedule`
-- accepts the job name as text.
do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_verdict_auto_fire'
    ) then
        perform cron.unschedule('gettoit_verdict_auto_fire');
    end if;
end $$;

select cron.schedule(
    'gettoit_verdict_auto_fire',
    '* * * * *',
    $$select public.cron_auto_fire_or_expire();$$
);
