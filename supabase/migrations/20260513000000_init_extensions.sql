-- TB-01 walking-skeleton baseline migration.
--
-- v1 needs three Postgres extensions enabled before any feature
-- migration can land:
--   * postgis  — radius / point queries against the `places` cache
--               (ADR 0002).
--   * pg_cron  — drives the deadline/quorum verdict fire and the
--               next-day check-in scheduler (ADR 0005).
--   * pgmq     — durable queue for the check-in fanout to APNsSender
--               (ADR 0005).
--
-- No tables yet. Per-feature schema lands in later tracer bullets
-- (TB-02 rooms/members, TB-04 votes, TB-06 verdicts/option_cuts,
-- TB-14 events/check_ins). Keeping this migration minimal and
-- idempotent so it survives any future ordering changes.

create extension if not exists postgis;
create extension if not exists pg_cron;
create extension if not exists pgmq;
