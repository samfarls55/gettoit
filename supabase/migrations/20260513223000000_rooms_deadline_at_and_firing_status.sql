-- TB-07 — rooms.deadline_at + 'firing' status + wider members SELECT.
--
-- Three coupled changes that TB-07 needs before any RPC / trigger /
-- cron can land:
--
--   1. `rooms.deadline_at` — computed timestamp at row creation as
--      `created_at + (timer_minutes * interval '1 minute')`. Drives
--      the iOS countdown and the auto-fire cron path. Nullable on
--      the column for forward compatibility (a hypothetical future
--      room type without a timer), but populated for every TB-07
--      row via a BEFORE INSERT trigger that reads `timer_minutes`.
--      We don't use a generated column because Postgres generated
--      columns must be `IMMUTABLE` — `now()` and `interval` arithmetic
--      based on `created_at` (itself the row default) aren't allowed
--      in a STORED generated expression. A BEFORE INSERT trigger is
--      the simplest pattern that gives "computed-on-insert" semantics.
--
--   2. `rooms.status` widens its check constraint to include `firing`.
--      Lifecycle: `open` → `firing` → `verdict_ready` → `locked`,
--      with `expired` as the parallel terminal when timer ran out
--      below quorum. The initiator's manual-fire RPC and the cron
--      auto-fire path both flip `open → firing`; the VerdictEngine
--      then flips `firing → verdict_ready` once it writes the
--      verdict row. Decoupling `firing` from `verdict_ready` makes
--      the trigger and cron idempotent — whichever path wins the
--      race sets `status='firing'` first and the loser sees a row
--      not in `'open'` status and becomes a no-op.
--
--   3. Wider members SELECT — TB-02 narrowed `members_select_self`
--      to "user can only see their own member row." S04 Waiting
--      needs every member to see every co-member (avatar row).
--      `stack-patterns.md §"RLS — schema-level recursion landmines"`
--      and the comments in `20260513210500000_fix_members_rls_recursion.sql`
--      both call out the path: a `SECURITY DEFINER` helper function
--      that bypasses RLS internally and returns whether (room, user)
--      pair is a member. We add `public.is_room_member(uuid, uuid)`
--      here, then add a second members SELECT policy that admits
--      rows whose `room_id` the caller is a member of.
--
-- Forward-compatibility note on `deadline_at`:
--   * Migration is reversible: drop the column, drop the trigger,
--     drop the policy and helper. The previous `members_select_self`
--     policy remains in place, so dropping the new policy doesn't
--     regress visibility — it narrows back.

-- ── 1. rooms.deadline_at column + insert trigger ────────────────────

alter table public.rooms
    add column if not exists deadline_at timestamptz;

comment on column public.rooms.deadline_at is
    'Computed at insert as created_at + timer_minutes minutes. Drives the iOS countdown + the auto-fire pg_cron path. Nullable in the column schema for forward compat, but populated for every row by the BEFORE INSERT trigger.';

-- BEFORE INSERT trigger that sets deadline_at if the caller didn't
-- pass one explicitly. We honour an explicit value when present
-- (tests + admin tools can pre-set it); the typical iOS path
-- inserts without `deadline_at` and lets the trigger compute it.
create or replace function public.rooms_set_deadline_at()
returns trigger
language plpgsql
as $$
begin
    if new.deadline_at is null then
        new.deadline_at := coalesce(new.created_at, now())
                         + (new.timer_minutes * interval '1 minute');
    end if;
    return new;
end;
$$;

drop trigger if exists rooms_set_deadline_at on public.rooms;
create trigger rooms_set_deadline_at
    before insert on public.rooms
    for each row
    execute function public.rooms_set_deadline_at();

-- Backfill rows that pre-date this migration (TB-02..TB-06 test
-- rooms with `deadline_at` still null). Same computation as the
-- trigger.
update public.rooms
set deadline_at = created_at + (timer_minutes * interval '1 minute')
where deadline_at is null;

-- ── 2. rooms.status widening — accept 'firing' ──────────────────────

alter table public.rooms
    drop constraint if exists rooms_status_check;

alter table public.rooms
    add constraint rooms_status_check
    check (status in ('open', 'firing', 'verdict_ready', 'locked', 'expired'));

comment on column public.rooms.status is
    'Room lifecycle. open → firing → verdict_ready → locked, with expired as the terminal when the timer ran out below quorum. firing is set by the manual-fire RPC OR the pg_cron auto-fire path; verdict_ready by the VerdictEngine after writing the verdict row.';

-- ── 3. is_room_member helper + wider members SELECT ────────────────

-- SECURITY DEFINER bypasses RLS inside the function body, so the
-- subquery against `public.members` doesn't trigger the recursion
-- the inline policy would. `STABLE` lets Postgres cache results
-- inside a single statement (RLS evaluates the function many times
-- per query).
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.members m
        where m.room_id = p_room_id
          and m.user_id = p_user_id
    );
$$;

comment on function public.is_room_member(uuid, uuid) is
    'TB-07 helper that breaks the members RLS recursion. SECURITY DEFINER + empty search_path so the function body runs with the postgres role (RLS bypass) and reads members directly without entering its own policy. Used by the wider members SELECT policy that admits all co-members for the S04 Waiting avatar row.';

revoke all on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;

-- Wider members SELECT — any authenticated user can read members of
-- a room they themselves are a member of. The helper bypasses RLS
-- internally to evaluate "is the caller a member of this room?"
-- without recursing through the `members` SELECT policy.
drop policy if exists "members_select_via_helper" on public.members;
create policy "members_select_via_helper" on public.members
    for select
    to authenticated
    using (
        public.is_room_member(room_id, (select auth.uid()))
    );

-- The narrower `members_select_self` policy from TB-02 remains in
-- place so a user can still read their own member row even when
-- they aren't yet visible-as-a-co-member to themselves (i.e. during
-- the room-create bootstrap, before the rooms SELECT policy admits
-- them). Postgres OR's the two policies — broader visibility wins
-- without removing the bootstrap-safe path.
