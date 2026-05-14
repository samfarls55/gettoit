-- TB-08 — extend user_preferences with the push-denial flag.
--
-- The native iOS push permission prompt fires after the first "I'm in"
-- tap (per session). If the user denies, the system won't show another
-- prompt — they must visit Settings. So the next app launch surfaces
-- an in-app banner fallback (PRD user story 40, S05 §"Pre-permission
-- line").
--
-- This column persists the denial timestamp so the banner-suppression
-- logic can read it without spawning a new table. Same pattern as
-- TB-12's `auth_prompt_dismissed_at`: a wall-clock stamp, readable by
-- the iOS client on launch, that the banner-fallback work in TB-14 can
-- consume.
--
-- Null = never denied (or denied in a prior identity that's since
-- expired). Non-null = denied on or after that stamp; surface the
-- banner.

alter table public.user_preferences
    add column if not exists push_denied_at timestamptz;

comment on column public.user_preferences.push_denied_at is
    'TB-08 — wall-clock time at which the user tapped Don''t Allow on the native iOS push permission prompt. Drives the in-app banner fallback on next launch per PRD user story 40. Null = never denied.';
