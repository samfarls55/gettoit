-- TB-14 — checkin_dispatches exactly-once tracking.
--
-- The dispatch tracking table that makes the CheckinScheduler's per-
-- minute fanout exactly-once per `(verdict_id, user_id)`. Without
-- this, a cron worker that fires every minute would re-deliver the
-- push to every member of every verdict in the 12–24h window on every
-- tick. With it, each `(verdict_id, user_id)` pair gets exactly one
-- row, the cron skips pairs that already exist, and a re-run becomes
-- a no-op.
--
-- Why a separate table (vs. a `notified_at` column on `verdicts`):
--   * Per-user delivery, not per-verdict. The metric is computed at
--     the user grain, not the verdict grain.
--   * Records the APNs delivery shape (delivered_at, success boolean,
--     status code, apns_id) so we can audit failed sends.
--   * Keeps `verdicts` clean — TB-08 already added 3 columns; TB-10
--     adds more for reroll. The growing-pile-of-columns shape is a
--     deeper-module smell.
--
-- The dispatcher writes the row PRE-send (locked in by the unique PK)
-- then PATCHes it with the APNs result. Two windows of failure:
--   1. Pre-send write succeeds, APNs call fails → row exists with
--      `success=null`. The retry-on-next-tick pattern is gated by the
--      row's existence; the user gets one attempt per verdict. The
--      product-level intent (per surfaces/08-checkin.md §"What this
--      surface defends against") is that we don't nag — a missed push
--      is just a missed push.
--   2. Pre-send write fails (the row already exists) → the dispatcher
--      treats that as "another worker got there first" and bails.
--
-- The PK on (verdict_id, user_id) is the exactly-once anchor. The
-- dispatcher inserts with `ON CONFLICT DO NOTHING` and skips when the
-- insert returns 0 rows.

create table if not exists public.checkin_dispatches (
    verdict_id   uuid        not null references public.verdicts (id) on delete cascade,
    user_id      uuid        not null references auth.users (id) on delete cascade,
    requested_at timestamptz not null default now(),
    delivered_at timestamptz,
    success      boolean,
    status_code  int,
    apns_id      text,
    primary key (verdict_id, user_id)
);

comment on table public.checkin_dispatches is
    'TB-14 — exactly-once tracking for the next-day check-in push. PK on (verdict_id, user_id). The CheckinScheduler inserts a row before fanning out to APNs; conflicting inserts (a second cron tick mid-fanout, a manual retry) become no-ops via ON CONFLICT DO NOTHING. delivered_at + success + status_code + apns_id captured post-send for audit.';

comment on column public.checkin_dispatches.success is
    'Tri-state — null before APNs returns, true on 2xx, false on >=400. A null row indicates a pre-send insert that never got its result patched (cron worker died mid-fanout); the row blocks re-delivery anyway because the PK still exists.';

create index if not exists checkin_dispatches_verdict_id_idx
    on public.checkin_dispatches (verdict_id);

-- RLS: deny by default. Only service-role (cron worker) reads or
-- writes this table — it's an internal queue, not a user surface.
alter table public.checkin_dispatches enable row level security;
-- No policies → all client access denied. The cron worker's
-- SECURITY DEFINER context + the APNsSender Edge Function's service-
-- role key bypass RLS.
