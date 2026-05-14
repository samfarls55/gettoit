-- TB-02 — drop the `members_select_via_room_owner` policy that recurses
-- through the rooms SELECT policy.
--
-- Background: the previous migration tried to widen members SELECT
-- visibility with a second policy that joined through `rooms` instead
-- of `members` — but the `rooms` SELECT policy itself joins through
-- `members`, so this two-step bounce triggered
-- `42P17 infinite recursion detected in policy for relation "rooms"`.
--
-- TB-02 only needs every user to see their OWN `members` row. The
-- `rooms` SELECT policy joins through `members`, but it only needs the
-- caller's own member row to know which rooms to admit — `members_select_self`
-- alone is enough.
--
-- Wider visibility (any member sees every other member of a shared
-- room) lands in TB-07 via a SECURITY DEFINER helper that bypasses
-- the recursion. Out of scope here.

drop policy if exists "members_select_via_room_owner" on public.members;
