-- TB-08 — ratifications + push_tokens schema.
--
-- Two new tables to back the I'm-in ratification + push permission
-- mechanics on S05. Both follow the canonical RLS shape from
-- `stack-patterns.md` §"Schema shape" (room-scoped for per-room
-- tables; self-scoped for per-user tables).
--
-- `ratifications` — one row per (verdict, user). Written when the
-- viewer taps "I'm in" on S05's committed-mode CTA. Idempotent on
-- retry via the (verdict_id, user_id) PRIMARY KEY. SELECT is room-
-- scoped so the surface can render the live mutual-state count
-- (`"You're in · N of M"`).
--
-- `push_tokens` — one row per (user_id, device_token). Written by the
-- iOS PushCoordinator after the user grants the native notification
-- permission and `UIApplication.registerForRemoteNotifications`
-- returns the APNs device token. The APNsSender Edge Function reads
-- this table to fan out to the right devices. SELECT is self-scoped
-- — a user only sees their own tokens. The service-role key bypasses
-- RLS for the Edge Function's fanout reads.
--
-- Why ratifications.ratified_at is timestamptz default now():
--   * Used by the S06 hard-close window check: a room locks
--     `verdict_committed_at + correctability_window_seconds` after
--     the FIRST ratification per `surfaces/06-hard-close.md`. The
--     window-start is captured separately on `rooms` (see
--     `20260514000010000_rooms_lock_columns.sql`); ratified_at is
--     surfaced on the S05 receipt for the per-member "in" indicator.
--   * Indexed on (verdict_id, ratified_at desc) so the count query
--     hits a clean index when iOS subscribes to the Realtime updates.
--
-- Why push_tokens.platform text:
--   * Currently only stores 'ios'. The column anticipates 'web' / 'android'
--     later but the check constraint keeps the schema honest (only 'ios'
--     admitted today). Bump the check when expanding.

-- ── ratifications ────────────────────────────────────────────────────
create table if not exists public.ratifications (
    verdict_id   uuid        not null references public.verdicts (id) on delete cascade,
    user_id      uuid        not null references auth.users (id) on delete cascade,
    ratified_at  timestamptz not null default now(),
    primary key (verdict_id, user_id)
);

comment on table public.ratifications is
    'One row per (verdict, user) when the user taps "I''m in" on S05. The first ratification per verdict starts the correctability window (see `rooms.verdict_committed_at` setter trigger). Re-ratifying is a no-op via the PK; updates are not allowed (RLS).';

create index if not exists ratifications_verdict_id_idx
    on public.ratifications (verdict_id, ratified_at desc);

-- ── push_tokens ──────────────────────────────────────────────────────
create table if not exists public.push_tokens (
    user_id        uuid        not null references auth.users (id) on delete cascade,
    device_token   text        not null,
    platform       text        not null
        check (platform in ('ios')),  -- ios only today; bump when web/android land
    registered_at  timestamptz not null default now(),
    primary key (user_id, device_token)
);

comment on table public.push_tokens is
    'APNs device tokens for a user. Written by iOS PushCoordinator after the native push-permission grant. Read by the apns-sender Edge Function (service-role) for fanout. Currently supports ''ios'' only.';

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.ratifications enable row level security;
alter table public.push_tokens enable row level security;

-- Members of the room a verdict belongs to can read its ratifications.
-- The live mutual-state count surfaces every member's ratification.
drop policy if exists "ratifications_select_room_members" on public.ratifications;
create policy "ratifications_select_room_members" on public.ratifications
    for select
    to authenticated
    using (
        verdict_id in (
            select v.id from public.verdicts v
            where v.room_id in (
                select m.room_id from public.members m
                where m.user_id = (select auth.uid())
            )
        )
    );

-- A user can insert exactly one ratification row for themselves on a
-- verdict belonging to a room they're a member of.
drop policy if exists "ratifications_insert_self_in_room" on public.ratifications;
create policy "ratifications_insert_self_in_room" on public.ratifications
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and verdict_id in (
            select v.id from public.verdicts v
            where v.room_id in (
                select m.room_id from public.members m
                where m.user_id = (select auth.uid())
            )
        )
    );

-- No UPDATE / DELETE policies — RLS denies by default. The "I'm in"
-- tap is voluntary and once-only per verdict per S05 §"Copy register";
-- un-ratifying would re-litigate the commitment, which the hard-close
-- mechanic explicitly defends against.

-- A user reads only their own push tokens.
drop policy if exists "push_tokens_select_self" on public.push_tokens;
create policy "push_tokens_select_self" on public.push_tokens
    for select
    to authenticated
    using (user_id = (select auth.uid()));

-- A user inserts only their own push tokens. Re-registering the same
-- (user, device_token) pair is a no-op via the PK; the iOS client
-- swallows the unique-violation as "already registered."
drop policy if exists "push_tokens_insert_self" on public.push_tokens;
create policy "push_tokens_insert_self" on public.push_tokens
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));

-- A user can delete their own push token rows. The PushCoordinator
-- calls this on registration failures and on the in-app delete path
-- (TB-16). The apns-sender Edge Function uses the service-role key
-- which bypasses RLS.
drop policy if exists "push_tokens_delete_self" on public.push_tokens;
create policy "push_tokens_delete_self" on public.push_tokens
    for delete
    to authenticated
    using (user_id = (select auth.uid()));
