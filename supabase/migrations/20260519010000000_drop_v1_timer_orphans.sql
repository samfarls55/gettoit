-- Legacy mobile note: references to iOS/Swift/TestFlight in this historical schema file refer to the retired Swift app; active mobile app is React Native / Expo in mobile/.
-- tb-WF-3 (sg-WF-3 legacy Swift port (retired; active app in mobile/)) â€” drop the orphaned original timer fire path.
--
-- TB-13 (`20260515020000000_verdict_fire_on_q5_complete.sql`) already
-- unscheduled the per-minute `gettoit_verdict_auto_fire` cron job and
-- replaced the AFTER INSERT ON votes trigger with the redesign's
-- all-participants-Q5-complete predicate. The
-- `cron_auto_fire_or_expire()` function it scheduled, however, was
-- intentionally left in place "orphaned (no schedule references it);
-- dropping the function is a no-op cleanup deferred to avoid a
-- dependency surprise."
--
-- Bug-09 then rewrote `dispatch_compute_verdict(uuid)` (the 1-arg
-- form) so the orphaned cron function's calls would still go through
-- app_config rather than the dead GUCs. The 1-arg form has no other
-- caller â€” the live redesign fire path (the votes trigger + the
-- `fire_verdict` RPC) calls the 2-arg `dispatch_compute_verdict(uuid,
-- text)` form.
--
-- The quiz redesign PRD locked the timer out (US34) and sg-WF-3 finalised the
-- design-system retirement. This migration is the iOS-port paired
-- slice (tb-WF-3) cleaning up the orphaned database references:
--
--   * Drop `cron_auto_fire_or_expire()` â€” the function that scanned
--     `rooms.status='open' AND deadline_at <= now()` and either
--     dispatched the engine or flipped the room to `expired`. With no
--     schedule pointing at it and no other caller, it is dead code.
--   * Drop `dispatch_compute_verdict(uuid)` â€” the 1-arg overload
--     retained only for `cron_auto_fire_or_expire`. With its sole
--     caller gone, the 1-arg form is also dead. The 2-arg overload
--     (the live redesign fire path) stays in place.
--
-- Schema columns LEFT IN PLACE per the tb-WF-3 spec
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- `rooms.timer_minutes` and `rooms.deadline_at` are intentionally
-- preserved. They are now unused (the mobile client never sets
-- `deadline_at`, and nothing reads either column) but additive
-- removal is a separate slice â€” the columns can stay unused without
-- breaking anything, and dropping them risks a NOT NULL CHECK
-- constraint surprise on the live production rows. Tracked in the
-- workflow-overhaul _index alongside other schema-cleanup tasks.
--
-- Down-migration
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Reverting means re-applying the relevant CREATE OR REPLACE blocks
-- from `20260513224000000_verdict_fire_trigger_and_cron.sql` (the
-- 1-arg dispatcher + `cron_auto_fire_or_expire`) and re-scheduling
-- the per-minute `gettoit_verdict_auto_fire` cron job.

-- â”€â”€ 1. Defensive cron unschedule (idempotent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- TB-13 already unscheduled this; we re-assert in case any operator
-- rescheduled it manually between migrations.
do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_verdict_auto_fire'
    ) then
        perform cron.unschedule('gettoit_verdict_auto_fire');
    end if;
end $$;

-- â”€â”€ 2. Drop the orphaned cron function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- IF EXISTS so a fresh database that never carried the function (e.g.
-- a future replay that includes the down-migration of TB-07) is a
-- no-op rather than an error.
drop function if exists public.cron_auto_fire_or_expire();

-- â”€â”€ 3. Drop the orphaned 1-arg dispatcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- The 2-arg dispatcher `dispatch_compute_verdict(uuid, text)` is the
-- live redesign fire path and is left intact. The 1-arg form was only
-- retained for the now-deleted `cron_auto_fire_or_expire`.
drop function if exists public.dispatch_compute_verdict(uuid);
