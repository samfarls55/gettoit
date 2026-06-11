-- TB-06 (Google Places migration) — lock Room parameters after launch.
--
-- Search area, meal timing, and service-mode parameters are fixed for an
-- active Room. Changing them requires starting a new decision / Room.

drop policy if exists "plans_update_creator" on public.plans;
create policy "plans_update_creator" on public.plans
    for update
    to authenticated
    using (
        creator_id = (select auth.uid())
        and status = 'pending'
        and not exists (
            select 1
            from public.rooms r
            where r.plan_id = plans.id
        )
    )
    with check (
        creator_id = (select auth.uid())
        and status = 'pending'
        and not exists (
            select 1
            from public.rooms r
            where r.plan_id = plans.id
        )
    );

create or replace function public.prevent_active_room_parameter_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if old.plan_id is not null and (
        new.location_name is distinct from old.location_name
        or new.location_lat is distinct from old.location_lat
        or new.location_lng is distinct from old.location_lng
        or new.location_source is distinct from old.location_source
        or new.radius_meters is distinct from old.radius_meters
        or new.timer_minutes is distinct from old.timer_minutes
        or new.session_params is distinct from old.session_params
    ) then
        raise exception
            using errcode = '23514',
                  message = 'search_area_locked',
                  detail = 'Room parameters are locked; start a new decision to change them.';
    end if;

    return new;
end;
$$;

comment on function public.prevent_active_room_parameter_mutation() is
    'TB-06 Google migration guard. Blocks Search area and session-parameter mutation for launched Plan-backed Rooms.';

drop trigger if exists rooms_lock_active_parameters on public.rooms;
create trigger rooms_lock_active_parameters
    before update on public.rooms
    for each row
    execute function public.prevent_active_room_parameter_mutation();
