-- TB-14 — CheckinScheduler pg_cron job.
--
-- The per-minute scheduler that fires the next-day check-in push for
-- every verdict in the 12–24h window. Pattern mirrors TB-07's
-- `cron_auto_fire_or_expire` and TB-08's `cron_lock_expired_correctability_windows`
-- (see `gti-vault/60_engineering/waiting-fire-trigger.md` §"Two fire
-- paths" + `ratification-push-hardclose.md`).
--
-- Exactly-once contract (the critical correctness invariant):
--   1. For each verdict with `computed_at` between `now() - 24h` and
--      `now() - 12h`, the scheduler walks the room's members.
--   2. For each `(verdict_id, user_id)` it INSERTs into
--      `checkin_dispatches` with `ON CONFLICT DO NOTHING`. If the row
--      already exists (a prior cron tick already fired), the insert
--      returns 0 rows and the user is skipped.
--   3. If the insert lands, the scheduler fires-and-forgets a POST to
--      the `apns-sender` Edge Function with `{user_ids: [user_id]}`.
--      The Edge Function reads `push_tokens` for that user and fans
--      out to every device the user has.
--
-- Why fan one POST per user (not one POST per verdict with all users):
--   * Exactly-once is per (verdict, user). If we batched and one user
--     in the batch failed at the DB level (e.g. their push_tokens
--     fetch errored), partial-success semantics get murky.
--   * Per-user POSTs match the APNsSender contract from TB-08 — the
--     handler already accepts `user_ids[]` and handles single-user
--     calls trivially.
--   * The metric we care about is `% of verdicts followed through` —
--     verdict-grain. Push fanout being per-user makes the durable
--     dispatch row align with the check_in row's PK shape.
--
-- Web-fallback gap (documented per TB-14 ticket):
--   * Users without a `push_tokens` row receive NO check-in. The web
--     fallback intentionally has no push channel. The scheduler still
--     records a `checkin_dispatches` row for those users so the
--     exactly-once invariant holds (no future cron tick re-attempts).
--     This is fine — the APNsSender call no-ops on empty `push_tokens`
--     anyway, and the metric counts users who CAN respond.
--
-- GUC fallback:
--   * Same `app.supabase_url` + `app.service_role_key` shape as the
--     verdict-fire dispatcher. When either is unset (local dev / CI),
--     the scheduler silently no-ops on the HTTP call but STILL writes
--     the `checkin_dispatches` row so the exactly-once invariant is
--     testable in environments without pg_net.
--
-- 12-24h window choice:
--   * The PRD locks "12-24 hours after the verdict" — the lower bound
--     (12h) keeps the push out of the same evening; the upper bound
--     (24h) keeps the surface from feeling stale ("we asked yesterday
--     too, did you go?"). Combined with the exactly-once table, a
--     verdict from 23h ago fires once and is never re-fired even
--     though it'd technically still be in the window on the next
--     cron tick (the row in `checkin_dispatches` blocks).

-- ── 1. Per-verdict dispatch function ────────────────────────────────

create or replace function public.dispatch_checkin_for_verdict(p_verdict_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_room_id      uuid;
    v_member       record;
    v_url          text := current_setting('app.supabase_url', true);
    v_key          text := current_setting('app.service_role_key', true);
    v_endpoint     text;
    v_inserted     boolean;
    v_dispatched   int := 0;
    v_body         jsonb;
    v_headers      jsonb;
begin
    -- Resolve the verdict's room.
    select room_id into v_room_id
    from public.verdicts
    where id = p_verdict_id;

    if v_room_id is null then
        return 0;
    end if;

    -- Walk room members, attempting the per-(verdict, user) insert.
    -- The `ON CONFLICT DO NOTHING` is the exactly-once anchor — a
    -- second invocation for the same verdict will collide on every
    -- row and dispatch zero pushes.
    for v_member in
        select m.user_id
        from public.members m
        where m.room_id = v_room_id
    loop
        -- Pre-send insert. xmax = 0 indicates a fresh insert; a
        -- conflict row returns xmax > 0. Using `returning` to detect
        -- whether THIS call won the insert.
        insert into public.checkin_dispatches (verdict_id, user_id)
        values (p_verdict_id, v_member.user_id)
        on conflict (verdict_id, user_id) do nothing
        returning true into v_inserted;

        if v_inserted is null then
            -- Conflict — someone else already dispatched. Skip.
            continue;
        end if;

        v_dispatched := v_dispatched + 1;

        -- HTTP fanout via pg_net. Silent no-op when the GUCs are
        -- missing (local dev / CI) — the dispatch row is the durable
        -- side-effect that locks the exactly-once invariant.
        if v_url is not null and v_url <> '' and v_key is not null and v_key <> '' then
            v_endpoint := v_url || '/functions/v1/apns-sender';
            v_headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            );
            v_body := jsonb_build_object(
                'user_ids', jsonb_build_array(v_member.user_id::text),
                'notification', jsonb_build_object(
                    'title', 'Did you go?',
                    'body',  'Tap to tell us how it went — one tap, then we''re gone.',
                    'payload', jsonb_build_object(
                        'kind', 'checkin',
                        'verdict_id', p_verdict_id::text,
                        'room_id', v_room_id::text
                    )
                )
            );
            perform net.http_post(
                url     := v_endpoint,
                headers := v_headers,
                body    := v_body
            );
        end if;
    end loop;

    return v_dispatched;
end;
$$;

comment on function public.dispatch_checkin_for_verdict(uuid) is
    'TB-14 per-verdict check-in dispatcher. Inserts one checkin_dispatches row per (verdict_id, user_id) — the PK guarantees exactly-once. For each fresh insert, fires a POST to the apns-sender Edge Function via pg_net. Returns the number of fresh dispatches (0 when every user has already been notified).';

revoke all on function public.dispatch_checkin_for_verdict(uuid) from public;
-- Only the cron context invokes this. No grant to authenticated.

-- ── 2. Per-minute scheduler ─────────────────────────────────────────

create or replace function public.cron_dispatch_checkins()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    r record;
begin
    -- Walk verdicts in the 12-24h window. The exactly-once table
    -- ensures verdicts in the window for multiple cron ticks don't
    -- re-fire — `dispatch_checkin_for_verdict` is a no-op when all
    -- members have already been dispatched.
    for r in
        select id
        from public.verdicts
        where computed_at <= now() - interval '12 hours'
          and computed_at >  now() - interval '24 hours'
    loop
        perform public.dispatch_checkin_for_verdict(r.id);
    end loop;
end;
$$;

comment on function public.cron_dispatch_checkins() is
    'TB-14 per-minute scheduler. Walks verdicts whose computed_at is between 12h and 24h ago and calls dispatch_checkin_for_verdict on each. The dispatcher''s exactly-once table makes repeated ticks for the same verdict no-ops.';

do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_dispatch_checkins'
    ) then
        perform cron.unschedule('gettoit_dispatch_checkins');
    end if;
end $$;

select cron.schedule(
    'gettoit_dispatch_checkins',
    '* * * * *',
    $$select public.cron_dispatch_checkins();$$
);
