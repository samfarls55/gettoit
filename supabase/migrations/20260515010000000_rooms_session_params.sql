-- TB-05 (quiz redesign) — add the `session_params` jsonb column to `rooms`.
--
-- The *parameters* bucket of the quiz redesign's three-bucket input model (see
-- `gti-vault/10_prds/0.1.0-quiz-redesign-prd.md` module (K)). Parameters
-- are the session settings that are CONSISTENT ACROSS EVERY PARTICIPANT
-- — the initiator sets them once on the pre-quiz S01b surface, and every
-- joiner reads them back without re-prompting.
--
-- Three of the five PRD parameters live in this column:
--   * meal_time      — drives the Foursquare `open_at` filter.
--   * group_context  — solo / duo / group; sizes the recommendation.
--   * service_shape  — dine-in (indoor/outdoor) vs takeout
--                      (pickup/delivery).
--   * transport_mode — walk / drive; sets the default S01 radius.
--
-- The remaining two PRD parameters already have homes and are NOT
-- duplicated here:
--   * geography — `rooms.location_*` (TB-03), captured via the
--                 C-23 LocationPicker on S01.
--   * radius    — `rooms.radius_meters` (TB-03). Transport mode only
--                 supplies a *default* radius the initiator can still
--                 override on S01's slider.
--
-- Storage shape: ONE generic `jsonb` column, not four typed columns.
-- This mirrors the TB-04 generic-jsonb `votes` decision (ADR 0010):
-- the redesign is still settling which parameters the quiz
-- consumes, and a flat jsonb object lets a parameter be added,
-- removed, or have its option set changed WITHOUT a migration. The
-- column stores `{ meal_time, group_context, service_shape,
-- transport_mode }` — string enum raw values.
--
-- The column is NULLABLE. A NULL value means the room was created by
-- a client that predates the S01b surface (or a debug RPC). Every
-- reader (`RoomStore` decode, the joiner hydration path) falls back to
-- `SessionParameters.default` on NULL, so a missing column never
-- strands a session — same "sensible default" contract S01's timer +
-- radius controls follow.
--
-- A lightweight CHECK enforces only that a PRESENT value is a jsonb
-- object. Per-field option validation deliberately stays in the
-- client (`SessionParameters` tolerant decode) and is NOT pinned in
-- the DB: pinning the option set here would re-couple the schema to
-- one fixed parameter design, which is the exact coupling the generic
-- jsonb shape exists to avoid.
--
-- Down-migration: drop the column. Reversible.

alter table public.rooms
    add column if not exists session_params jsonb,
    add constraint rooms_session_params_is_object check (
        session_params is null
        or jsonb_typeof(session_params) = 'object'
    );

comment on column public.rooms.session_params is
    'TB-05 (quiz redesign) — parameters bucket. Initiator-set, session-wide, '
    'consistent across every participant. Flat jsonb object: '
    '{ meal_time, group_context, service_shape, transport_mode }. '
    'NULL on rooms created before S01b; readers fall back to defaults. '
    'Generic jsonb (cf. votes, ADR 0010) so parameter content can '
    'change without a migration.';

-- ── RLS: let the room creator UPDATE their own room ──────────────────
-- The S01b surface persists the parameters via a `rooms` UPDATE after
-- the room already exists (the room is created on S01 to mint the
-- share link / roomID). The original `rooms` migration shipped only
-- SELECT + INSERT policies — with RLS enabled and no UPDATE policy,
-- every client UPDATE is silently denied (PostgREST reports 0 rows
-- affected, no error), so `RoomStore.updateSessionParameters` would
-- be a no-op without this policy.
--
-- Scope: the policy admits ONLY the room's creator
-- (`creator_user_id = auth.uid()`). A joiner can never overwrite the
-- shared parameters — which is exactly the *parameters* bucket
-- contract (initiator-set, session-wide). `with check` repeats the
-- predicate so the creator cannot UPDATE the row into one they no
-- longer own.
--
-- The verdict-fire / lock / deadline triggers that also UPDATE
-- `rooms` run as SECURITY DEFINER functions and bypass RLS entirely,
-- so this client-facing policy does not affect them.
drop policy if exists "rooms_update_creator" on public.rooms;
create policy "rooms_update_creator" on public.rooms
    for update
    to authenticated
    using (creator_user_id = (select auth.uid()))
    with check (creator_user_id = (select auth.uid()));
