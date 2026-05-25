-- tb-WF-11 (workflow-overhaul) — members.display_name column.
--
-- The web invitee shell (sg-WF-5 surface doc, surface §A "First-landing
-- name entry") introduces the system's FIRST real display-name source.
-- A cold invitee who clicks the shared `/join/<roomId>` link enters a
-- name on a name-entry-alone surface; that name is written here, onto
-- their `members` row.
--
-- Verified during the 0.1.0-workflow-overhaul-web-invitee-flow grill (§Q4):
-- there was no `members.display_name` column across the prior 27
-- migrations. `compute-verdict` synthesizes a placeholder name,
-- `"m" + userId.slice(0, 4)`, for every member. This migration is the
-- additive schema change that lets a Web invitee carry a real name;
-- `compute-verdict.fetchVotes` joins the column and falls back to the
-- `m<uuid>` placeholder when it is NULL.
--
-- Scope (strict):
--   * A single nullable `text` column on `public.members`.
--
-- Why nullable, no default:
--   * iOS members have no name-entry surface — they keep the
--     `m<uuid>` placeholder (decision doc §Q4, "Open follow-ups").
--     A NULL is the explicit "no name entered" signal the verdict
--     fallback keys on; a non-NULL empty-string default would defeat
--     that distinction.
--   * Additive + nullable means every existing `members` row stays
--     valid with no backfill — the column simply reads NULL until a
--     Web invitee writes through the name-entry surface.
--
-- Writes:
--   * The Web invitee shell inserts the `members` row WITH
--     `display_name` set, in the same INSERT the existing
--     `members_insert_self` RLS policy already admits (the policy
--     gates on `user_id = auth.uid()` and does not constrain which
--     columns are written). No new policy is needed.
--   * The column is intentionally NOT writable through
--     `members_progress_upsert` — that RPC is pinned to the
--     `quiz_progress` column only. A name is set once, at insert
--     time, and is not editable afterward (decision doc §Q4).
--
-- Down-migration: drop the column. Reversible — the only data lost is
-- the Web invitee display names, which a returning invitee re-enters
-- on the name-entry surface.

alter table public.members
    add column if not exists display_name text;

comment on column public.members.display_name is
    'tb-WF-11 — the display name a Web invitee enters on the '
    'name-entry surface (sg-WF-5 surface §A). NULL for iOS members, '
    'which have no name-entry surface; `compute-verdict.fetchVotes` '
    'falls back to the `m<uuid>` placeholder for NULL rows. Set once '
    'at member-row insert time and not editable afterward '
    '(decision doc §Q4). 30-char cap is enforced client-side by the '
    'name-entry surface.';
