-- Legacy mobile note: references to iOS/Swift/TestFlight in this historical schema file refer to the retired Swift app; active mobile app is React Native / Expo in mobile/.
-- TB-03 â€” add `timer_minutes` + `radius_meters` to `rooms`.
--
-- Both controls live on S01 Initiator Landing (see
-- the CTA fires; defaults ship the zero-tap session.
--
-- Why both columns are nullable-free with server defaults: the iOS
-- client passes the user-selected values, but if a future client (web
-- fallback, debug RPC) inserts a `rooms` row without them, the row
-- should still be valid. The defaults match the canonical "10 min /
-- "Timer + radius controls".
--
-- Storage shape:
--   * `timer_minutes` â€” integer minutes. The four legal values are the
--     four S01 chips (`5 Â· 10 Â· 15 Â· 30`). Constrained to the set so a
--     bad client can't write 999 and have the verdict-fire trigger
--     (TB-07) try to wait an hour and a half.
--   * `radius_meters` â€” integer meters. The S01 slider ranges from
--     0.5 mi (805 m) to 5.0 mi (8047 m) in 0.5 mi steps. We store
--     meters (not miles) because the candidate-pool fetch (TB-05's
--     PlacesProxy) speaks meters to Foursquare. The check window is
--     intentionally wider than the S01 slider's range so the
--     "Widen radius" CTA on S05 no-survivor (TB-09) can push beyond
--     5 mi without an additional migration.
--
-- Down-migration: drop the two columns. Reversible.

alter table public.rooms
    add column if not exists timer_minutes integer not null default 10
        check (timer_minutes in (5, 10, 15, 30)),
    add column if not exists radius_meters integer not null default 3219
        check (radius_meters between 805 and 16093);

comment on column public.rooms.timer_minutes is
    'Initiator-set verdict-fire timer (S01). Minutes. Legal set 5/10/15/30. Default 10.';

comment on column public.rooms.radius_meters is
    'Initiator-set candidate-pool radius (S01). Meters. S01 slider exposes 805..8047 m (0.5..5.0 mi); the column allows up to 16093 m (10 mi) to accommodate the S05 no-survivor widen path (TB-09). Default 3219 m (â‰ˆ 2.0 mi).';
