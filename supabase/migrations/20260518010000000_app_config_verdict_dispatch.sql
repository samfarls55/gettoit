-- bug-09 (quiz redesign) — make the verdict-fire dispatch reachable.
--
-- Root cause
-- ──────────
-- `dispatch_compute_verdict` built its HTTP POST target from two
-- Postgres database GUCs — `app.supabase_url` and `app.service_role_key`
-- — and silently `return`ed when either was empty. On the live project
-- both GUCs were unset and nothing in the repo ever set them: setting a
-- placeholder GUC via `ALTER DATABASE ... SET` requires a Postgres
-- superuser, which the Supabase `postgres` role (used by `supabase db
-- push` and the Management API) is NOT. The dispatch therefore no-op'd,
-- the `compute-verdict` engine was never auto-invoked, and every room
-- whose Q5-complete trigger fired wedged in `status='firing'` forever.
--
-- Re-scoped fix (triaged 2026-05-18, Option 2)
-- ────────────────────────────────────────────
-- Abandon the GUCs entirely. The dispatch now reads its URL and key
-- from an ordinary `app_config(key, value)` table. Writing a table row
-- needs no special privilege, so the whole fix is a normal migration +
-- CI step — version-controlled, agent-executable, and self-healing
-- across a project re-provision.
--
--   * `supabase_url`      — not secret. Seeded by THIS migration, so it
--                           replays onto any fresh database.
--   * `service_role_key`  — secret. Never committed. Re-applied on every
--                           deploy by a step in the CI `supabase-db`
--                           job from the `SUPABASE_SERVICE_ROLE_KEY`
--                           GitHub Actions secret.
--
-- See gti-vault/15_issues/0.1.0/issues/bug-09-verdict-fire-dispatch-guc-noop.md
-- and gti-vault/60_engineering/verdict-dispatch-guc-superuser-blocker.md.

-- ── 1. app_config table ─────────────────────────────────────────────
-- A plain key/value table. RLS is enabled with NO policies, and all
-- access is revoked from anon / authenticated — so the row holding the
-- service-role key is unreachable over PostgREST. `dispatch_compute_
-- verdict` is SECURITY DEFINER (below), so it bypasses this RLS when the
-- votes trigger fires under an end-user's role.

create table if not exists public.app_config (
    key   text primary key,
    value text not null
);

comment on table public.app_config is
    'bug-09 — runtime key/value config for server-side functions. Holds the supabase_url + service_role_key the verdict dispatcher POSTs with. RLS-locked: no policies, no anon/authenticated grant; reached only by SECURITY DEFINER functions.';

alter table public.app_config enable row level security;

-- No policies are created — with RLS on and no policy, every non-owner
-- role is denied. Belt-and-braces: also revoke the table-level grants
-- PostgREST's `anon` / `authenticated` roles get by default.
revoke all on table public.app_config from anon, authenticated;

-- ── 2. Seed the non-secret supabase_url row ─────────────────────────
-- Idempotent — ON CONFLICT means a replay (fresh database, project
-- re-provision) re-asserts the value with zero human action. The URL is
-- public; no secret appears in this committed file.
insert into public.app_config (key, value)
values ('supabase_url', 'https://rlnevdqebmzbxpntghzb.supabase.co')
on conflict (key) do update set value = excluded.value;

-- The `service_role_key` row is deliberately NOT seeded here — it is a
-- secret and is applied only by the CI `supabase-db` deploy step from
-- the `SUPABASE_SERVICE_ROLE_KEY` Actions secret.

-- ── 3. Rewrite dispatch_compute_verdict — read app_config, not GUCs ─
-- Both overloads are rewritten:
--   * (uuid)        — the 1-arg form, still referenced by the orphaned
--                     `cron_auto_fire_or_expire`; delegates to the
--                     2-arg form with `manual`.
--   * (uuid, text)  — the active redesign fire path (TB-13), invoked by the
--                     Q5-complete `votes` trigger and the close-voting
--                     `fire_verdict` RPC.
--
-- Both stay SECURITY DEFINER. This is LOAD-BEARING, not optional: the
-- `votes` trigger runs under the voting end-user's role; with RLS on
-- `app_config` and no policy, a SECURITY INVOKER function would read
-- zero rows and silently no-op again — the exact bug-09 failure mode.
-- SECURITY DEFINER runs as the function owner (the migration role, which
-- owns `app_config`), bypassing the table's RLS.
--
-- The silent-return-when-empty guard is preserved: a database with no
-- `app_config` rows (local dev / CI) still no-ops cleanly and never
-- fails the votes INSERT. The `pg_net` POST and payload are unchanged.

-- 2-arg overload — the active redesign fire path.
create or replace function public.dispatch_compute_verdict(
    p_room_id uuid,
    p_method  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_url      text;
    v_key      text;
    v_endpoint text;
    v_body     jsonb;
begin
    -- bug-09: URL + key come from app_config, not the app.* GUCs.
    select value into v_url
    from public.app_config
    where key = 'supabase_url';

    select value into v_key
    from public.app_config
    where key = 'service_role_key';

    -- Bail silently when either value is missing — local dev / CI
    -- databases have no app_config rows and we don't want the trigger
    -- to fail the votes INSERT in that case.
    if v_url is null or v_url = '' or v_key is null or v_key = '' then
        return;
    end if;

    v_endpoint := v_url || '/functions/v1/compute-verdict';

    -- Only forward `method` when it is one the handler recognises
    -- (`quorum` / `deadline`); anything else lets the handler fall
    -- back to its `manual` default.
    v_body := jsonb_build_object('room_id', p_room_id);
    if p_method in ('quorum', 'deadline') then
        v_body := v_body || jsonb_build_object('method', p_method);
    end if;

    perform net.http_post(
        url      := v_endpoint,
        headers  := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_key
                    ),
        body     := v_body
    );
end;
$$;

comment on function public.dispatch_compute_verdict(uuid, text) is
    'bug-09 (re-scoped TB-13) — fire-and-forget HTTP POST to the compute-verdict Edge Function, carrying a method field so the durable verdict reflects how it fired (quorum = all-complete auto-fire, manual = close-voting). Reads supabase_url + service_role_key from the app_config table (NOT the app.* GUCs). SECURITY DEFINER so it bypasses app_config RLS when the votes trigger fires under an end-user role. Silent no-op when either app_config row is missing.';

revoke all on function public.dispatch_compute_verdict(uuid, text) from public;

-- 1-arg overload — delegates to the 2-arg form with `manual`. Kept in
-- place because the orphaned `cron_auto_fire_or_expire` still calls it.
-- Rewritten too so it does not silently no-op via the old GUC reads.
create or replace function public.dispatch_compute_verdict(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.dispatch_compute_verdict(p_room_id, 'manual');
end;
$$;

comment on function public.dispatch_compute_verdict(uuid) is
    'bug-09 — 1-arg compatibility overload. Delegates to dispatch_compute_verdict(uuid, text) with method=manual. SECURITY DEFINER. Retained for the orphaned cron_auto_fire_or_expire reference; the live redesign fire path uses the 2-arg form.';

revoke all on function public.dispatch_compute_verdict(uuid) from public;
