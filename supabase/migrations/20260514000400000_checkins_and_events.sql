-- TB-14 — check_ins + events schema.
--
-- The two telemetry tables backing the v1 north-star metric and the
-- secondary metrics. Schema sketch from
-- `gti-vault/60_engineering/adr/0005-telemetry-supabase-event-store.md`:
--
--   * `events`    — generic event store. One row per emitted product
--                   moment (`room_created`, `quiz_completed`,
--                   `verdict_ready`, `ratified`, `rerolled`, etc.).
--                   `properties` jsonb carries the payload.
--   * `check_ins` — outcome of the next-day push: `went` / `skipped`
--                   / `snoozed` / `no_signal`. `reason` is set only on
--                   `skipped`. `no_signal` is set by the per-day
--                   sweeper for verdicts older than 3 days where no
--                   response landed.
--
-- RLS shape (ADR 0005 §"Decision"):
--   * `events` — INSERT scoped to the caller's own user_id (own rows
--     only). SELECT denied to authenticated; service-role bypasses for
--     the SQL views.
--   * `check_ins` — INSERT scoped to the caller's own user_id, and
--     only for verdicts in rooms they belong to. No UPDATE / DELETE
--     policies — once a user reports an outcome, that's the durable
--     record. SELECT denied to authenticated; service-role bypasses
--     for the SQL views.
--
-- The SELECT-denied posture matters: the surface explicitly defends
-- against "see what X likes" cross-room visibility (PRD user story
-- 77). Even within a room a member can't read another member's
-- check-in row. The metric views run as service-role and aggregate
-- before exposing anything.
--
-- Indices:
--   * `events (event_type, created_at)` — speeds up the time-to-verdict
--     median and invite-acceptance counts.
--   * `events (room_id, created_at)` — speeds up per-room rollups for
--     a future ops dashboard.
--   * `check_ins (room_id, user_id)` UNIQUE — exactly one outcome per
--     (room, user). The user can change their mind by re-tapping, which
--     the iOS layer suppresses; the DB-level uniqueness is the second
--     line of defense. Re-tapping after first answer is a no-op via
--     `ON CONFLICT DO NOTHING` in the iOS writer.

-- ── events ──────────────────────────────────────────────────────────
create table if not exists public.events (
    id          uuid        primary key default gen_random_uuid(),
    room_id     uuid        references public.rooms (id) on delete set null,
    user_id     uuid        references auth.users (id) on delete set null,
    event_type  text        not null,
    properties  jsonb       not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);

comment on table public.events is
    'TB-14 — generic event store. One row per emitted product moment (room_created, quiz_completed, verdict_ready, ratified, rerolled, etc.). Feeds the SQL metric views. Per ADR 0005.';

comment on column public.events.event_type is
    'Machine-readable event name. Documented set: room_created, quiz_completed, verdict_ready, ratified, rerolled, invite_shared, member_joined.';

comment on column public.events.properties is
    'Free-form jsonb payload carrying event-specific fields. Documented shapes live in TelemetryWriter (iOS) — schema-less by design so new event_types don''t require migrations.';

create index if not exists events_event_type_created_at_idx
    on public.events (event_type, created_at);

create index if not exists events_room_id_created_at_idx
    on public.events (room_id, created_at);

-- ── check_ins ───────────────────────────────────────────────────────
create table if not exists public.check_ins (
    room_id     uuid        not null references public.rooms (id) on delete cascade,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    outcome     text        not null
        check (outcome in ('went', 'skipped', 'snoozed', 'no_signal')),
    reason      text,
    created_at  timestamptz not null default now(),
    primary key (room_id, user_id)
);

comment on table public.check_ins is
    'TB-14 — one row per (room, user) — the next-day check-in outcome. outcome ∈ {went, skipped, snoozed, no_signal}. reason set only on skipped. no_signal is written by cron_mark_no_signal_checkins for verdicts past 3 days with no response. Per ADR 0005 + S08 surface spec.';

comment on column public.check_ins.outcome is
    'Outcome category. `went` and `skipped` are the metric numerator/denominator inputs. `snoozed` (Ask me later) and `no_signal` (3-day auto-sweeper) are EXCLUDED from the metric to keep the cohort honest.';

comment on column public.check_ins.reason is
    'When outcome=skipped, one of the reason chips from S08: wallet_time, group_bailed, place_packed, mood_shifted, other. Null for non-skipped outcomes. Stored privately — never visible to the group.';

create index if not exists check_ins_room_id_idx on public.check_ins (room_id);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.events    enable row level security;
alter table public.check_ins enable row level security;

-- A user can only insert events for themselves OR for a null user_id
-- (anonymous-context events like a future server-side counter). The
-- room_id, when present, must be one the user is a member of — keeps
-- a malicious client from forging events on rooms they don't belong
-- to (e.g. inflating someone else's invite_acceptance counter).
drop policy if exists "events_insert_self" on public.events;
create policy "events_insert_self" on public.events
    for insert
    to authenticated
    with check (
        (user_id is null or user_id = (select auth.uid()))
        and (
            room_id is null
            or room_id in (
                select room_id from public.members where user_id = (select auth.uid())
            )
        )
    );

-- No SELECT policy → SELECT denied. The service-role key (used by
-- the SQL views + a future ops dashboard) bypasses RLS.

-- A user inserts their own check_ins for a verdict in a room they
-- belong to. The CheckinScheduler dispatches the push that fires this
-- surface; the iOS surface tap writes the row through PostgREST.
drop policy if exists "check_ins_insert_self_in_room" on public.check_ins;
create policy "check_ins_insert_self_in_room" on public.check_ins
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and room_id in (
            select room_id from public.members where user_id = (select auth.uid())
        )
    );

-- No SELECT / UPDATE / DELETE — RLS denies by default. The iOS surface
-- doesn't need to read back its own check-in; the tap is fire-and-
-- forget. The metric views read via service-role.
