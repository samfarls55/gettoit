-- tb-WF-7 (workflow-overhaul) — Joiner journey, end to end.
--
-- This migration lands three pieces the iOS port (`PlanListScreen` +
-- `QuizCoordinator` + `RootView`) needs to render Joined plans on the
-- S00 Plan list and resume the joiner mid-quiz:
--
--   1. A `members.quiz_progress jsonb` column. Stores the in-flight
--      quiz state per (room, user) so a joiner who backgrounds the
--      app at Q3 can be re-mounted on Q3 with their Q1 + Q2 answers
--      intact. The Q5 vote write still lands in `votes` and still
--      fires the verdict — `quiz_progress` is a pre-submit working
--      copy, not a replacement for `votes`.
--
--      Shape: `{ "last_index": 0..5, "answers": { "q1": {...}, ... } }`.
--      The `answers` slots mirror the `{ meta, answer }` envelope shape
--      that `votes.qN` carries (see `votes_generic_jsonb` migration).
--      The iOS port packs and unpacks via the same `votes-schema.ts`
--      contract; the column is jsonb so future quiz redesigns add
--      slots without a migration (ADR 0010 precedent).
--
--   2. A `members_progress_upsert(p_room_id, p_progress)` RPC. The
--      `members` table has no UPDATE policy by default (only INSERT
--      + DELETE-self landed in earlier migrations), so a client
--      UPDATE is silently denied. The RPC is SECURITY DEFINER but
--      pinned to `user_id = auth.uid()` so a caller can only ever
--      patch their OWN row — the function body is the contract, not
--      a per-column policy.
--
--   3. A `plans_select_room_member` RLS policy. A joiner is a `members`
--      row of a `rooms` row whose `plan_id` points at a `plans` row
--      owned by someone else. The original `plans_select_creator`
--      policy hid every Plan from non-creators, so the joined-Plan
--      list query would have returned zero rows. The new policy
--      widens SELECT to admit a row to anyone who is a member of a
--      room linked to it. Joiners never get INSERT/UPDATE/DELETE on
--      someone else's Plan — those policies stay creator-only.
--
-- Why a single migration: all three pieces are read-paired. The list
-- query joins `members → rooms → plans` and projects `quiz_progress`
-- alongside the Plan; both the SELECT policy widening and the column
-- must land together or the iOS read path returns half-shapes.
--
-- Down-migration: drop the policy, drop the RPC, drop the column.
-- Reversible (no data loss outside the in-flight quiz_progress
-- working copies, which are recomputable from the user re-walking
-- the quiz).

-- ── 1. members.quiz_progress column ──────────────────────────────────

alter table public.members
    add column if not exists quiz_progress jsonb not null default '{}'::jsonb;

comment on column public.members.quiz_progress is
    'tb-WF-7 — in-flight quiz state for a joiner. Shape: '
    '{ "last_index": 0..5, "answers": { "q1": {...}, ... } }. '
    'Pre-submit working copy; the Q5 submit still writes the final '
    'envelope into `votes` and fires the verdict. Empty object '
    'default so a freshly-inserted member always has a valid '
    'JSON object the iOS read path can decode without nil checks.';

-- ── 2. members_progress_upsert RPC ───────────────────────────────────

-- The `members` table has no client-side UPDATE policy. Adding one
-- generically would let a member rewrite their `role` column (which
-- is the owner/participant discriminator the verdict engine reads),
-- so the safer path is a SECURITY DEFINER RPC that pins the write
-- to the `quiz_progress` column AND to `user_id = auth.uid()`.
--
-- Idempotent: re-invoking with the same payload is a no-op past the
-- single column write. The RPC is best-effort from the iOS side —
-- the caller does NOT block the next quiz step on the round-trip
-- (the column is a resume-from-state convenience, not a verdict-
-- engine input), so transient network failures degrade gracefully.

