-- TB-14 — 3-day-no-response auto-mark sweeper.
--
-- The hourly sweeper that writes `outcome='no_signal'` for any
-- `(verdict_id, user_id)` pair where the check-in push was
-- dispatched 3+ days ago and no `check_ins` row has landed since.
-- These rows are EXCLUDED from the metric numerator and denominator
-- per S08 §"Edge cases" — `no_signal` represents "user disengaged,"
-- not "user reported didn't go." Letting silent users count as
-- "skipped" would corrupt the cohort.
--
-- Why hourly (not per-minute):
--   * The window is 3 days; per-minute precision adds zero value over
--     hourly.
--   * Reduces cron load — the per-minute slot is reserved for the
--     12-24h dispatcher.
--
-- Pattern:
--   1. For each `checkin_dispatches` row older than 3 days where no
--      matching `check_ins (room_id, user_id)` exists.
--   2. Resolve the dispatch's room_id (via the verdict).
--   3. INSERT a `check_ins` row with outcome=no_signal,
--      `ON CONFLICT (room_id, user_id) DO NOTHING` — a late-arriving
--      response is preserved.
--
-- The sweep is idempotent: repeated runs against the same dispatch
-- row produce the same outcome (a no_signal row exists), and a real
-- response that arrives concurrently wins by virtue of the PK.

create or replace function public.cron_mark_no_signal_checkins()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    r record;
begin
    for r in
        select d.verdict_id, d.user_id, v.room_id
        from public.checkin_dispatches d
        join public.verdicts v on v.id = d.verdict_id
        where d.requested_at <= now() - interval '3 days'
          and not exists (
              select 1
              from public.check_ins c
              where c.room_id = v.room_id
                and c.user_id = d.user_id
          )
    loop
        insert into public.check_ins (room_id, user_id, outcome, reason)
        values (r.room_id, r.user_id, 'no_signal', null)
        on conflict (room_id, user_id) do nothing;
    end loop;
end;
$$;

comment on function public.cron_mark_no_signal_checkins() is
    'TB-14 hourly sweeper. Writes outcome=no_signal for (verdict, user) pairs whose check-in push was dispatched 3+ days ago and never received a response. no_signal rows are excluded from the metric numerator + denominator (S08 §"Edge cases"). Idempotent: re-runs are no-ops via the (room_id, user_id) PK.';

revoke all on function public.cron_mark_no_signal_checkins() from public;

do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_mark_no_signal_checkins'
    ) then
        perform cron.unschedule('gettoit_mark_no_signal_checkins');
    end if;
end $$;

-- Hourly at minute 0.
select cron.schedule(
    'gettoit_mark_no_signal_checkins',
    '0 * * * *',
    $$select public.cron_mark_no_signal_checkins();$$
);
