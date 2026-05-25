-- TB-14 — north-star + secondary metric views.
--
-- The SQL views that compute the original metrics from the durable
-- telemetry tables. Per ADR 0005 §"Decision" and TB-14 ticket:
--
--   * metric_follow_through_pct  — the north-star metric (PRD user
--     story 78). `count(check_ins WHERE outcome='went') /
--     count(check_ins WHERE outcome IN ('went','skipped'))`.
--     `snoozed` and `no_signal` are EXCLUDED from the denominator —
--     they represent "didn't answer," not "didn't go."
--
--   * metric_time_to_verdict_p50 — secondary efficiency metric.
--     Median of `verdict.computed_at - room.created_at` paired by
--     `room_id` through the `events` table. Per the ADR sketch we
--     pair via events; in practice we join `room_created` events
--     against `verdict_ready` events on `room_id`.
--
--   * metric_invite_acceptance  — secondary engagement metric.
--     `count(invitee_voted) / count(invite_shared)`. Inputs:
--       - `invite_shared`   — emitted when the initiator taps
--                              "Share invite" on S02.
--       - `member_joined`   — emitted when a deep-link tap lands a
--                              member row.
--       - `quiz_completed`  — emitted when a member submits Q5.
--     The acceptance ratio is computed against quiz_completed (a
--     vote is the load-bearing acceptance signal — a join without
--     a vote doesn't help the verdict). The view emits both the
--     join-vs-share ratio and the vote-vs-share ratio so future
--     dashboards can pick the relevant one without a new view.
--
-- All three views are SELECT-only and run as the caller's role.
-- Authenticated users get RLS-denied because the underlying tables
-- have no SELECT policy — only the service-role can read them, which
-- is the canonical posture for telemetry views (consumed by Supabase
-- Studio or a future Metabase dashboard).
--
-- The views materialize a single scalar value (or a tiny tuple). Cheap
-- to compute; no materialized-view machinery needed at pre-launch scale.

-- ── metric_follow_through_pct ───────────────────────────────────────
-- The north-star. Returns a single-row view with the numerator,
-- denominator, and the ratio (null when denominator = 0). Including
-- the raw counts saves a future dashboard from re-querying just to
-- get them.
create or replace view public.metric_follow_through_pct as
select
    (select count(*) from public.check_ins where outcome = 'went')::bigint
        as went_count,
    (select count(*) from public.check_ins where outcome in ('went', 'skipped'))::bigint
        as answered_count,
    case
        when (select count(*) from public.check_ins where outcome in ('went', 'skipped')) = 0 then null
        else round(
            (select count(*) from public.check_ins where outcome = 'went')::numeric
            / (select count(*) from public.check_ins where outcome in ('went', 'skipped'))::numeric,
            4
        )
    end as follow_through_pct;

comment on view public.metric_follow_through_pct is
    'TB-14 north-star metric (PRD user story 78). follow_through_pct = went / (went + skipped). snoozed and no_signal are EXCLUDED from the denominator — they represent "didn''t answer," not "didn''t go." null follow_through_pct when no answers exist yet (avoids division-by-zero).';

-- ── metric_time_to_verdict_p50 ──────────────────────────────────────
-- Median seconds between `room_created` and `verdict_ready` for the
-- same `room_id`. Uses percentile_cont(0.5) for a true median.
-- Pairs the two event types via an inner join on room_id, which
-- naturally drops rooms that never produced a verdict (expired /
-- no_survivor) — they don't count toward the time-to-verdict signal.
create or replace view public.metric_time_to_verdict_p50 as
with paired as (
    select
        rc.room_id,
        min(rc.created_at) as room_created_at,
        min(vr.created_at) as verdict_ready_at
    from public.events rc
    join public.events vr on vr.room_id = rc.room_id
    where rc.event_type = 'room_created'
      and vr.event_type = 'verdict_ready'
    group by rc.room_id
)
select
    count(*)::bigint as rooms_counted,
    percentile_cont(0.5) within group (
        order by extract(epoch from (verdict_ready_at - room_created_at))
    )::double precision as p50_seconds
from paired;

comment on view public.metric_time_to_verdict_p50 is
    'TB-14 secondary metric. Median seconds between room_created and verdict_ready events for the same room_id. Rooms without a verdict_ready event (expired / no_survivor) are excluded — they don''t represent a successful verdict path. rooms_counted is the cohort size; p50_seconds is null until at least one paired room exists.';

-- ── metric_invite_acceptance ────────────────────────────────────────
-- Two ratios: join-rate (member_joined / invite_shared) and vote-rate
-- (quiz_completed / invite_shared). Both are aggregated across all
-- events — the metric is cohort-level, not per-room.
--
-- Why count distinct (room_id, user_id) joins:
--   * An invite_shared event can fire multiple times per room (the
--     initiator can re-share). We count distinct shares per room.
--   * A member can re-emit member_joined if they re-join (e.g. after
--     a fresh install). We count distinct members per room.
--   * A quiz_completed should only fire once per (room, user); we
--     still take a distinct count defensively.
--
-- The shares-per-room normalization keeps a noisy initiator
-- (10 re-shares for the same room) from inflating the denominator.
create or replace view public.metric_invite_acceptance as
with shares as (
    select count(distinct room_id) as share_room_count
    from public.events
    where event_type = 'invite_shared'
),
joins as (
    select count(distinct (room_id, user_id)) as join_count
    from public.events
    where event_type = 'member_joined'
),
votes as (
    select count(distinct (room_id, user_id)) as vote_count
    from public.events
    where event_type = 'quiz_completed'
)
select
    shares.share_room_count::bigint           as invites_shared,
    joins.join_count::bigint                  as invitees_joined,
    votes.vote_count::bigint                  as invitees_voted,
    case
        when shares.share_room_count = 0 then null
        else round(joins.join_count::numeric / shares.share_room_count::numeric, 4)
    end as join_rate,
    case
        when shares.share_room_count = 0 then null
        else round(votes.vote_count::numeric / shares.share_room_count::numeric, 4)
    end as vote_rate
from shares, joins, votes;

comment on view public.metric_invite_acceptance is
    'TB-14 secondary engagement metric. invites_shared = distinct rooms with an invite_shared event. invitees_joined = distinct (room, user) member_joined events. invitees_voted = distinct (room, user) quiz_completed events. join_rate + vote_rate normalize against invites_shared. Null rates until at least one invite has been shared.';
