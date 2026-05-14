-- TB-05 — Foursquare PlacesProxy cache + per-room option snapshots.
--
-- Two tables:
--   * `places`  — Foursquare response cache. Keyed by (geo_h3,
--                 query_signature). Read-shared (any authenticated
--                 user can SELECT to power the PlacesProxy Edge
--                 Function), write-only by the service role (the
--                 Edge Function uses SUPABASE_SERVICE_ROLE_KEY).
--                 24h hot / 7d cold TTL is enforced in the Edge
--                 Function (cached_at column carries the timestamp).
--   * `options` — per-room candidate snapshots. One row per
--                 (room_id, fsq_place_id). Read-only to members of
--                 the room (RLS gates SELECT on `members`); writes
--                 stay server-side (Edge Function on room create,
--                 VerdictEngine on reroll).
--
-- The `places` table is keyed by `geo_h3` text so we can swap from
-- the current quantised lat/lng bucket to a real H3 cell without a
-- schema change. See ADR 0002 §"Live API surface" + TB-05.
--
-- Naming notes:
--   * `fsq_place_id` (NOT the legacy `fsq_id`) — Foursquare migrated
--     the identifier in the 2025 Places API surface bump. See ADR 0002.
--   * `payload jsonb` — kept opaque on purpose so the Edge Function
--     can evolve the shape without a migration. The shape is
--     described in `supabase/functions/_shared/foursquare.ts`
--     (`ShapedPlace` interface).

-- ---------------------------------------------------------------------
-- places — Foursquare cache.
-- ---------------------------------------------------------------------

create table if not exists public.places (
  geo_h3          text        not null,
  query_signature text        not null,
  payload         jsonb       not null,
  cached_at       timestamptz not null default now(),
  primary key (geo_h3, query_signature)
);

-- Cached_at index speeds the periodic TTL sweep (not yet implemented
-- — the v1 Edge Function checks freshness at read time; a later
-- pg_cron job will hard-delete rows older than 30 days).
create index if not exists places_cached_at_idx
  on public.places (cached_at);

alter table public.places enable row level security;

-- Read-shared: any authenticated user can read the cache. This is
-- safe because the cached payload contains no per-user data — only
-- Foursquare's public place metadata.
--
-- Writes: NO insert/update/delete policy exists, so RLS denies writes
-- to authenticated and anon roles by default. The PlacesProxy Edge
-- Function uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS — that
-- is the only path that writes the cache.
drop policy if exists "places: authenticated read" on public.places;
create policy "places: authenticated read"
  on public.places
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- options — per-room candidate snapshots.
-- ---------------------------------------------------------------------

create table if not exists public.options (
  id            uuid        primary key default gen_random_uuid(),
  room_id       uuid        not null,
  fsq_place_id  text        not null,
  payload       jsonb       not null,
  created_at    timestamptz not null default now(),
  unique (room_id, fsq_place_id)
);

create index if not exists options_room_id_idx
  on public.options (room_id);

alter table public.options enable row level security;

-- Members of the room can read its options. We don't have a `members`
-- table yet — TB-02 lands it. Without `members`, we cannot express
-- "members of the room can read" safely, so RLS stays in DEFAULT-DENY:
-- no SELECT policy means no authenticated read. The PlacesProxy Edge
-- Function reads via the service-role key (RLS bypass) regardless.
--
-- TB-02 / TB-06 follow-up: once `public.members(room_id, user_id, role)`
-- exists, add a SELECT policy along the lines of:
--
--   create policy "options: room members read"
--     on public.options
--     for select
--     to authenticated
--     using (
--       room_id in (
--         select room_id from public.members
--         where user_id = auth.uid()
--       )
--     );
--
-- Writes: no policy → denied to authenticated/anon by default. Edge
-- Functions populate `options` via the service-role key.
