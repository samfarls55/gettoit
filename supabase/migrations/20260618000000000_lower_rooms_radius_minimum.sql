-- Lower the active Room Search area minimum from 0.5 mi to 0.25 mi.
-- `rooms.radius_meters` stores rounded meters; 0.25 mi ~= 402.336 m.

alter table public.rooms
    drop constraint if exists rooms_radius_meters_check,
    add constraint rooms_radius_meters_check
        check (radius_meters between 402 and 16093);

comment on column public.rooms.radius_meters is
    'Initiator-set candidate-pool radius. Meters. Search area exposes 402..16093 m (0.25..10.0 mi). Default 3219 m (about 2.0 mi).';
