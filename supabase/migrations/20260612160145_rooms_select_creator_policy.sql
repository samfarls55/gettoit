-- Plan launch creates a Room, then asks PostgREST to return that Room so the
-- client can create the owner membership. Allow the creator to see that row
-- before the membership row exists.
drop policy if exists "rooms_select_creator" on public.rooms;

create policy "rooms_select_creator" on public.rooms
  for select
  to authenticated
  using (creator_user_id = (select auth.uid()));
