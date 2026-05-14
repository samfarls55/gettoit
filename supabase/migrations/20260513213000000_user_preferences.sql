-- TB-12 — user_preferences table for per-user app-state we don't keep
-- in `auth.users` (Supabase manages that schema; we shouldn't add
-- columns to it directly).
--
-- Scope of this migration (strict):
--   * One row per `auth.users.id`. Created lazily — the row appears the
--     first time the user dismisses (or upgrades from) the auth chip.
--   * `auth_prompt_dismissed_at` — drives the 30-day re-prompt
--     suppression on the S04 Waiting auth-upgrade chip (TB-12).
--   * RLS — each user can SELECT and UPSERT their own row only.
--
-- Why a separate `user_preferences` table (vs. `users_profile`,
-- `user_settings`, etc.):
--   * `auth.users` is Supabase-managed — column additions there carry
--     migration risk on every Supabase version bump.
--   * `user_preferences` reads as the right home for client-side
--     dismissed-this-prompt flags, opt-in/opt-out toggles, last-seen-
--     onboarding stamps. It is deliberately wide-open for future
--     columns; we don't pre-allocate them.
--   * Other tracer bullets (TB-14 check-in opt-out, TB-16 push
--     opt-out) will likely add columns here rather than spawn new
--     tables.
--
-- Auto-cleanup: ON DELETE CASCADE on `auth.users` removes the row when
-- the user uses the in-app delete (TB-16) or when the anonymous-TTL
-- cron sweeps an inactive identity (ADR 0006).

create table if not exists public.user_preferences (
    user_id uuid primary key references auth.users (id) on delete cascade,
    -- Wall-clock time at which the user tapped "Maybe later" on the
    -- S04 auth-upgrade chip. Null = never dismissed (or dismissal is
    -- older than 30 days and was wiped — we don't wipe; the client
    -- checks the age against now() instead).
    auth_prompt_dismissed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
    'Per-user app-state. One row per auth.users.id. Created lazily on first write — TB-12 writes auth_prompt_dismissed_at when the user taps Maybe later on the S04 auth-upgrade chip.';

comment on column public.user_preferences.auth_prompt_dismissed_at is
    'When the user dismissed the Sign-in-with-Apple upgrade chip on S04 Waiting. The chip is suppressed for 30 days from this stamp. Null = never dismissed. Linked-Apple users do not render the chip regardless.';

-- ── updated_at trigger ──────────────────────────────────────────────
-- Keep updated_at fresh on every UPSERT so we have an audit trail of
-- the last time the row was touched (handy when debugging suppression
-- not behaving as expected). The function is idempotent / safe to
-- redeclare.
create or replace function public.tg_user_preferences_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
    before update on public.user_preferences
    for each row execute function public.tg_user_preferences_set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.user_preferences enable row level security;

-- Each user reads only their own row.
drop policy if exists "user_preferences_select_self" on public.user_preferences;
create policy "user_preferences_select_self" on public.user_preferences
    for select
    to authenticated
    using (user_id = (select auth.uid()));

-- Each user inserts only their own row. UPSERT (insert with
-- on-conflict) is the canonical write path from the iOS client.
drop policy if exists "user_preferences_insert_self" on public.user_preferences;
create policy "user_preferences_insert_self" on public.user_preferences
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));

-- Each user updates only their own row.
drop policy if exists "user_preferences_update_self" on public.user_preferences;
create policy "user_preferences_update_self" on public.user_preferences
    for update
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
