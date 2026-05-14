-- TB-16 — anonymous account 30-day TTL sweeper.
--
-- Per [[ADR 0006]] (60_engineering/adr/0006-privacy-posture-v1.md):
-- anonymous accounts are purged 30 days after their last activity.
-- The function deletes matching rows from auth.users; the cascade FKs
-- on every dependent public-schema table handle the rest (rooms they
-- created hard-delete, members/votes/ratifications/rerolls cascade-
-- delete, events.user_id nullifies for analytics fidelity, push_tokens
-- + user_preferences + check_ins + checkin_dispatches cascade).
--
-- Activity proxy: `auth.users.last_sign_in_at`. For anonymous users
-- Supabase sets this when the session is created and refreshes it on
-- every access-token issuance. The iOS SDK refreshes the access token
-- in the background ~1 hour before expiry whenever the app session is
-- live, so this column tracks "session was active recently" closely
-- enough for a 30-day window. Users who quit the app for 30+ days
-- fall over the cliff and are purged.
--
-- Why hourly:
--   * 30-day window doesn't need minute precision.
--   * Spreads load away from the per-minute verdict-fire cron slot
--     (`gettoit_verdict_auto_fire`).
--
-- Idempotency: re-runs simply delete only un-deleted rows. The function
-- never raises on an empty result set.
--
-- Privileges: runs as `security definer` so it can DELETE from the
-- auth schema (no role except the postgres superuser has DELETE there).

create or replace function public.cron_purge_expired_anonymous_users()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from auth.users
    where is_anonymous = true
      and last_sign_in_at < now() - interval '30 days';
end;
$$;

comment on function public.cron_purge_expired_anonymous_users() is
    'TB-16 hourly sweeper. Per ADR 0006: deletes auth.users rows for anonymous accounts whose last_sign_in_at is 30+ days ago. Cascade FKs on every dependent table handle the rest (rooms created hard-delete; members/votes/ratifications/rerolls/check_ins/user_preferences/push_tokens/checkin_dispatches cascade; events nullify). Idempotent.';

revoke all on function public.cron_purge_expired_anonymous_users() from public;

-- Idempotent re-schedule — drop any prior slot under this name before
-- registering. Same pattern used by the verdict cron and the no-signal
-- sweeper.
do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_purge_expired_anonymous_users'
    ) then
        perform cron.unschedule('gettoit_purge_expired_anonymous_users');
    end if;
end $$;

-- Hourly at minute 30 — offset from the no-signal sweeper at minute 0
-- so the two TTL-shaped jobs don't bunch into the same minute.
select cron.schedule(
    'gettoit_purge_expired_anonymous_users',
    '30 * * * *',
    $$select public.cron_purge_expired_anonymous_users();$$
);
