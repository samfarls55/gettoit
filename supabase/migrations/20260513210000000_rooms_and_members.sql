-- TB-02 — rooms + members schema baseline.
--
-- The first multi-user vertical: an initiator creates a `rooms` row,
-- shares a Universal Link, and the invitee joins as a `members` row.
-- Subsequent tracer bullets extend this schema:
--   * TB-03 adds `timer_minutes` + `radius_meters` columns (deferred).
--   * TB-04 adds `votes`. TB-06 adds `verdicts` + `option_cuts`.
--
-- Scope of this migration (strict):
--   * `rooms` — id, creator_user_id, status, vertical, created_at.
--   * `members` — room_id, user_id, role, joined_at.
--   * RLS — only members of a room can SELECT its rows (rooms +
--     members). Inserts gated to the authenticated caller's own
--     identity per row.
--
-- RLS rule of thumb is taken from `stack-patterns.md` §"Schema shape":
-- every per-room table filters by membership via
-- `room_id IN (SELECT room_id FROM members WHERE user_id = auth.uid())`.
-- The `rooms` table itself filters by id with the same shape.

-- ── rooms ────────────────────────────────────────────────────────────
create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),
    creator_user_id uuid not null references auth.users (id) on delete cascade,
    status text not null default 'open'
        check (status in ('open', 'verdict_ready', 'locked', 'expired')),
    vertical text not null default 'food'
        check (vertical in ('food')),  -- v1 ships food only; PRD §"User Stories" (2,3).
    created_at timestamptz not null default now()
);

comment on table public.rooms is
    'A group decision session. Created by the initiator on S01; invitees join via Universal Link. v1 supports the food vertical only.';

-- ── members ──────────────────────────────────────────────────────────
create table if not exists public.members (
    room_id uuid not null references public.rooms (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null check (role in ('owner', 'participant')),
    joined_at timestamptz not null default now(),
    primary key (room_id, user_id)
);

comment on table public.members is
    'Members of a room. The creator is inserted with role=owner; invitees who tap the deep link land here as role=participant.';

create index if not exists members_user_id_idx on public.members (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.rooms enable row level security;
alter table public.members enable row level security;

-- A user can see a room iff they're a member of it. The creator's
-- INSERT bootstraps their own membership inside the same transaction
-- (the iOS client wraps both in a single call), so the policy is
-- consistent on both sides.
drop policy if exists "rooms_select_members" on public.rooms;
create policy "rooms_select_members" on public.rooms
    for select
    to authenticated
    using (
        id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- A user can create a room only with themselves as creator.
-- Bootstrapping their own member row happens via a separate INSERT
-- in the same client call.
drop policy if exists "rooms_insert_creator_self" on public.rooms;
create policy "rooms_insert_creator_self" on public.rooms
    for insert
    to authenticated
    with check (creator_user_id = (select auth.uid()));

-- A user can read membership rows only for rooms they belong to.
drop policy if exists "members_select_room_members" on public.members;
create policy "members_select_room_members" on public.members
    for select
    to authenticated
    using (
        room_id in (select m.room_id from public.members m where m.user_id = (select auth.uid()))
    );

-- A user can insert a member row only for themselves. Role is left to
-- application logic — the creator inserts `role='owner'`, the joiner
-- inserts `role='participant'`. Anti-spam is provided by the link
-- needing to be shared first; deeper protection (signed invite tokens)
-- can be added in a later tracer bullet once the abuse surface is real.
drop policy if exists "members_insert_self" on public.members;
create policy "members_insert_self" on public.members
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));
