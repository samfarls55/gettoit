-- TB-04 (v1.1) — generic Q1..Q5 jsonb votes schema.
--
-- Replaces the v1 `votes` table's typed-per-question columns
-- (`q1_vetoes text[]`, `q2_budget int`, `q3_walk_minutes int`,
-- `q4_vibe int`, `q5_regret jsonb`) with five GENERIC jsonb slots,
-- `q1`..`q5`. The v1.1 quiz redesign (PRD module H) makes quiz content
-- session-variable: questions can be reordered, reworded, or have their
-- option copy changed without a migration. The typed columns coupled
-- the schema to one fixed quiz; the generic slots decouple it.
--
-- Each slot stores a `{ meta, answer }` envelope:
--   * `meta`   — per-session question metadata. The load-bearing field
--                is `question_kind` (a discriminator: `dietary_veto`,
--                `budget_cap`, `walk_minutes`, `vibe`, `regret`). `meta`
--                may also carry the prompt + option copy the session
--                showed — descriptive, for audit / replay.
--   * `answer` — the member's response payload, shaped per kind.
-- The verdict engine reads these slots through the schema-driven
-- mapping layer in `supabase/functions/_shared/votes-schema.ts`, which
-- dispatches on `meta.question_kind` rather than on the column name.
-- Per-session question variability lives in the jsonb, never in the
-- schema — that is the whole point of the slot shape.
--
-- Pre-launch with no real user data, so recreating the table is
-- acceptable (the v1 TestFlight dogfood produced no rows worth
-- preserving). DROP + CREATE is cleaner than five ALTER COLUMNs and
-- a backfill that would have nothing to backfill.
--
-- RLS, the (room_id, user_id) primary key, the write-once contract,
-- and the cascading FKs are carried over verbatim from the v1 votes
-- migration (`20260513215000000_votes.sql`) — only the answer columns
-- change shape. See that file's header for the rationale behind each
-- policy; it is unchanged here.
--
-- The `AFTER INSERT ON votes` verdict-fire trigger lives in
-- `20260514000020000_*` / the verdict-fire migrations and references
-- the table, not the dropped columns, so it survives the recreate.
-- It is re-created defensively at the end if the recreate dropped it
-- via CASCADE.

-- ── Recreate the table ───────────────────────────────────────────────
-- CASCADE drops any objects that depended on the old column shape
-- (e.g. the verdict-fire trigger). They are restored below.
drop table if exists public.votes cascade;

