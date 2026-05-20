-- tb-WF-8 (workflow-overhaul) — Plan list Decided + History lifecycle.
--
-- The S00 Plan list surface (sg-WF-4, design-system/surfaces/00-plan-list.md)
-- renders the user's Plans in three sections: Pending, Decided, History.
-- tb-WF-5 shipped Pending + the stubbed Decided/History slots; tb-WF-7
-- added the Joined-card resume. This migration lights up the Decided +
-- History sections end-to-end:
--
--   * Two new sort-key columns on `public.plans`:
--       - `verdict_fired_at timestamptz` — stamped on the
--         pending → decided-active flip. Sort key for the Decided
--         section per surface §"Ordering within sections" (Q7).
--       - `expired_at timestamptz` — stamped on the
--         decided-active → decided-expired flip. Sort key for the
--         History section.
--
--   * `set_plan_decided_active(uuid)` is amended to stamp
--     `verdict_fired_at = now()` alongside the existing
--     `reroll_window_closes_at` write. The function body remains
--     idempotent (`where status = 'pending'`).
--
--   * A new SECURITY DEFINER function `set_plan_decided_expired(uuid)`
--     transitions a plan to `decided-expired` and stamps
--     `expired_at = now()`. Idempotent — re-invoking on a non-active
--     plan is a no-op.
--
--   * Three event paths fire the decided-active → decided-expired
--     transition, whichever comes first:
--       1. **Reroll window closes.** A per-minute pg_cron worker
--          (`cron_expire_reroll_windows`) scans decided-active plans
--          whose `reroll_window_closes_at <= now()` and expires them.
--       2. **3rd reroll burn.** An AFTER INSERT trigger on
--          `public.rerolls` counts the rerolls for the linked plan's
--          room and expires the plan when count >= 3.
--       3. **Check-in completes.** An AFTER INSERT trigger on
--          `public.check_ins` expires the linked plan (any outcome —
--          went/skipped/snoozed/no_signal all count as "user
--          completed the cycle" for the visible-history purpose).
--
--   * Two new SECURITY DEFINER RPCs back the S00 Plan list's Decided
--     + History sections:
--       - `plans_decided_for_user(p_user_id uuid)` — returns Plans the
--         caller created OR joined (`members.role = 'owner'` vs
--         non-owner) in status='decided-active'. Inlines the verdict's
--         place name (`options.payload->>'name'`) so the 2-line cards
--         render without an N+1 lookup. Ordered by
--         `verdict_fired_at DESC`.
--       - `plans_history_for_user(p_user_id uuid)` — same shape for
--         status='decided-expired', ordered by `expired_at DESC`.
--
-- References:
--   * gti-vault/15_issues/workflow-overhaul/issues/tb-wf-8-plan-list-decided-history.md
--   * design-system/surfaces/00-plan-list.md (locked spec)
--   * supabase/migrations/20260519000000000_workflow_overhaul_plans_table.sql
--     (the tb-WF-1 baseline this migration extends)

-- ── 1. plans.verdict_fired_at + plans.expired_at columns ────────────

alter table public.plans
    add column if not exists verdict_fired_at timestamptz;

alter table public.plans
    add column if not exists expired_at timestamptz;

comment on column public.plans.verdict_fired_at is
    'tb-WF-8 — when the Plan transitioned pending → decided-active. '
    'Stamped by set_plan_decided_active. Sort key for the Decided '
    'section of the S00 Plan list (verdict_fired_at DESC, tiebreaker '
    'created_at DESC). NULL while pending.';

comment on column public.plans.expired_at is
    'tb-WF-8 — when the Plan transitioned decided-active → '
    'decided-expired. Stamped by set_plan_decided_expired. Sort key '
    'for the History section (expired_at DESC, tiebreaker '
    'created_at DESC). NULL until the Plan reaches History.';

-- Indices supporting the Decided + History list queries. Partial
-- indices keyed on the destination status keep the storage cheap
-- (the bulk of a user's plans are Pending, not Decided/History).
create index if not exists plans_creator_decided_idx
    on public.plans (creator_id, verdict_fired_at desc)
    where status = 'decided-active';

create index if not exists plans_creator_history_idx
    on public.plans (creator_id, expired_at desc)
    where status = 'decided-expired';

-- ── 2. set_plan_decided_active — stamp verdict_fired_at ─────────────
-- Amends the tb-WF-1 function. The body keeps the existing idempotent
-- gate (`where status = 'pending'`) and now also stamps
-- `verdict_fired_at`. Re-invocation on a non-pending plan is still a
-- no-op (the UPDATE matches no rows).

create or replace function public.set_plan_decided_active(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.plans
        set status = 'decided-active',
            verdict_fired_at = now(),
            reroll_window_closes_at = now() + interval '2 days',
            updated_at = now()
        where id = p_plan_id
          and status = 'pending';
end;
$$;

comment on function public.set_plan_decided_active(uuid) is
    'tb-WF-1 (amended in tb-WF-8) — pending → decided-active '
    'transition. Stamps verdict_fired_at = now() alongside the '
    'reroll_window_closes_at write. SECURITY DEFINER. Idempotent — '
    're-invoke on a non-pending plan is a no-op. The exact '
    'reroll_window_closes_at computation is sg-WF-6; this function '
    'stamps a best-effort two-day window so the column is '
    'observable.';

-- The grant from tb-WF-1 carries over; we re-issue it defensively in
-- case the function signature changes in a future amendment (the
-- grant is keyed on the function signature, not the name).
revoke all on function public.set_plan_decided_active(uuid) from public;
grant execute on function public.set_plan_decided_active(uuid) to authenticated;

-- ── 3. set_plan_decided_expired function ────────────────────────────
-- The decided-active → decided-expired transition. Invoked by the
-- pg_cron worker (reroll-window-close path), the rerolls trigger
-- (3rd burn), and the check_ins trigger (check-in complete).
--
-- SECURITY DEFINER so the trigger and cron paths (both running with
-- elevated server-side context) can call it regardless of the
-- caller's user_id. The function gates on `status='decided-active'`
-- so re-invoking on an already-expired plan is a no-op — that guards
-- against the race where two event paths land within the same second.

create or replace function public.set_plan_decided_expired(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.plans
        set status = 'decided-expired',
            expired_at = now(),
            updated_at = now()
        where id = p_plan_id
          and status = 'decided-active';
end;
$$;

comment on function public.set_plan_decided_expired(uuid) is
    'tb-WF-8 — decided-active → decided-expired transition. Invoked '
    'by the pg_cron worker (reroll window close), the rerolls AFTER '
    'INSERT trigger (3rd burn), and the check_ins AFTER INSERT '
    'trigger (check-in complete). SECURITY DEFINER. Idempotent — '
    're-invoke on a non-decided-active plan is a no-op.';

revoke all on function public.set_plan_decided_expired(uuid) from public;
grant execute on function public.set_plan_decided_expired(uuid) to authenticated;

-- ── 4. pg_cron worker — expire plans whose reroll window has closed ──
-- Per-minute scan of decided-active plans whose
-- `reroll_window_closes_at` has passed. Calls
-- `set_plan_decided_expired` for each. The function is idempotent so
-- a late-firing cron run after a trigger already expired the plan is
-- a no-op.

create or replace function public.cron_expire_reroll_windows()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    r record;
begin
    for r in
        select id
        from public.plans
        where status = 'decided-active'
          and reroll_window_closes_at is not null
          and reroll_window_closes_at <= now()
    loop
        perform public.set_plan_decided_expired(r.id);
    end loop;
end;
$$;

comment on function public.cron_expire_reroll_windows() is
    'tb-WF-8 pg_cron worker. Runs every minute. Scans plans whose '
    'status=decided-active AND reroll_window_closes_at <= now(); '
    'calls set_plan_decided_expired on each. Idempotent.';

-- Re-schedule the cron job. Drop the prior schedule if present so
-- the migration is replayable on a partially-applied DB.
do $$
begin
    if exists (
        select 1 from cron.job where jobname = 'gettoit_expire_reroll_windows'
    ) then
        perform cron.unschedule('gettoit_expire_reroll_windows');
    end if;
end $$;

select cron.schedule(
    'gettoit_expire_reroll_windows',
    '* * * * *',
    $$select public.cron_expire_reroll_windows();$$
);

-- ── 5. rerolls AFTER INSERT trigger — expire on 3rd burn ────────────
-- The rerolls table has a 3-cap (TB-10 trigger + RPC). When the 3rd
-- burn lands, the plan's reroll budget is exhausted — flip the plan
-- to decided-expired. We do this in an AFTER INSERT trigger so a
-- successful insert (which already passed the 3-cap check) drives
-- the transition. The new.room_id is the linked room; its plan_id
-- (if non-null) is the plan to expire.

create or replace function public.tg_rerolls_maybe_expire_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_count   int;
    v_plan_id uuid;
begin
    -- Count the rerolls on the linked room AFTER the just-inserted row.
    select count(*)::int into v_count
    from public.rerolls
    where room_id = new.room_id;

    if v_count >= 3 then
        select plan_id into v_plan_id
        from public.rooms
        where id = new.room_id;

        if v_plan_id is not null then
            perform public.set_plan_decided_expired(v_plan_id);
        end if;
    end if;

    return new;
end;
$$;

comment on function public.tg_rerolls_maybe_expire_plan() is
    'tb-WF-8 AFTER INSERT trigger on rerolls. When the room''s reroll '
    'count reaches 3, fires set_plan_decided_expired on the linked '
    'plan (if any). Reroll budget exhausted → Plan moves to History.';

drop trigger if exists tg_rerolls_maybe_expire_plan on public.rerolls;
create trigger tg_rerolls_maybe_expire_plan
    after insert on public.rerolls
    for each row
    execute function public.tg_rerolls_maybe_expire_plan();

-- ── 6. check_ins AFTER INSERT trigger — expire on check-in ──────────
-- A check-in row (any outcome — went/skipped/snoozed/no_signal) means
-- the user closed the cycle on this Plan; move it to History.

create or replace function public.tg_check_ins_maybe_expire_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_plan_id uuid;
begin
    select plan_id into v_plan_id
    from public.rooms
    where id = new.room_id;

    if v_plan_id is not null then
        perform public.set_plan_decided_expired(v_plan_id);
    end if;

    return new;
end;
$$;

comment on function public.tg_check_ins_maybe_expire_plan() is
    'tb-WF-8 AFTER INSERT trigger on check_ins. Any outcome '
    '(went/skipped/snoozed/no_signal) flips the linked plan to '
    'decided-expired. User completed the cycle → Plan moves to '
    'History.';

drop trigger if exists tg_check_ins_maybe_expire_plan on public.check_ins;
create trigger tg_check_ins_maybe_expire_plan
    after insert on public.check_ins
    for each row
    execute function public.tg_check_ins_maybe_expire_plan();

-- ── 7. plans_decided_for_user RPC ───────────────────────────────────
-- Returns the caller's Decided plans — both Created (the caller is
-- the plan's creator AND the room's owner-member) and Joined (the
-- caller is a non-owner member of the room). Joins inline against
-- the verdict + options so the 2-line card can render
-- `name + verdict place name` without an N+1 lookup.
--
-- Ordering: verdict_fired_at DESC, tiebreaker created_at DESC. Matches
-- surface §"Ordering within sections" (Q7).
--
-- Pinned to auth.uid() — `p_user_id` is accepted for explicit
-- auditability but a caller that passes someone else's UUID receives
-- zero rows.

create or replace function public.plans_decided_for_user(p_user_id uuid)
returns table (
    id                       uuid,
    creator_id               uuid,
    name                     text,
    category                 text,
    scope                    text,
    location                 jsonb,
    session_params           jsonb,
    distance_meters          int,
    status                   text,
    reroll_window_closes_at  timestamptz,
    verdict_fired_at         timestamptz,
    expired_at               timestamptz,
    created_at               timestamptz,
    updated_at               timestamptz,
    role                     text,
    verdict_place_name       text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        p.id,
        p.creator_id,
        p.name,
        p.category,
        p.scope,
        p.location,
        p.session_params,
        p.distance_meters,
        p.status,
        p.reroll_window_closes_at,
        p.verdict_fired_at,
        p.expired_at,
        p.created_at,
        p.updated_at,
        case when m.role = 'owner' then 'owner' else 'joined' end as role,
        (o.payload ->> 'name') as verdict_place_name
    from public.plans p
    join public.rooms r on r.plan_id = p.id
    join public.members m on m.room_id = r.id
    left join public.verdicts v on v.room_id = r.id
    left join public.options o on o.id = v.option_id
    where p.status = 'decided-active'
      and m.user_id = (select auth.uid())
      and m.user_id = p_user_id
    order by p.verdict_fired_at desc nulls last, p.created_at desc;
$$;

comment on function public.plans_decided_for_user(uuid) is
    'tb-WF-8 — backs the S00 Plan list Decided section. Returns the '
    'caller''s Plans in status=decided-active, both Created '
    '(role=owner) and Joined (role=joined), with the verdict''s '
    'place name inlined from options.payload->>''name''. Ordered '
    'verdict_fired_at DESC. Pinned to auth.uid().';

revoke all on function public.plans_decided_for_user(uuid) from public;
grant execute on function public.plans_decided_for_user(uuid) to authenticated;

-- ── 8. plans_history_for_user RPC ───────────────────────────────────
-- Same shape for the History section, gating on
-- status='decided-expired' and ordering by `expired_at DESC`.

create or replace function public.plans_history_for_user(p_user_id uuid)
returns table (
    id                       uuid,
    creator_id               uuid,
    name                     text,
    category                 text,
    scope                    text,
    location                 jsonb,
    session_params           jsonb,
    distance_meters          int,
    status                   text,
    reroll_window_closes_at  timestamptz,
    verdict_fired_at         timestamptz,
    expired_at               timestamptz,
    created_at               timestamptz,
    updated_at               timestamptz,
    role                     text,
    verdict_place_name       text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        p.id,
        p.creator_id,
        p.name,
        p.category,
        p.scope,
        p.location,
        p.session_params,
        p.distance_meters,
        p.status,
        p.reroll_window_closes_at,
        p.verdict_fired_at,
        p.expired_at,
        p.created_at,
        p.updated_at,
        case when m.role = 'owner' then 'owner' else 'joined' end as role,
        (o.payload ->> 'name') as verdict_place_name
    from public.plans p
    join public.rooms r on r.plan_id = p.id
    join public.members m on m.room_id = r.id
    left join public.verdicts v on v.room_id = r.id
    left join public.options o on o.id = v.option_id
    where p.status = 'decided-expired'
      and m.user_id = (select auth.uid())
      and m.user_id = p_user_id
    order by p.expired_at desc nulls last, p.created_at desc;
$$;

comment on function public.plans_history_for_user(uuid) is
    'tb-WF-8 — backs the S00 Plan list History section. Returns the '
    'caller''s Plans in status=decided-expired, both Created '
    '(role=owner) and Joined (role=joined), with the verdict''s '
    'place name inlined. Ordered expired_at DESC. Pinned to '
    'auth.uid().';

revoke all on function public.plans_history_for_user(uuid) from public;
grant execute on function public.plans_history_for_user(uuid) to authenticated;
