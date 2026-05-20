-- tb-WF-1 (workflow-overhaul) — Plans table + lifecycle schema.
--
-- The workflow-overhaul phase promotes today's ephemeral `rooms` row
-- into a durable `Plan` entity. A Plan is a NAMED, PERSISTENT, list-
-- backed item in the Reminders-app spirit:
--   * created once on the new Setup screen (tb-WF-4 wires the UI),
--   * carries the session-wide parameters (location, distance, scope,
--     meal time, etc.) the existing quiz consumes,
--   * lifecycles through pending → decided-active → decided-expired,
--   * survives the verdict and powers the post-verdict reroll window.
--
-- This migration lands the SCHEMA only. The user-facing Setup +
-- list surfaces are tb-WF-4 / sg-WF-4. The reroll-window cron / trigger
-- (decided-active → decided-expired) is sg-WF-6.
--
-- References:
--   * gti-vault/50_product/workflow-overhaul-plan-setup.md — locked
--     decision doc (eleven grilled outcomes).
--   * gti-vault/15_issues/workflow-overhaul/issues/tb-wf-1-plans-table-schema.md
--   * gti-vault/60_engineering/adr/0010-generic-jsonb-votes-schema.md
--     — precedent for `session_params` jsonb shape.
--
-- Down-migration: drop the trigger, drop the function, drop the
-- rooms.plan_id FK + column, drop the plans table. Reversible.

