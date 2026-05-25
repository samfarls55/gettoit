-- Quiz redesign (Q5 open_at fix) — add the search area's timezone to `rooms`.
--
-- Foursquare's `/places/search` `open_at` filter is interpreted in the
-- venue's local time. The per-member fetch planner therefore has to
-- resolve the meal-time wall clock against the timezone of the SEARCH
-- AREA, not the user's device — a manually-picked area can sit in a
-- different zone than the phone, and a joiner's device is unrelated to
-- the initiator's pick.
--
-- `location_tz` stores the IANA identifier of the picked area (e.g.
-- `America/New_York`). iOS resolves it for free from the placemark when
-- the coordinate is committed, then persists it here so initiator and
-- joiner plan `open_at` against the same timezone.
--
-- Nullable, like the other `location_*` columns: a room created before
-- this column existed (or by a debug RPC) leaves it NULL, and the iOS
-- planner falls back to the device timezone on an absent value.
--
-- Down-migration: drop the column. Reversible.

alter table public.rooms
    add column if not exists location_tz text;

comment on column public.rooms.location_tz is
    'IANA timezone identifier of the initiator-selected location (S01 LocationPicker C-23). NULL until set. The per-member Foursquare fetch plans open_at (venue-local) against this zone so initiator and joiner agree.';