create table public.votes (
    room_id    uuid        not null references public.rooms (id) on delete cascade,
    user_id    uuid        not null references auth.users (id) on delete cascade,
    -- Generic question slots. Each is a `{ meta, answer }` jsonb
    -- envelope; `meta.question_kind` is the discriminator the engine's
    -- mapping layer dispatches on. A slot is NULL when the session did
    -- not ask that question — the mapping layer defaults an absent
    -- slot to the most-permissive answer so an unasked question never
    -- prunes a candidate.
    q1         jsonb,
    q2         jsonb,
    q3         jsonb,
    q4         jsonb,
    q5         jsonb,
    created_at timestamptz not null default now(),
    primary key (room_id, user_id),
    -- Each present slot must be a `{ meta, answer }` object carrying a
    -- string `question_kind`. NULL slots are allowed (unasked
    -- question); a present slot that is malformed is rejected at the
    -- DB layer so a bad write fails fast rather than corrupting a
    -- verdict downstream.
    constraint votes_q1_well_formed check (
        q1 is null or (
            jsonb_typeof(q1) = 'object'
            and jsonb_typeof(q1 -> 'meta') = 'object'
            and jsonb_typeof(q1 #> '{meta,question_kind}') = 'string'
        )
    ),
    constraint votes_q2_well_formed check (
        q2 is null or (
            jsonb_typeof(q2) = 'object'
            and jsonb_typeof(q2 -> 'meta') = 'object'
            and jsonb_typeof(q2 #> '{meta,question_kind}') = 'string'
        )
    ),
    constraint votes_q3_well_formed check (
        q3 is null or (
            jsonb_typeof(q3) = 'object'
            and jsonb_typeof(q3 -> 'meta') = 'object'
            and jsonb_typeof(q3 #> '{meta,question_kind}') = 'string'
        )
    ),
    constraint votes_q4_well_formed check (
        q4 is null or (
            jsonb_typeof(q4) = 'object'
            and jsonb_typeof(q4 -> 'meta') = 'object'
            and jsonb_typeof(q4 #> '{meta,question_kind}') = 'string'
        )
    ),
    constraint votes_q5_well_formed check (
        q5 is null or (
            jsonb_typeof(q5) = 'object'
            and jsonb_typeof(q5 -> 'meta') = 'object'
            and jsonb_typeof(q5 #> '{meta,question_kind}') = 'string'
        )
    )
);

comment on table public.votes is
    'Per-user quiz answers for a room, stored as five generic jsonb question slots (q1..q5). Each slot is a { meta, answer } envelope; meta.question_kind tells the verdict-engine mapping layer how to interpret answer. Written once on quiz-submit; the (room_id, user_id) primary key prevents pollution from a re-submit. Read by the VerdictEngine via _shared/votes-schema.ts.';

comment on column public.votes.q1 is
    'Generic question slot 1 — { meta, answer } jsonb envelope. meta.question_kind discriminates the answer shape. NULL when the session did not ask a question here.';
comment on column public.votes.q2 is
    'Generic question slot 2 — see q1.';
comment on column public.votes.q3 is
    'Generic question slot 3 — see q1.';
comment on column public.votes.q4 is
    'Generic question slot 4 — see q1.';
comment on column public.votes.q5 is
    'Generic question slot 5 — see q1.';

create index if not exists votes_room_id_idx on public.votes (room_id);

-- ── RLS — carried over verbatim from 20260513215000000_votes.sql ─────
alter table public.votes enable row level security;

-- A user can see their own vote and any other member's votes for the
-- same room (the verdict screen surfaces room-mate picks as
-- voice-receipts — PRD user story 34).
drop policy if exists "votes_select_room_members" on public.votes;
create policy "votes_select_room_members" on public.votes
    for select
    to authenticated
    using (
        room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- A user can insert exactly one row for themselves, in a room they
-- belong to. The (room_id, user_id) primary key handles idempotency on
-- retry (a second insert raises 23505 the client can swallow).
drop policy if exists "votes_insert_self_in_room" on public.votes;
create policy "votes_insert_self_in_room" on public.votes
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- No UPDATE / DELETE policies — RLS denies by default. The quiz is
-- write-once per (room, user); correcting an answer means exiting and
-- starting fresh, which lands the user back on the same unique-
-- constraint reject (PRD user story 26).

-- ── Restore the verdict-fire trigger ─────────────────────────────────
-- The DROP TABLE ... CASCADE above removed the `AFTER INSERT ON votes`
-- trigger (`votes_maybe_fire_verdict`) that fires the VerdictEngine on
-- full quorum. Re-create it so the auto-fire path survives the table
-- recreate. The trigger function `public.votes_maybe_fire_verdict()`
-- is defined in `20260513224000000_verdict_fire_trigger_and_cron.sql`
-- and reads only `new.room_id` + room state + a `count(*)` of votes —
-- never the old typed answer columns — so the recreated trigger
-- behaves identically against the new jsonb shape.
--
-- The function survives the table DROP (it is schema-level, not
-- table-owned); only the trigger binding is dropped by CASCADE. We
-- re-bind it here, guarded on the function existing so this migration
-- is safe to run on a fresh database where the verdict-fire migration
-- has not yet applied (migrations run in filename order, and this one
-- is dated after the verdict-fire migration, so in practice the
-- function is always present — the guard is defensive).
do $$
begin
    if exists (
        select 1 from pg_proc
        where proname = 'votes_maybe_fire_verdict'
          and pronamespace = 'public'::regnamespace
    ) then
        drop trigger if exists votes_maybe_fire_verdict on public.votes;
        create trigger votes_maybe_fire_verdict
            after insert on public.votes
            for each row
            execute function public.votes_maybe_fire_verdict();
    end if;
end
$$;

-- ── SQL-side mapping helpers ──────────────────────────────────────────
--
-- The verdict engine reads votes through the TypeScript mapping layer
-- (`_shared/votes-schema.ts`). Two SQL RPCs — `apply_reroll` and
-- `fetch_read_only_verdict` — also read / write quiz answers and were
-- written against the old typed columns. Rather than re-couple them to
-- a fixed quiz, they go through these SQL-side mapping helpers, which
-- mirror the TypeScript layer: dispatch on `meta.question_kind`, never
-- on a slot column name.
--
-- A votes row has five generic slots q1..q5; a question of a given
-- kind may live in any of them. These helpers scan all five and act on
-- the slot whose `meta.question_kind` matches.

-- Find the slot of a given question_kind in a votes row, as jsonb.
-- Returns NULL when no slot carries that kind.
create or replace function public.votes_slot_of_kind(
    p_room_id uuid,
    p_user_id uuid,
    p_kind    text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select slot
    from public.votes v
    cross join lateral (
        values (v.q1), (v.q2), (v.q3), (v.q4), (v.q5)
    ) as s(slot)
    where v.room_id = p_room_id
      and v.user_id = p_user_id
      and s.slot is not null
      and s.slot #>> '{meta,question_kind}' = p_kind
    limit 1;
$$;

comment on function public.votes_slot_of_kind(uuid, uuid, text) is
    'TB-04 — return the { meta, answer } jsonb slot of a given question_kind for one member''s votes row. NULL when absent. Mirrors the dispatch-on-question_kind contract of _shared/votes-schema.ts.';

-- Aggregate helper — the MIN integer answer for a kind across every
-- member of a room. Used by apply_reroll's cost / dist tightening.
-- `answer #>> {answer_key}` is the per-kind scalar; rows whose slot is
-- absent or non-numeric are skipped. `p_default` is returned when no
-- member supplied the answer.
create or replace function public.votes_min_int_answer(
    p_room_id    uuid,
    p_kind       text,
    p_answer_key text,
    p_default    int
)
returns int
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        min((s.slot #>> array['answer', p_answer_key])::int),
        p_default
    )
    from public.votes v
    cross join lateral (
        values (v.q1), (v.q2), (v.q3), (v.q4), (v.q5)
    ) as s(slot)
    where v.room_id = p_room_id
      and s.slot is not null
      and s.slot #>> '{meta,question_kind}' = p_kind
      and (s.slot #>> array['answer', p_answer_key]) ~ '^-?[0-9]+$';
$$;

comment on function public.votes_min_int_answer(uuid, text, text, int) is
    'TB-04 — MIN integer answer for a question_kind across a room''s votes. Skips members whose slot is absent / non-numeric; returns p_default when none supplied. Mirrors the room-aggregate MIN the verdict engine computes.';

-- Patch the `answer` of whichever slot in a member's votes row carries
-- a given question_kind, merging `p_answer_patch` into the existing
-- answer object. Used by apply_reroll's mood (set vibe level) and diet
-- (append a dietary chip) paths. SECURITY DEFINER so the RPC can write
-- the caller's own row despite the votes table having no UPDATE policy.
-- No-op when the member has no slot of that kind.
create or replace function public.votes_patch_answer(
    p_room_id      uuid,
    p_user_id      uuid,
    p_kind         text,
    p_answer_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.votes v
    set q1 = case when v.q1 #>> '{meta,question_kind}' = p_kind
                  then jsonb_set(v.q1, '{answer}',
                       coalesce(v.q1 -> 'answer', '{}'::jsonb) || p_answer_patch)
                  else v.q1 end,
        q2 = case when v.q2 #>> '{meta,question_kind}' = p_kind
                  then jsonb_set(v.q2, '{answer}',
                       coalesce(v.q2 -> 'answer', '{}'::jsonb) || p_answer_patch)
                  else v.q2 end,
        q3 = case when v.q3 #>> '{meta,question_kind}' = p_kind
                  then jsonb_set(v.q3, '{answer}',
                       coalesce(v.q3 -> 'answer', '{}'::jsonb) || p_answer_patch)
                  else v.q3 end,
        q4 = case when v.q4 #>> '{meta,question_kind}' = p_kind
                  then jsonb_set(v.q4, '{answer}',
                       coalesce(v.q4 -> 'answer', '{}'::jsonb) || p_answer_patch)
                  else v.q4 end,
        q5 = case when v.q5 #>> '{meta,question_kind}' = p_kind
                  then jsonb_set(v.q5, '{answer}',
                       coalesce(v.q5 -> 'answer', '{}'::jsonb) || p_answer_patch)
                  else v.q5 end
    where v.room_id = p_room_id
      and v.user_id = p_user_id;
end;
$$;

comment on function public.votes_patch_answer(uuid, uuid, text, jsonb) is
    'TB-04 — merge an answer patch into whichever generic slot carries a given question_kind for one member. SECURITY DEFINER (votes has no client UPDATE policy). No-op when the kind is absent. Used by apply_reroll mood / diet paths.';

-- ── apply_reroll — re-created against the generic jsonb shape ─────────
--
-- TB-04: the v1 `apply_reroll` (20260514000300000_rerolls.sql) read
-- `min(q2_budget)` / `min(q3_walk_minutes)` and wrote `q4_vibe` /
-- `q1_vetoes_extra` directly. Those typed columns are gone. The body
-- below is identical in BEHAVIOR — same validation, same 3-cap, same
-- per-reason mutations, same return shape — but the four quiz-answer
-- touch points now go through the mapping helpers above:
--   * cost  — votes_min_int_answer(..., 'budget_cap', 'tier', 4)
--   * dist  — votes_min_int_answer(..., 'walk_minutes', 'minutes', 30)
--   * mood  — votes_patch_answer(..., 'vibe', { "level": <new> })
--   * diet  — appends to the dietary slot's `answer.vetoes_extra` array
-- The dietary reroll-extra chips land in `answer.vetoes_extra`; the
-- TypeScript mapping layer unions them into `q1_vetoes` for the engine.
create or replace function public.apply_reroll(
    p_room_id     uuid,
    p_reason      text,
    p_detail      text default null,
    p_diet_chip   text default null,
    p_new_vibe    int  default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller          uuid := (select auth.uid());
    v_room            public.rooms%rowtype;
    v_count           int;
    v_reroll_id       uuid;
    v_current_verdict public.verdicts%rowtype;
    v_existing_budget int;
    v_existing_walk   int;
    v_is_member       boolean;
    v_diet_slot       jsonb;
    v_diet_extra      jsonb;
begin
    if v_caller is null then
        return jsonb_build_object('error', 'unauthenticated');
    end if;

    if p_reason not in ('cost', 'dist', 'mood', 'diet', 'avail') then
        return jsonb_build_object('error', 'invalid_reason', 'reason', p_reason);
    end if;

    select * into v_room from public.rooms where id = p_room_id;
    if not found then
        return jsonb_build_object('error', 'room_not_found');
    end if;

    select exists (
        select 1 from public.members
        where room_id = p_room_id
          and user_id = v_caller
    ) into v_is_member;

    if not v_is_member then
        return jsonb_build_object('error', 'not_a_member');
    end if;

    select count(*)::int into v_count
    from public.rerolls
    where room_id = p_room_id;

    if v_count >= 3 then
        return jsonb_build_object(
            'error', 'cap_exhausted',
            'count', v_count,
            'cap',   3
        );
    end if;

    if p_reason = 'diet' and (p_diet_chip is null or length(p_diet_chip) = 0) then
        return jsonb_build_object('error', 'diet_chip_required');
    end if;
    if p_reason = 'mood' and (p_new_vibe is null or p_new_vibe < 0 or p_new_vibe > 4) then
        return jsonb_build_object('error', 'new_vibe_required');
    end if;

    select * into v_current_verdict from public.verdicts where room_id = p_room_id;

    insert into public.rerolls (room_id, user_id, reason, detail)
    values (p_room_id, v_caller, p_reason, p_detail)
    returning id into v_reroll_id;

    -- Per-reason mutations — same semantics as v1, jsonb-backed.
    if p_reason = 'cost' then
        v_existing_budget := least(
            public.votes_min_int_answer(p_room_id, 'budget_cap', 'tier', 4),
            coalesce(v_room.budget_tier_override, 4)
        );
        update public.rooms
        set budget_tier_override = greatest(1, v_existing_budget - 1)
        where id = p_room_id;

    elsif p_reason = 'dist' then
        v_existing_walk := least(
            public.votes_min_int_answer(p_room_id, 'walk_minutes', 'minutes', 30),
            coalesce(v_room.walk_minutes_override, 30)
        );
        update public.rooms
        set walk_minutes_override = greatest(5, v_existing_walk - 5)
        where id = p_room_id;

    elsif p_reason = 'mood' then
        -- Replace the caller's vibe level in whichever slot carries it.
        perform public.votes_patch_answer(
            p_room_id, v_caller, 'vibe',
            jsonb_build_object('level', p_new_vibe)
        );

    elsif p_reason = 'diet' then
        -- Append the chip to the dietary slot's `answer.vetoes_extra`
        -- array — the immutable `answer.vetoes` original is untouched.
        -- The mapping layer unions vetoes + vetoes_extra for the engine.
        v_diet_slot := public.votes_slot_of_kind(p_room_id, v_caller, 'dietary_veto');
        if v_diet_slot is not null then
            v_diet_extra := coalesce(v_diet_slot #> '{answer,vetoes_extra}', '[]'::jsonb)
                            || to_jsonb(p_diet_chip);
            perform public.votes_patch_answer(
                p_room_id, v_caller, 'dietary_veto',
                jsonb_build_object('vetoes_extra', v_diet_extra)
            );
        end if;

    elsif p_reason = 'avail' then
        if v_current_verdict.option_id is not null then
            update public.rooms
            set excluded_option_ids = array_append(
                coalesce(excluded_option_ids, '{}'::uuid[]),
                v_current_verdict.option_id
            )
            where id = p_room_id;
        end if;
    end if;

    update public.rooms
    set last_reroll_reason = p_reason
    where id = p_room_id;

    delete from public.verdicts where room_id = p_room_id;

    update public.rooms
    set status = 'firing'
    where id = p_room_id
      and status in ('verdict_ready', 'firing');

    return jsonb_build_object(
        'status',              'rerolled',
        'reroll_id',           v_reroll_id,
        'reason',              p_reason,
        'count',               v_count + 1,
        'remaining',           greatest(0, 3 - (v_count + 1)),
        'last_reroll_reason',  p_reason
    );
end;
$$;

comment on function public.apply_reroll(uuid, text, text, text, int) is
    'TB-10 reroll RPC (TB-04 re-cut for the generic jsonb votes shape). Same behavior — member check, 3/room cap, per-reason mutation, verdict drop, last_reroll_reason stamp — but the quiz-answer reads / writes go through the votes_* mapping helpers instead of typed columns.';

revoke all on function public.apply_reroll(uuid, text, text, text, int) from public;

-- ── fetch_read_only_verdict — receipts re-cut for the jsonb shape ────
--
-- TB-04: the v1 `fetch_read_only_verdict`
-- (20260514000500000_join_room_smart.sql) built each receipt from the
-- typed votes columns. The body below is byte-identical except for the
-- receipts aggregate, which now reads the generic slots through the
-- mapping helpers so the receipt payload shape is unchanged for the
-- iOS late-joiner S05 render. The diet-reroll `vetoes_extra` additions
-- are unioned into `q1_vetoes` so the receipt matches what the engine
-- actually pruned on.
create or replace function public.fetch_read_only_verdict(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller    uuid := (select auth.uid());
    v_room      public.rooms%rowtype;
    v_verdict   public.verdicts%rowtype;
    v_option    jsonb;
    v_cuts      jsonb;
    v_receipts  jsonb;
    v_members   int;
begin
    if v_caller is null then
        return jsonb_build_object('error', 'unauthenticated');
    end if;

    select * into v_room
    from public.rooms
    where id = p_room_id;

    if not found then
        return jsonb_build_object('error', 'room_not_found');
    end if;

    select * into v_verdict
    from public.verdicts
    where room_id = p_room_id
    order by computed_at desc
    limit 1;

    if not found then
        return jsonb_build_object('error', 'no_verdict');
    end if;

    if v_verdict.option_id is not null then
        select jsonb_build_object('id', id, 'payload', payload)
        into v_option
        from public.options
        where id = v_verdict.option_id;
    else
        v_option := null;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'option_id', oc.option_id,
        'option_name', o.payload->>'name',
        'cut_reason', oc.cut_reason,
        'cut_text', oc.cut_text
    ) order by oc.option_id), '[]'::jsonb)
    into v_cuts
    from public.option_cuts oc
    left join public.options o on o.id = oc.option_id
    where oc.verdict_id = v_verdict.id;

    -- Receipts — every vote row for the room, projected back to the
    -- legacy receipt shape from the generic slots via the mapping
    -- helpers. q1_vetoes is the union of the dietary slot's `vetoes`
    -- and `vetoes_extra` (diet-reroll additions) so it matches what
    -- the verdict engine pruned on.
    select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', v.user_id,
        'q1_vetoes', (
            select coalesce(jsonb_agg(distinct chip), '[]'::jsonb)
            from (
                select jsonb_array_elements_text(
                    coalesce(diet.slot #> '{answer,vetoes}', '[]'::jsonb)
                ) as chip
                union
                select jsonb_array_elements_text(
                    coalesce(diet.slot #> '{answer,vetoes_extra}', '[]'::jsonb)
                )
            ) chips
        ),
        'q2_budget',       coalesce((budget.slot #>> '{answer,tier}')::int, 4),
        'q3_walk_minutes', coalesce((walk.slot   #>> '{answer,minutes}')::int, 30),
        'q4_vibe',         coalesce((vibe.slot    #>> '{answer,level}')::int, 2),
        'q5_regret',       coalesce(regret.slot   #> '{answer,scores}', '{}'::jsonb)
    ) order by v.user_id), '[]'::jsonb)
    into v_receipts
    from public.votes v
    cross join lateral (
        select public.votes_slot_of_kind(v.room_id, v.user_id, 'dietary_veto') as slot
    ) diet
    cross join lateral (
        select public.votes_slot_of_kind(v.room_id, v.user_id, 'budget_cap') as slot
    ) budget
    cross join lateral (
        select public.votes_slot_of_kind(v.room_id, v.user_id, 'walk_minutes') as slot
    ) walk
    cross join lateral (
        select public.votes_slot_of_kind(v.room_id, v.user_id, 'vibe') as slot
    ) vibe
    cross join lateral (
        select public.votes_slot_of_kind(v.room_id, v.user_id, 'regret') as slot
    ) regret
    where v.room_id = p_room_id;

    select count(*)::int
    into v_members
    from public.members
    where room_id = p_room_id;

    return jsonb_build_object(
        'verdict', jsonb_build_object(
            'id', v_verdict.id,
            'method', v_verdict.method,
            'rule_text', v_verdict.rule_text,
            'option', v_option,
            'computed_at', v_verdict.computed_at
        ),
        'cuts', v_cuts,
        'receipts', v_receipts,
        'member_count', v_members,
        'room', jsonb_build_object(
            'timer_minutes', v_room.timer_minutes,
            'radius_meters', v_room.radius_meters,
            'status', v_room.status
        )
    );
end;
$$;

comment on function public.fetch_read_only_verdict(uuid) is
    'TB-11 read-only verdict payload (TB-04 re-cut for the generic jsonb votes shape). Receipts are projected from the generic slots via votes_slot_of_kind; the receipt payload shape is unchanged for the iOS late-joiner S05 render.';

revoke all on function public.fetch_read_only_verdict(uuid) from public;
grant execute on function public.fetch_read_only_verdict(uuid) to authenticated;