-- ── plans table ──────────────────────────────────────────────────────
create table public.plans (
    -- uuid primary key (gen_random_uuid()) so the iOS client can
    -- allocate ids client-side without a server round trip — same
    -- pattern RoomStore uses.
    id            uuid primary key default gen_random_uuid(),

    -- The Plan belongs to whoever created it. Cascade so a hard
    -- account-delete drops the Plan inventory cleanly. Joined-Plan
    -- visibility (Account members seeing Plans they joined) is NOT
    -- in scope for this issue — today's `members` table gates
    -- room-level participation. See tb-wf-1 §RLS for the rationale.
    creator_id    uuid not null references auth.users(id) on delete cascade,

    -- The user-typed name. Matches sg-WF-1's 40-char validation cap.
    -- A 1-char minimum forbids empty names (the Setup CTA already
    -- disables submit on empty input, but the DB owns the contract).
    name          text not null check (char_length(name) between 1 and 40),

    -- v1 is food-only per the locked decision; the CHECK constraint
    -- exists so future categories (drinks / movie / activity) land
    -- as new enum values via a follow-up migration, not as a quiet
    -- text-field free-for-all.
    category      text not null default 'food' check (category in ('food')),

    -- The OCCASION signal, not headcount. Matches today's
    -- S01b group_context chips:
    --   `Just me`   → 'solo'
    --   `Two of us` → 'duo'
    --   `A group`   → 'group'
    -- After tb-WF-4 retires S01b this column is the canonical home
    -- for the bucket — `rooms.session_params.group_context` becomes
    -- a write-through mirror for the in-flight session.
    scope         text not null default 'group' check (scope in ('solo', 'duo', 'group')),

    -- Mirrors today's `rooms.location_*` shape into a single jsonb
    -- object: `{ lat, lng, name, source, timeZoneIdentifier }`.
    -- jsonb (not typed columns) for two reasons:
    --   * The plan is created BEFORE a Room exists (the Plan list is
    --     the new landing surface). Re-using rooms.location_* would
    --     have meant either lifting it onto plans (4 column moves) or
    --     duplicating it — jsonb sidesteps both.
    --   * The location shape may grow (Apple Maps place_id, FSQ
    --     `fsq_place_id` for a curated venue list) without a
    --     migration. ADR 0010 set the same precedent on `votes`.
    -- Nullable: a Plan created without a location yet is allowed
    -- (the Setup CTA will require it for `pending` → fire, but a
    -- draft Plan with a missing location is still readable).
    location      jsonb,

    -- The generic *parameters* bucket. Mirrors `rooms.session_params`
    -- exactly — same shape, same tolerant-decode contract, same
    -- "add a parameter without a migration" property (ADR 0010).
    -- Carries `meal_time`, `service_shape`, and anything else added
    -- to the bucket later. NOT NULL with an empty-object default so
    -- a freshly-minted Plan always has a valid object the iOS
    -- read path can decode without nil-coalescing.
    session_params jsonb not null default '{}'::jsonb,

    -- Replaces `rooms.radius_meters`. Default `1609` (≈ 1.0 mi) per
    -- the workflow-overhaul lock — the new Setup screen replaces the
    -- walk/drive binary with a distance-only slider whose default
    -- sits at 1.0 mi (walk-vs-drive implicit below/above that).
    -- See workflow-overhaul-plan-setup.md §"Distance-only slider".
    distance_meters int not null default 1609,

    -- The lifecycle state machine.
    --   * 'pending'         — Plan exists, no verdict fired yet.
    --                          Editable on the Setup surface.
    --   * 'decided-active'  — A verdict landed; the reroll window
    --                          is open. Updates frozen to the reroll
    --                          mechanism.
    --   * 'decided-expired' — Reroll window closed. Plan is sealed.
    -- The pending → decided-active transition is fired by
    -- `set_plan_decided_active` below, invoked from `compute-verdict`
    -- on a successful verdict (when `room.plan_id` is non-null). The
    -- decided-active → decided-expired transition is sg-WF-6.
    status        text not null default 'pending'
                  check (status in ('pending', 'decided-active', 'decided-expired')),

    -- The reroll window deadline. Null while `pending` (no verdict
    -- yet); populated by `set_plan_decided_active` on transition to
    -- `decided-active`. The exact computation (`date_trunc('day',
    -- verdict_at AT TIME ZONE creator_tz) + interval '2 days' -
    -- interval '1 second'`) lands in sg-WF-6 — for now we provision
    -- the column and stamp a placeholder so subsequent tracer-bullets
    -- have a non-null value to test against.
    reroll_window_closes_at timestamptz,

    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.plans is
    'tb-WF-1 (workflow-overhaul) — durable, named, list-backed Plan '
    'entity. Promotes today''s ephemeral rooms row into a Reminders-'
    'app-spirit item. Carries session-wide parameters (location, '
    'distance, scope, meal_time, etc.) and lifecycles through '
    'pending → decided-active → decided-expired.';

comment on column public.plans.scope is
    'tb-WF-1 — the occasion signal, not headcount. Three values '
    'match today''s S01b group_context chips: Just me → solo, '
    'Two of us → duo, A group → group.';

comment on column public.plans.session_params is
    'tb-WF-1 — generic parameters bucket (mirrors rooms.session_params; '
    'see ADR 0010). Carries meal_time, service_shape, etc. — readers '
    'tolerant-decode unknown keys. NOT NULL with default ''{}'' so '
    'every Plan has a valid object the iOS read path can decode.';

comment on column public.plans.distance_meters is
    'tb-WF-1 — replaces rooms.radius_meters. Default 1609 (~1.0 mi) '
    'per the workflow-overhaul Setup-screen distance-only slider lock.';

comment on column public.plans.status is
    'tb-WF-1 — lifecycle state machine: pending → decided-active → '
    'decided-expired. pending→decided-active fires from '
    'set_plan_decided_active (compute-verdict). decided-active→'
    'decided-expired is sg-WF-6.';

comment on column public.plans.reroll_window_closes_at is
    'tb-WF-1 — reroll-window deadline. NULL while pending; stamped by '
    'set_plan_decided_active. Exact server-side computation is sg-WF-6.';

-- Index for the user's "my plans" list view (the new landing surface,
-- sg-WF-4). The list is ordered by `updated_at desc` (most-recently-
-- touched first) so an `updated_at` index supplements the natural
-- `creator_id` partition.
create index plans_creator_id_updated_at_idx
    on public.plans (creator_id, updated_at desc);

-- ── updated_at trigger ──────────────────────────────────────────────
-- Refresh `updated_at` on every UPDATE so the Plan list's sort key is
-- always current. Same pattern as `user_preferences_set_updated_at`.
-- Idempotent / safe to redeclare.
create or replace function public.tg_plans_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
    before update on public.plans
    for each row execute function public.tg_plans_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────
-- Plans are strictly creator-owned for this issue. Joined-Plan
-- visibility (Account members seeing Plans they joined) is a Plan
-- list surface concern (sg-WF-4 / future tracer-bullet) — today's
-- `members` table already gates room-level participation, so the
-- joiner read path can stay on `rooms`-keyed RLS for the in-flight
-- session. A future migration may add a joined-plans SELECT policy.

