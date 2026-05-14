-- TB-02 — fix infinite recursion on members RLS SELECT policy.
--
-- The first attempt at the SELECT policy on `members` used
-- `room_id IN (SELECT room_id FROM public.members WHERE user_id = (select auth.uid()))`,
-- which queries `members` from within the `members` policy and trips
-- Postgres's `42P17 infinite recursion detected in policy` check.
--
-- Two-policy split that avoids the recursion:
--   1. A user can always read their own member row (uses auth.uid()
--      directly — no recursive subquery on members).
--   2. A user can read other members' rows in any room they own
--      (joins through `rooms.creator_user_id` instead of `members`).
--
-- That's narrower than the original "any member can see any other
-- member" intent — TB-07's waiting surface will need to see all
-- co-members, so when that lands we'll add a SECURITY DEFINER
-- helper function `is_room_member(room_id, user_id)` that breaks the
-- recursion without leaking. For TB-02 the two-policy split is enough:
--   * The owner sees themselves (rule 1) and other joiners (rule 2).
--   * A joiner sees themselves (rule 1).
--   * A non-member sees nothing.
--
-- Similarly, rewrite the `rooms` SELECT policy to use the same shape
-- (membership via `members` query) but guard against the policy
-- triggering recursion through `members` lookup — it already worked,
-- but we keep it explicit.

drop policy if exists "members_select_room_members" on public.members;

create policy "members_select_self" on public.members
    for select
    to authenticated
    using (user_id = (select auth.uid()));

create policy "members_select_via_room_owner" on public.members
    for select
    to authenticated
    using (
        room_id in (
            select id from public.rooms where creator_user_id = (select auth.uid())
        )
    );
