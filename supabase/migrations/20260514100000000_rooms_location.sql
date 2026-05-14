-- TB-03 (v1.1) — add location columns to `rooms`.
--
-- Owned by tb-03 per `design-system/surfaces/01-initiator.md` §
-- "Persistent location selector — C-23 LocationPicker": the resolved
-- place is written to `rooms.location_*` when the CTA fires.
--
-- Columns:
--   * `location_name` — the display name the LocationPicker chip
--     surfaces (e.g. `"Mission · San Francisco"`). NULL until the user
--     either grants permission (auto-resolved) or commits a manual
--     pick from the sheet.
--   * `location_lat` / `location_lng` — the coordinate the
--     PlacesProxy/MapKit fallback both consume. Stored as
--     `double precision`; Foursquare and MapKit both speak the same
--     `lat`/`lng` shape (see `PlacesProxyRequest` in `PlacesService.swift`).
--   * `location_source` — provenance of the coordinate. `'gps'` if the
--     user accepted the `whenInUse` prompt and the chip resolved via
--     `CLLocationManager`; `'manual'` if the user committed a value
--     from the typeahead sheet (either path — denied-and-manual or
--     granted-and-overrode). NULL until set. Stored so the downstream
--     consumer (Q5 wiring in bug-03) can attribute the source for
--     debugging the zero-Foursquare-calls failure mode.
--
-- All four columns are nullable — the `cannotAdvance` guard on S01
-- (CTA disabled when `state === 'empty'`) prevents a no-location room
-- from being created in the happy path, but the column has to allow
-- NULL so a future client (debug RPC, a hypothetical edge function
-- that creates rooms server-side) can still insert a row without
-- forcing a location.
--
-- Down-migration: drop the four columns. Reversible.

alter table public.rooms
    add column if not exists location_name text,
    add column if not exists location_lat double precision,
    add column if not exists location_lng double precision,
    add column if not exists location_source text
        check (location_source is null or location_source in ('gps', 'manual'));

comment on column public.rooms.location_name is
    'Initiator-selected location display name (S01 LocationPicker C-23). NULL until the user picks a value (auto-resolved on permission grant; manual-typed otherwise).';

comment on column public.rooms.location_lat is
    'Initiator-selected location latitude (S01 LocationPicker C-23). NULL until the user picks a value. Consumed by PlacesProxy + MapKit fallback.';

comment on column public.rooms.location_lng is
    'Initiator-selected location longitude (S01 LocationPicker C-23). NULL until the user picks a value. Consumed by PlacesProxy + MapKit fallback.';

comment on column public.rooms.location_source is
    'Provenance of the resolved coordinate: ''gps'' (CLLocationManager) or ''manual'' (user-typed from sheet). NULL until set. Used for debug attribution.';