create or replace function public.members_progress_upsert(
    p_room_id  uuid,
    p_progress jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller uuid := (select auth.uid());
begin
    if v_caller is null then
        return;  -- unauthenticated: silent no-op, RLS-equivalent
    end if;

    if jsonb_typeof(p_progress) is distinct from 'object' then
        -- A malformed payload (non-object) is a programming error on
        -- the iOS side; refuse it loudly so the bug surfaces in tests.
        raise exception 'p_progress must be a jsonb object';
    end if;

    update public.members
        set quiz_progress = p_progress
        where room_id = p_room_id
          and user_id = v_caller;
end;
$$;

comment on function public.members_progress_upsert(uuid, jsonb) is
    'tb-WF-7 — patch the caller''s `quiz_progress` jsonb on their '
    'own `members` row. SECURITY DEFINER because the `members` table '
    'carries no generic UPDATE policy (writing `role` would be a '
    'verdict-engine input). Body pins to `user_id = auth.uid()`. '
    'Best-effort from the iOS side; transient failures degrade '
    'gracefully because the column is a resume-from-state '
    'convenience, not a verdict-engine input.';

revoke all on function public.members_progress_upsert(uuid, jsonb) from public;
grant execute on function public.members_progress_upsert(uuid, jsonb) to authenticated;

-- ── 3. plans_select_room_member RLS policy ───────────────────────────

-- The base `plans_select_creator` policy admits a row only when the
-- caller is the creator. The Joined-Plan list query (called by the
-- iOS `PlansStore.joinedPlansForList`) needs to read Plans the caller
-- did NOT create but is a member of through `rooms.plan_id`. Without
-- this policy the joined-list query returns zero rows.
--
-- The widening admits ONLY rows linked to a room the caller is a
-- member of — never the entire `plans` table. INSERT / UPDATE /
-- DELETE remain creator-only. Per the canonical RLS rule of thumb
-- (`stack-patterns.md`), per-room visibility filters by membership:
--   id in (
--     select r.plan_id from public.rooms r
--     where r.id in (select m.room_id from public.members m
--                    where m.user_id = (select auth.uid()))
--       and r.plan_id is not null
--   )

drop policy if exists "plans_select_room_member" on public.plans;
create policy "plans_select_room_member" on public.plans
    for select
    to authenticated
    using (
        id in (
            select r.plan_id from public.rooms r
            where r.id in (
                select m.room_id from public.members m
                where m.user_id = (select auth.uid())
            )
            and r.plan_id is not null
        )
    );

comment on policy "plans_select_room_member" on public.plans is
    'tb-WF-7 — admits SELECT on a Plan to any user who is a member of '
    'a room linked to it (`rooms.plan_id`). Co-exists with '
    '`plans_select_creator` (creator-only SELECT); the two policies '
    'are OR-ed by RLS so the caller may match either path. Joiners '
    'never gain INSERT / UPDATE / DELETE — those stay creator-only.';

-- ── 4. joined_plans_for_user RPC ─────────────────────────────────────

-- The S00 Plan list's Joined section queries this RPC. One round-trip
-- returns every Plan the caller is a non-owner member of, with the
-- per-joiner resume signals (`last_answered_question_index`,
-- `has_voted`) projected inline so the iOS port does not have to fan
-- out N+1 lookups per card.
--
-- Why an RPC rather than an embedded PostgREST select:
--   * The select would need to read `votes` to derive `has_voted` AND
--     `members.quiz_progress` for the index AND `plans.*` for the row
--     body — three tables joined per row. PostgREST can express that
--     via embedded selects, but the projection of nested jsonb (the
--     progress `last_index`) is awkward; the RPC keeps the wire shape
--     flat for the iOS Decodable.
--   * The exit-filtering predicate (`members.user_id = caller`) is
--     a natural WHERE clause on the RPC body — an exited joiner has
--     no `members` row, so the row simply doesn't appear in the
--     result set. That is exactly the §"Edge cases — Exited joiner"
--     contract from the issue body.
--   * The role filter (`role <> 'owner'`) excludes the creator's own
--     Plan from this list — those Plans land in the Created (Pending /
--     Decided / History) sections via the existing `plansForList`
--     query.
--
-- SECURITY DEFINER so the RPC can read `votes` rows the caller can
-- already see via the existing `votes_select_room_members` policy
-- (RLS would pass anyway, but `security definer` makes the body
-- self-contained — a future RLS tightening doesn't silently empty
-- this RPC). The body still pins to `auth.uid()`, so a caller can
-- never request someone else's Joined list.

create or replace function public.joined_plans_for_user(p_user_id uuid)
returns table (
    id                            uuid,
    creator_id                    uuid,
    name                          text,
    category                      text,
    scope                         text,
    location                      jsonb,
    session_params                jsonb,
    distance_meters               int,
    status                        text,
    reroll_window_closes_at       timestamptz,
    created_at                    timestamptz,
    updated_at                    timestamptz,
    last_answered_question_index  int,
    has_voted                     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    -- Pin the result to the authenticated caller. `p_user_id` is
    -- accepted for explicit auditability at the call site, but a
    -- caller may never query someone else's list — if it does not
    -- match `auth.uid()`, the RPC returns zero rows.
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
        p.created_at,
        p.updated_at,
        coalesce((m.quiz_progress ->> 'last_index')::int, 0) as last_answered_question_index,
        exists (
            select 1 from public.votes v
            where v.room_id = r.id
              and v.user_id = m.user_id
        ) as has_voted
    from public.members m
    join public.rooms r on r.id = m.room_id
    join public.plans p on p.id = r.plan_id
    where m.user_id = (select auth.uid())
      and m.user_id = p_user_id
      and m.role <> 'owner'
      and r.plan_id is not null
    order by p.created_at desc;
$$;

comment on function public.joined_plans_for_user(uuid) is
    'tb-WF-7 — the S00 Plan list Joined-section query. Returns every '
    'Plan the caller is a non-owner member of (`members.role <> '
    '''owner''`), with per-joiner resume signals projected inline: '
    '`last_answered_question_index` from `members.quiz_progress.last_index`'
    ' and `has_voted` from the presence of a `votes` row. Exited '
    'joiners (no `members` row) simply do not appear in the result. '
    'Pinned to `auth.uid()` — a mismatched `p_user_id` returns zero rows.';

revoke all on function public.joined_plans_for_user(uuid) from public;
grant execute on function public.joined_plans_for_user(uuid) to authenticated;

-- ── 5. joined_plan_resume_payload RPC ────────────────────────────────

-- Look up the (room_id, quiz_progress) for the caller's membership
-- on a room whose `plan_id = p_plan_id`. Called by the iOS port on
-- a Joined-card tap to hydrate the resumed `QuizCoordinator` (the
-- progress payload becomes the `initialProgress:` arg).
--
-- Returns zero rows when the caller is not a member of any room
-- linked to the Plan — that is the correct shape for a stale tap
-- (a Joined Plan whose room was deleted between list-render and
-- card-tap, or an exited joiner whose tap raced the list refresh).
--
-- Pinned to `auth.uid()` server-side; `p_user_id` is a redundant
-- gate that lets the iOS call site assert the explicit user id at
-- the wire boundary.

create or replace function public.joined_plan_resume_payload(
    p_plan_id uuid,
    p_user_id uuid
)
returns table (
    room_id        uuid,
    quiz_progress  jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        r.id as room_id,
        m.quiz_progress
    from public.rooms r
    join public.members m on m.room_id = r.id
    where r.plan_id = p_plan_id
      and m.user_id = (select auth.uid())
      and m.user_id = p_user_id
      and m.role <> 'owner'
    limit 1;
$$;

comment on function public.joined_plan_resume_payload(uuid, uuid) is
    'tb-WF-7 — resolve the (room_id, quiz_progress) for a Joined '
    'Plan tap. The caller is pinned to `auth.uid()`; zero rows on '
    'a non-member tap or an exited joiner whose `members` row is '
    'gone. The progress payload hydrates the resumed QuizCoordinator.';

revoke all on function public.joined_plan_resume_payload(uuid, uuid) from public;
grant execute on function public.joined_plan_resume_payload(uuid, uuid) to authenticated;
