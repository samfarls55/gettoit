-- TB-02 (Google provider migration) -- Google-only durable storage baseline.
--
-- A fresh reset may replay older pre-migration DDL, but the active
-- schema must end with no provider cache, raw fetch payload, or
-- display-content snapshot storage. Durable place identity is Google
-- provider + Google Place ID; display content is refetched when a
-- surface needs to render it.

drop table if exists public.places cascade;
drop table if exists public.member_fetches cascade;

-- Per-room candidate identity remains useful as app-owned active-room
-- state, but it must not be a provider response cache.
alter table public.options
    add column if not exists place_provider text not null default 'google',
    add column if not exists google_place_id text;

update public.options
set google_place_id = fsq_place_id
where google_place_id is null
  and fsq_place_id is not null;

alter table public.options
    alter column google_place_id set not null;

alter table public.options
    drop constraint if exists options_room_id_fsq_place_id_key,
    drop constraint if exists options_google_provider_chk,
    add constraint options_google_provider_chk check (place_provider = 'google'),
    drop column if exists fsq_place_id,
    drop column if exists payload;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.options'::regclass
          and conname = 'options_room_provider_google_place_id_key'
    ) then
        alter table public.options
            add constraint options_room_provider_google_place_id_key
            unique (room_id, place_provider, google_place_id);
    end if;
end $$;

-- Verdict rows may name the current winner by Google identity and keep
-- app-owned audit metadata. They must not store provider display
-- content or provider-fact component scores.
alter table public.verdicts
    add column if not exists winner_place_provider text,
    add column if not exists winner_google_place_id text,
    add column if not exists final_fit_score numeric,
    add column if not exists scoring_version text,
    add column if not exists receipts jsonb not null default '[]'::jsonb,
    drop constraint if exists verdicts_winner_google_provider_chk,
    drop constraint if exists verdicts_receipts_array_chk,
    add constraint verdicts_winner_google_provider_chk
        check (winner_place_provider is null or winner_place_provider = 'google'),
    add constraint verdicts_receipts_array_chk
        check (jsonb_typeof(receipts) = 'array');

create table if not exists public.verdict_slate_entries (
    verdict_id        uuid        not null references public.verdicts (id) on delete cascade,
    room_id           uuid        not null references public.rooms (id) on delete cascade,
    slate_rank        smallint    not null check (slate_rank between 1 and 4),
    place_provider    text        not null default 'google' check (place_provider = 'google'),
    google_place_id   text        not null,
    final_fit_score   numeric     not null,
    scoring_version   text        not null,
    receipts          jsonb       not null default '[]'::jsonb check (jsonb_typeof(receipts) = 'array'),
    created_at        timestamptz not null default now(),
    primary key (verdict_id, slate_rank),
    unique (verdict_id, place_provider, google_place_id)
);

create index if not exists verdict_slate_entries_room_id_idx
    on public.verdict_slate_entries (room_id);

comment on table public.verdict_slate_entries is
    'TB-02 Google provider migration -- top-four verdict slate. Stores Google Place ID plus app-owned rank, final fit score, scoring version, and receipts only. No provider display content, raw payload, or provider-fact component scores.';

comment on column public.verdict_slate_entries.google_place_id is
    'Google Place ID retained as provider identity. Display content is refetched at render time.';

alter table public.verdict_slate_entries enable row level security;

drop policy if exists "verdict_slate_entries_select_room_members" on public.verdict_slate_entries;
create policy "verdict_slate_entries_select_room_members" on public.verdict_slate_entries
    for select
    to authenticated
    using (
        room_id in (select room_id from public.members where user_id = (select auth.uid()))
    );

-- The Plan list may show app-owned Plan context, but not a stale
-- provider place name. Current display surfaces refetch by Place ID.
drop function if exists public.plans_decided_for_user(uuid);
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
    role                     text
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
        case when m.role = 'owner' then 'owner' else 'joined' end as role
    from public.plans p
    join public.rooms r on r.plan_id = p.id
    join public.members m on m.room_id = r.id
    where p.status = 'decided-active'
      and m.user_id = (select auth.uid())
      and m.user_id = p_user_id
    order by p.verdict_fired_at desc nulls last, p.created_at desc;
$$;

comment on function public.plans_decided_for_user(uuid) is
    'TB-02 amended Plan-list Decided RPC. Returns app-owned Plan context only; provider display content is refetched by Google Place ID when a verdict surface renders.';

revoke all on function public.plans_decided_for_user(uuid) from public;
grant execute on function public.plans_decided_for_user(uuid) to authenticated;

drop function if exists public.plans_history_for_user(uuid);
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
    role                     text
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
        case when m.role = 'owner' then 'owner' else 'joined' end as role
    from public.plans p
    join public.rooms r on r.plan_id = p.id
    join public.members m on m.room_id = r.id
    where p.status = 'decided-expired'
      and m.user_id = (select auth.uid())
      and m.user_id = p_user_id
    order by p.expired_at desc nulls last, p.created_at desc;
$$;

comment on function public.plans_history_for_user(uuid) is
    'TB-02 amended Plan-list History RPC. Returns app-owned Plan context only; degraded history must not replay stale provider display content.';

revoke all on function public.plans_history_for_user(uuid) from public;
grant execute on function public.plans_history_for_user(uuid) to authenticated;

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
        select jsonb_build_object(
            'id', id,
            'place_provider', place_provider,
            'google_place_id', google_place_id
        )
        into v_option
        from public.options
        where id = v_verdict.option_id;
    else
        v_option := null;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'option_id', oc.option_id,
        'cut_reason', oc.cut_reason,
        'cut_text', oc.cut_text
    ) order by oc.option_id), '[]'::jsonb)
    into v_cuts
    from public.option_cuts oc
    where oc.verdict_id = v_verdict.id;

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
    'TB-02 amended read-only verdict RPC. Returns app-owned verdict state plus Google identity only; provider display content must be refetched for rendering.';

revoke all on function public.fetch_read_only_verdict(uuid) from public;
grant execute on function public.fetch_read_only_verdict(uuid) to authenticated;
