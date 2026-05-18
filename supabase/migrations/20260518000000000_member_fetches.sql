-- TB-21 (v1.1) — per-member raw candidate fetch persistence.
--
-- Parent: bug-08 — the verdict candidate-pool integration was never
-- wired. `options` had no writer anywhere, so it was empty across all
-- 2587 rooms and `compute-verdict` returned `no_candidates` (404). The
-- bug-08 fork was decided 2026-05-18: Option 2, server-side. This
-- migration lands the storage half of that decomposition.
--
-- The problem
-- ───────────
-- `QuizCandidateFetch` (iOS) fetches a member's full per-member venue
-- union from Foursquare, classifies it, runs the factorial to pick the
-- three Q5 cards — and then discards the union as a local variable.
-- Nothing persisted the raw fetched pool, so the verdict engine had no
-- candidates to rank.
--
-- The shape
-- ─────────
-- `member_fetches` — one row per (room_id, user_id). `payload` is the
-- jsonb array of every venue that member's fetch returned (the full
-- raw union, NOT just the three Q5 factorial cards). Written by the
-- iOS quiz coordinator at quiz time, immediately before the Q5 vote.
--
-- Why a dedicated table rather than a `votes` jsonb slot:
--   * The fetched union is large (up to ~50 venues per Foursquare
--     call, N+1 calls) — keeping it off the `votes` row keeps the
--     verdict-engine's `votes` read tight.
--   * The fetch resolves on the Q4 -> Q5 transition, strictly before
--     the Q5 vote is submitted. A separate table lets the two writes
--     stay independent; a `votes` slot would force them to be one
--     atomic write or force a `votes` UPDATE (which the v1.1 RLS
--     contract forbids — see `20260513215000000_votes.sql`).
--   * `payload` is kept opaque jsonb so the venue shape (the iOS
--     `ShapedPlace` / Edge `ShapedPlace`) can evolve without a
--     migration — the same rationale as `places.payload` and
--     `options.payload`.
--
-- The server side
-- ───────────────
-- At verdict fire time the `compute-verdict` Edge Function reads every
-- member's `member_fetches` row for the room, assembles the candidate
-- pool as the running union of those fetches (first-seen dedup by
-- `fsq_place_id`), and writes the union into `options`. The server is
-- the single owner of the union — iOS never writes `options`.
--
-- RLS rules (mirrors `votes`):
--   * SELECT — members of the room can read fetch rows from the same
--              room (`room_id IN (SELECT room_id FROM members WHERE
--              user_id = auth.uid())`). The compute-verdict Edge
--              Function reads via the service-role key (RLS bypass).
--   * INSERT — a user can write exactly their own fetch row, only
--              into a room they belong to.
--   * UPDATE — a member can overwrite their own fetch row. Unlike
--              `votes` (write-once — a re-answer pollutes regret math),
--              re-running the quiz SHOULD replace the stale fetch: the
--              union must reflect the member's latest fetch, not a
--              stacked duplicate. The iOS writer upserts on the
--              (room_id, user_id) primary key.
--   * DELETE — never. No policy; RLS denies by default.

create table if not exists public.member_fetches (
    room_id     uuid        not null references public.rooms (id) on delete cascade,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    payload     jsonb       not null,
    fetched_at  timestamptz not null default now(),
    primary key (room_id, user_id)
);

comment on table public.member_fetches is
    'TB-21 (v1.1) — per-member raw Foursquare candidate fetch. payload is the jsonb array of every venue the member''s fetch returned (the full raw union, not the three Q5 factorial cards). Written by the iOS quiz coordinator at quiz time; read by the compute-verdict Edge Function, which unions every member''s fetch into the options table at verdict fire time.';

create index if not exists member_fetches_room_id_idx
    on public.member_fetches (room_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.member_fetches enable row level security;

-- A member can read any room-mate's fetch row for a room they belong
-- to. Symmetric with the `votes` SELECT policy; the compute-verdict
-- function bypasses RLS via the service-role key regardless.
drop policy if exists "member_fetches_select_room_members" on public.member_fetches;
create policy "member_fetches_select_room_members" on public.member_fetches
    for select
    to authenticated
    using (
        room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- A user can insert exactly their own fetch row, into a room they
-- belong to.
drop policy if exists "member_fetches_insert_self_in_room" on public.member_fetches;
create policy "member_fetches_insert_self_in_room" on public.member_fetches
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- A user can overwrite their own fetch row. Re-running the quiz must
-- replace the stale fetch so the server-side union reflects the
-- member's latest fetch — the iOS writer upserts on the primary key.
drop policy if exists "member_fetches_update_self_in_room" on public.member_fetches;
create policy "member_fetches_update_self_in_room" on public.member_fetches
    for update
    to authenticated
    using (
        user_id = (select auth.uid())
        and room_id in (select room_id from public.members where user_id = (select auth.uid()))
    )
    with check (
        user_id = (select auth.uid())
        and room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- No DELETE policy — RLS denies by default.
