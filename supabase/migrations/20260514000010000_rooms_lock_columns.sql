-- Legacy mobile note: references to iOS/Swift/TestFlight in this historical schema file refer to the retired Swift app; active mobile app is React Native / Expo in mobile/.
-- TB-08 â€” rooms.lock-cycle columns + hard-close lock trigger.
--
-- Three additions to the `rooms` table to support the S05 â†’ S06
-- correctability window and visible hard-close:
--
--   * `correctability_window_seconds int default 30` â€” per-room
--     window length. PRD user story 60 admits 30â€“90s; original default is
--     30s. Settable per room when the initiator's S01 flow grows a
--     control (post-launch candidate); for now every room uses the
--     default.
--   * `verdict_committed_at timestamptz` â€” null until the FIRST
--     ratification on a verdict for this room. Set by the
--     `tg_ratifications_open_window` trigger. Once non-null the
--     correctability countdown is live and S06 is queued.
--   * `locked_at timestamptz` â€” when the room actually transitioned
--     to `status='locked'`. Set by the same trigger when all members
--     have ratified, or by the per-minute pg_cron worker when the
--     window expires.
--
-- The `rooms.status` check constraint already admits `'locked'`
-- (TB-02's baseline migration). This migration adds the lock-cycle
-- columns, the AFTER-INSERT trigger on `ratifications` that handles
-- the "first ratification opens the window" + "all members ratified
-- closes the window" flow, and the pg_cron worker that closes the
-- window on timeout.
--
-- Idempotency:
--   * The trigger uses `UPDATE ... WHERE status = 'verdict_ready' AND
--     verdict_committed_at IS NULL` so a second ratification doesn't
--     reset the window.
--   * The cron worker scans rooms with `status = 'verdict_ready' AND
--     verdict_committed_at IS NOT NULL AND verdict_committed_at +
--     correctability_window_seconds <= now()` and flips them to
--     `locked` in one UPDATE. Subsequent ticks are no-ops because the
--     status changed.
--
-- The hard-close motion on iOS lives in S06 (`LockedScreen.swift`,
-- TB-08). The iOS Realtime subscriber listens for `rooms.status ->
-- locked` and routes into S06.

alter table public.rooms
    add column if not exists correctability_window_seconds int
        not null default 30
        check (correctability_window_seconds between 5 and 600);

alter table public.rooms
    add column if not exists verdict_committed_at timestamptz;

alter table public.rooms
    add column if not exists locked_at timestamptz;

comment on column public.rooms.correctability_window_seconds is
    'TB-08 â€” seconds between the first ratification (verdict_committed_at) and the room flipping to status=locked. PRD admits 30â€“90; original default 30.';

comment on column public.rooms.verdict_committed_at is
    'TB-08 â€” when the first ratification landed on this room''s verdict. Null until then. Sets the start of the correctability window; the room locks at verdict_committed_at + correctability_window_seconds.';

comment on column public.rooms.locked_at is
    'TB-08 â€” when the room transitioned to status=locked. Set by the ratifications trigger (all members ratified) or by the cron worker (window expired). Used for the mono-tagged footer on S06.';

-- â”€â”€ 1. Trigger: open window on first ratification, close on full quorum â”€â”€

create or replace function public.tg_ratifications_open_or_close_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_room_id     uuid;
    v_room_state  text;
    v_committed   timestamptz;
    v_member_cnt  integer;
    v_ratify_cnt  integer;
begin
    -- Resolve the verdict's room.
    select v.room_id, r.status, r.verdict_committed_at
    into v_room_id, v_room_state, v_committed
    from public.verdicts v
    join public.rooms r on r.id = v.room_id
    where v.id = new.verdict_id;

    if v_room_id is null then
        return new;
    end if;

    -- â”€â”€ 1a. First ratification opens the window. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    -- Only flip when room is still in verdict_ready AND
    -- verdict_committed_at hasn't been set yet (a second ratification
    -- must not reset the window).
    if v_committed is null and v_room_state = 'verdict_ready' then
        update public.rooms
        set verdict_committed_at = new.ratified_at
        where id = v_room_id
          and verdict_committed_at is null
          and status = 'verdict_ready';
    end if;

    -- â”€â”€ 1b. Full-quorum ratification closes early. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    -- If every member of the room has ratified, lock the room now â€”
    -- there's nothing left to wait for. The cron worker handles the
    -- timeout case below.
    select count(*)::int into v_member_cnt
    from public.members
    where room_id = v_room_id;

    select count(*)::int into v_ratify_cnt
    from public.ratifications ra
    join public.verdicts v on v.id = ra.verdict_id
    where v.room_id = v_room_id;

    if v_member_cnt > 0 and v_ratify_cnt >= v_member_cnt then
        update public.rooms
        set status    = 'locked',
            locked_at = now()
        where id = v_room_id
          and status in ('verdict_ready');
    end if;

    return new;
end;
$$;

comment on function public.tg_ratifications_open_or_close_window() is
    'TB-08 AFTER INSERT trigger on ratifications. Opens the correctability window on first ratification (sets rooms.verdict_committed_at), closes it early when every room member has ratified (flips rooms.status to locked + sets locked_at).';

drop trigger if exists tg_ratifications_open_or_close_window on public.ratifications;
create trigger tg_ratifications_open_or_close_window
    after insert on public.ratifications
    for each row
    execute function public.tg_ratifications_open_or_close_window();

-- â”€â”€ 2. Cron worker: lock rooms whose window has elapsed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function public.cron_lock_expired_correctability_windows()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    r record;
begin
    for r in
        select id, verdict_committed_at, correctability_window_seconds
        from public.rooms
        where status = 'verdict_ready'
          and verdict_committed_at is not null
          and verdict_committed_at + (correctability_window_seconds || ' seconds')::interval <= now()
    loop
        update public.rooms
        set status    = 'locked',
            locked_at = now()
        where id = r.id
          and status = 'verdict_ready';
    end loop;
end;
$$;

comment on function public.cron_lock_expired_correctability_windows() is
    'TB-08 pg_cron worker. Runs every minute. Flips rooms.status from verdict_ready to locked when the correctability window has elapsed since verdict_committed_at.';

do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_lock_expired_windows'
    ) then
        perform cron.unschedule('gettoit_lock_expired_windows');
    end if;
end $$;

select cron.schedule(
    'gettoit_lock_expired_windows',
    '* * * * *',
    $$select public.cron_lock_expired_correctability_windows();$$
);
