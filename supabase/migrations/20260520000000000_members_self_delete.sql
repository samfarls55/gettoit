-- tb-WF-2 — add a DELETE-self RLS policy to public.members.
--
-- Context: the workflow-overhaul §Q5 nav verbs land an `Exit` / `Leave`
-- affordance on every quiz surface (sg-WF-2 spec). Confirming Exit
-- drops the caller's row from `members` so the room continues for the
-- remaining participants; for a solo session, the room also expires
-- (handled by the existing `rooms_update_creator` policy from TB-05).
--
-- The original `members` migration (20260513210000000_rooms_and_members)
-- shipped only SELECT + INSERT policies. With RLS enabled and no DELETE
-- policy, every client DELETE is silently denied (PostgREST reports 0
-- rows affected, no error) — so `MemberLeaveStore.leave` would be a
-- no-op without this policy.
--
-- Scope: the policy admits ONLY the caller's own membership row
-- (`user_id = auth.uid()`). A user can never drop someone else's
-- membership — that would let any room member kick anyone else out,
-- which is not a verb the original product carries (the `Plan delete` verb
-- on sg-WF-4 is a separate initiator-only flow that deletes the
-- entire Plan, not individual members).
--
-- Cascade: nothing references `members` with `on delete cascade`, so
-- this DELETE only removes the row itself. The user's `votes` row
-- (if any) stays — the verdict engine reads votes by `(room_id,
-- user_id)` and naturally ignores a missing membership. The
-- `member_fetches` row also stays so the verdict can still union
-- the exiter's contributed candidate pool into `options` if the
-- room reaches verdict without them; an in-flight quiz that never
-- wrote `votes` (the common Exit case) leaves no vote row at all.
--
-- Idempotency: re-running this migration is safe (`drop policy if
-- exists` then `create policy`).
--
-- Down-migration: drop the policy. Reversible.

drop policy if exists "members_delete_self" on public.members;
create policy "members_delete_self" on public.members
    for delete
    to authenticated
    using (user_id = (select auth.uid()));

comment on policy "members_delete_self" on public.members is
    'tb-WF-2: admits a member to drop their own membership row '
    '(self-DELETE). Wires the Quiz chrome Exit/Leave affordance — '
    'the user leaves the room, but the room remains for any '
    'remaining members. A user can never drop someone else''s '
    'membership through this policy.';
