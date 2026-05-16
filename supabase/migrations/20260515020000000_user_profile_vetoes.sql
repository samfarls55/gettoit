-- TB-12 (v1.1) — per-account profile vetoes.
--
-- Adds a single `profile_vetoes` jsonb column to the existing
-- `user_preferences` table. It stores a member's STICKY food
-- constraints: allergies, dietary restrictions (vegan / halal / kosher
-- / gluten-free, …), and cuisine NEVERS. Unlike quiz answers — which
-- are per-session and live on `votes` — profile vetoes persist across
-- every session: a member configures them once and every future
-- room's verdict honors them.
--
-- Why `user_preferences` (vs. a new table)
-- ────────────────────────────────────────
-- The `user_preferences` migration (20260513213000000) explicitly
-- declares the table the home for "per-user app-state … opt-in/opt-out
-- toggles" and says it is "deliberately wide-open for future columns."
-- Profile vetoes are exactly that — one row per `auth.users.id`,
-- sticky, RLS-scoped to the owner. A separate table would duplicate
-- the row-per-user shape, the updated_at trigger, and three RLS
-- policies for no benefit. So this is a one-column ALTER.
--
-- Storage shape
-- ─────────────
-- `profile_vetoes` is a jsonb ARRAY of `{ kind, token }` objects — the
-- `HardVeto` shape the verdict engine consumes through its generic
-- `hard_vetoes` channel (see `_shared/verdict-engine.ts` HardVeto and
-- the `profile_veto` question kind in `_shared/votes-schema.ts`):
--
--   [
--     { "kind": "dietary",       "token": "vegan" },
--     { "kind": "cuisine_never", "token": "sushi" },
--     { "kind": "tag",           "token": "no_peanut_unverified" }
--   ]
--
--   * kind = "dietary"       — token is a dietary chip id; the EBA
--                              prune drops a venue whose dietary_tags
--                              lack the chip's required tag.
--   * kind = "cuisine_never" — token is a lowercase cuisine substring;
--                              the prune drops a venue whose Foursquare
--                              categories contain it.
--   * kind = "tag"           — token is a raw required dietary tag
--                              (allergy escape hatch — for allergy
--                              tags the dietary chip map does not yet
--                              cover).
--
-- Generic jsonb rather than typed columns: the constraint vocabulary
-- (which allergies, which cuisines) will grow, and the verdict engine
-- already reads vetoes as `{ kind, token }`. A typed schema would need
-- a migration every time the vocabulary changes — the same coupling
-- the generic-jsonb votes schema (ADR 0010) was created to avoid.
--
-- Interim seeding path (no profile-edit UI in this slice)
-- ───────────────────────────────────────────────────────
-- TB-12 ships storage + verdict-engine consumption only. The
-- profile-edit UI surface is deferred to the pre-public-launch
-- milestone. Until that lands, profile vetoes are seeded directly on
-- the account row with an UPSERT (service-role or the SQL editor):
--
--   insert into public.user_preferences (user_id, profile_vetoes)
--   values (
--     '<auth.users.id>',
--     '[{"kind":"cuisine_never","token":"sushi"},
--       {"kind":"dietary","token":"vegan"}]'::jsonb
--   )
--   on conflict (user_id) do update
--     set profile_vetoes = excluded.profile_vetoes;
--
-- The existing `user_preferences` RLS also lets the owning user write
-- their own row, so a future profile-edit screen UPSERTs the same
-- column with the user's JWT — no schema change needed when the UI
-- lands.

alter table public.user_preferences
    add column if not exists profile_vetoes jsonb not null default '[]'::jsonb;

comment on column public.user_preferences.profile_vetoes is
    'TB-12 — sticky per-account food vetoes: allergies, dietary restrictions, cuisine NEVERS. A jsonb array of { kind, token } HardVeto objects (kind in dietary|cuisine_never|tag). Persists across every session; the compute-verdict Edge Function reads it and folds it into each member''s EBA hard-veto channel so no verdict ever surfaces a venue that violates a member''s profile. Defaults to []. Interim seeding is a direct UPSERT — the profile-edit UI is deferred to pre-public-launch.';

-- Reject a malformed write at the DB layer so a bad seed fails fast
-- rather than silently producing a verdict that ignored a member's
-- allergy. The column must always be a jsonb array (the empty array is
-- the no-veto default). Per-element shape validation lives in the Edge
-- Function's reader (`fetchProfileVetoes` drops entries with an unknown
-- kind / non-string token) — keeping the CHECK to "is an array" avoids
-- a brittle deep jsonb assertion in SQL.
alter table public.user_preferences
    drop constraint if exists user_preferences_profile_vetoes_is_array;
alter table public.user_preferences
    add constraint user_preferences_profile_vetoes_is_array
    check (jsonb_typeof(profile_vetoes) = 'array');