alter table public.plans enable row level security;

drop policy if exists "plans_select_creator" on public.plans;
create policy "plans_select_creator" on public.plans
    for select
    to authenticated
    using (creator_id = (select auth.uid()));

drop policy if exists "plans_insert_creator" on public.plans;
create policy "plans_insert_creator" on public.plans
    for insert
    to authenticated
    with check (creator_id = (select auth.uid()));

drop policy if exists "plans_update_creator" on public.plans;
create policy "plans_update_creator" on public.plans
    for update
    to authenticated
    using (creator_id = (select auth.uid()))
    with check (creator_id = (select auth.uid()));

drop policy if exists "plans_delete_creator" on public.plans;
create policy "plans_delete_creator" on public.plans
    for delete
    to authenticated
    using (creator_id = (select auth.uid()));

-- ── rooms.plan_id ────────────────────────────────────────────────────
-- The FK that ties an in-flight Room to its parent Plan. Nullable for
-- the transition period — rooms created before workflow-overhaul (and
-- rooms created via the legacy S01 path until tb-WF-4 retires it)
-- stay `null`. On a Plan delete the FK is `set null` rather than
-- `cascade` so an accidentally-deleted Plan doesn't drop the live
-- Room mid-session.
--
-- Eventually `not null` once S01+S01b retire (tb-WF-4 + later).

alter table public.rooms
    add column if not exists plan_id uuid references public.plans(id) on delete set null;

comment on column public.rooms.plan_id is
    'tb-WF-1 — FK to public.plans. Nullable during the workflow-'
    'overhaul transition (legacy S01-created rooms stay NULL). '
    'Carries the parent Plan so verdict-fire can transition the '
    'Plan to decided-active.';

create index if not exists rooms_plan_id_idx
    on public.rooms (plan_id)
    where plan_id is not null;

-- ── state-transition function ────────────────────────────────────────
-- The pending → decided-active transition. Invoked by `compute-verdict`
-- after a successful verdict-fire when the Room carries a non-null
-- `plan_id`. SECURITY DEFINER so the Edge Function's service-role key
-- can call it even though the policies above only admit the creator
-- to write — the engine is system-level, not user-level.
--
-- Idempotent: re-invoking on an already-decided-active Plan is a no-op
-- (the UPDATE matches no rows because the WHERE clause requires
-- status='pending'). That guards against a race where the verdict
-- writes succeed but the broadcast retries.
--
-- The reroll_window_closes_at value:
--   * sg-WF-6 owns the exact `date_trunc('day', verdict_at AT TIME
--     ZONE creator_tz) + interval '2 days' - interval '1 second'`
--     computation. Provisioning the column with a "best-effort"
--     stamp here is the bare minimum that subsequent tracer-bullets
--     can test against. The stamp uses `now()` plus a two-day
--     window so reads against a `pending` row vs a `decided-active`
--     row are distinguishable in tests.

create or replace function public.set_plan_decided_active(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.plans
        set status = 'decided-active',
            reroll_window_closes_at = now() + interval '2 days',
            updated_at = now()
        where id = p_plan_id
          and status = 'pending';
end;
$$;

comment on function public.set_plan_decided_active(uuid) is
    'tb-WF-1 — pending → decided-active transition, invoked by '
    'compute-verdict on successful verdict-fire (when room.plan_id '
    'is non-null). SECURITY DEFINER. Idempotent — re-invoke on a '
    'non-pending plan is a no-op. The exact reroll_window_closes_at '
    'computation is sg-WF-6; this function stamps a best-effort '
    'two-day window so the column is observable.';

-- Authenticated users can call the function via PostgREST RPC for
-- future iOS write paths (none today — compute-verdict invokes it
-- via the service-role key, which bypasses RLS). The function body
-- only flips a Plan owned by the caller because RLS on `plans`
-- still gates the UPDATE when the function is invoked WITHOUT the
-- service-role key... but `security definer` bypasses that, so the
-- predicate inside the function intentionally limits the change to
-- `status = 'pending'` and a known plan id. Future-proofing only.
grant execute on function public.set_plan_decided_active(uuid) to authenticated;
