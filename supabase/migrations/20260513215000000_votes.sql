-- TB-04 — votes schema.
--
-- One row per (room_id, user_id). Carries the user's answers to the
-- five quiz questions. Written by the iOS quiz coordinator on Q5
-- submit, as a single PostgREST insert. Idempotent on retry: the
-- unique constraint on (room_id, user_id) means a re-submit produces
-- a deterministic conflict the client can swallow.
--
-- The downstream consumer is the VerdictEngine (TB-06). The shape is
-- intentionally pre-baked for what the engine reads:
--   * q1_vetoes — text[] of dietary-veto identifiers
--                 (`gluten`, `dairy`, `shellfish`, `vegan_options`,
--                  `halal_only`, `nothing_tonight`).
--   * q2_budget — int 1-4 mapping to tiers (1=$, 2=$$, 3=$$$, 4=$$$$).
--                 Validated by check constraint.
--   * q3_walk_minutes — int from the discrete stop set {5,10,15,20,30}.
--                       Validated by check constraint.
--   * q4_vibe   — int 0-4 mapping to GTIVibeLabels:
--                 0=HUSHED, 1=MELLOW, 2=BUZZY, 3=LOUD, 4=ROWDY.
--   * q5_regret — jsonb shaped as { option_id: int 1-5 } where each
--                 score is regret-of-omission (1=don't mind, 5=really
--                 mind missing). TB-04 ships dummy `option_id`s from a
--                 local iOS fixture; TB-06 wires real candidate ids
--                 from the `options` table.
--
-- RLS rules:
--   * SELECT — members of the room can read votes from the same room.
--              Per `stack-patterns.md`: every per-room table filters via
--              `room_id IN (SELECT room_id FROM members WHERE user_id = auth.uid())`.
--   * INSERT — a user can only write their own vote row (user_id =
--              auth.uid()) and only into a room they're a member of.
--   * UPDATE — never. The quiz has no back arrow (PRD user story 26
--              and S03 cross-quiz invariants); a re-submit is rejected
--              at the unique-constraint level rather than allowing a
--              UPDATE. Going back pollutes regret math, so we refuse
--              at the DB layer.
--
-- The trigger that fires the VerdictEngine `AFTER INSERT ON votes`
-- lands in TB-06 with the engine itself — TB-04 ships only the
-- schema + RLS that the engine will read from.

create table if not exists public.votes (
    room_id         uuid        not null references public.rooms (id) on delete cascade,
    user_id         uuid        not null references auth.users (id) on delete cascade,
    q1_vetoes       text[]      not null default '{}',
    q2_budget       int         not null,
    q3_walk_minutes int         not null,
    q4_vibe         int         not null,
    q5_regret       jsonb       not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    primary key (room_id, user_id),
    check (q2_budget between 1 and 4),
    check (q3_walk_minutes in (5, 10, 15, 20, 30)),
    check (q4_vibe between 0 and 4)
);

comment on table public.votes is
    'Per-user quiz answers for a room. Written once on Q5 submit; the unique (room_id, user_id) constraint prevents pollution from a re-submit. Read by VerdictEngine in TB-06.';

create index if not exists votes_room_id_idx on public.votes (room_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.votes enable row level security;

-- A user can see their own vote and any other member's votes for the
-- same room. The verdict screen surfaces other members' picks as
-- voice-receipts (PRD user story 34), so room-mate read access is
-- intentional.
drop policy if exists "votes_select_room_members" on public.votes;
create policy "votes_select_room_members" on public.votes
    for select
    to authenticated
    using (
        room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- A user can insert exactly one row for themselves, in a room they
-- belong to. The (room_id, user_id) primary key handles idempotency
-- on retry (a second insert raises 23505 unique_violation that the
-- client can surface as "already submitted" or swallow).
drop policy if exists "votes_insert_self_in_room" on public.votes;
create policy "votes_insert_self_in_room" on public.votes
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- No UPDATE / DELETE policies — RLS denies by default. The quiz is
-- write-once per (room, user); correcting an answer means exiting via
-- the `×` and starting fresh, which lands the user back on the same
-- unique-constraint reject. This is intentional (PRD user story 26).
