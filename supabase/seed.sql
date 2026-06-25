-- Local synthetic data only. Safe to rerun: all IDs are deterministic and
-- inserts are conflict-tolerant. This file intentionally contains no
-- production data.

with seed_users as (
    select
        n,
        ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
        lower('local-user-' || lpad(n::text, 2, '0') || '@gettoit.test') as email,
        'Local User ' || lpad(n::text, 2, '0') as display_name
    from generate_series(1, 48) as n
)
insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
)
select
    '00000000-0000-0000-0000-000000000000',
    id,
    'authenticated',
    'authenticated',
    email,
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', display_name),
    now() - (n || ' hours')::interval,
    now() - (n || ' minutes')::interval,
    false
from seed_users
on conflict (id) do update
set
    email = excluded.email,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = excluded.updated_at,
    is_anonymous = false;

with seed_users as (
    select
        n,
        ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
        lower('local-user-' || lpad(n::text, 2, '0') || '@gettoit.test') as email,
        'Local User ' || lpad(n::text, 2, '0') as display_name
    from generate_series(1, 48) as n
)
insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
select
    id,
    id,
    email,
    jsonb_build_object(
        'sub', id::text,
        'email', email,
        'email_verified', true,
        'name', display_name
    ),
    'email',
    now(),
    now() - (n || ' hours')::interval,
    now() - (n || ' minutes')::interval
from seed_users
on conflict (provider_id, provider) do update
set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = excluded.updated_at;

with seed_plans as (
    select
        n,
        ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as plan_id,
        ('10000000-0000-4000-8000-' || lpad((((n - 1) % 48) + 1)::text, 12, '0'))::uuid as creator_id,
        case n % 3 when 0 then 'solo' when 1 then 'duo' else 'group' end as scope,
        case n % 4
            when 0 then 'pending'
            when 1 then 'pending'
            when 2 then 'decided-active'
            else 'decided-expired'
        end as plan_status,
        now() - (n || ' hours')::interval as created_at
    from generate_series(1, 96) as n
)
insert into public.plans (
    id,
    creator_id,
    name,
    category,
    scope,
    location,
    session_params,
    distance_meters,
    status,
    reroll_window_closes_at,
    verdict_fired_at,
    expired_at,
    created_at,
    updated_at
)
select
    plan_id,
    creator_id,
    'Local Plan ' || lpad(n::text, 2, '0'),
    'food',
    scope,
    jsonb_build_object(
        'name', case n % 4
            when 0 then 'Mission District'
            when 1 then 'Capitol Hill'
            when 2 then 'Logan Square'
            else 'Downtown'
        end,
        'lat', 37.7600 + (n::numeric / 10000),
        'lng', -122.4200 - (n::numeric / 10000),
        'source', case n % 2 when 0 then 'manual' else 'gps' end,
        'timeZoneIdentifier', 'America/Los_Angeles'
    ),
    jsonb_build_object(
        'meal_time', case n % 3 when 0 then 'now' when 1 then 'tonight' else 'tomorrow' end,
        'group_context', scope,
        'service_shape', case n % 2 when 0 then 'dine_in' else 'takeout' end,
        'transport_mode', case n % 2 when 0 then 'walk' else 'drive' end
    ),
    case n % 4 when 0 then 805 when 1 then 1609 when 2 then 3219 else 8047 end,
    plan_status,
    case when plan_status = 'decided-active' then now() + interval '36 hours' end,
    case when plan_status in ('decided-active', 'decided-expired') then created_at + interval '45 minutes' end,
    case when plan_status = 'decided-expired' then created_at + interval '3 days' end,
    created_at,
    created_at + interval '20 minutes'
from seed_plans
on conflict (id) do update
set
    name = excluded.name,
    location = excluded.location,
    session_params = excluded.session_params,
    distance_meters = excluded.distance_meters,
    status = excluded.status,
    reroll_window_closes_at = excluded.reroll_window_closes_at,
    verdict_fired_at = excluded.verdict_fired_at,
    expired_at = excluded.expired_at,
    updated_at = excluded.updated_at;

with seed_plans as (
    select
        n,
        ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as plan_id,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id,
        ('10000000-0000-4000-8000-' || lpad((((n - 1) % 48) + 1)::text, 12, '0'))::uuid as creator_id,
        case n % 3 when 0 then 'solo' when 1 then 'duo' else 'group' end as scope,
        case
            when n % 4 = 1 then 'open'
            when n % 8 = 2 then 'verdict_ready'
            when n % 8 = 6 then 'locked'
            else 'expired'
        end as room_status,
        now() - (n || ' hours')::interval as created_at
    from generate_series(1, 96) as n
    where n % 4 <> 0
)
insert into public.rooms (
    id,
    creator_user_id,
    status,
    vertical,
    created_at,
    timer_minutes,
    radius_meters,
    deadline_at,
    correctability_window_seconds,
    location_name,
    location_lat,
    location_lng,
    location_source,
    session_params,
    plan_id,
    verdict_committed_at,
    locked_at
)
select
    room_id,
    creator_id,
    room_status,
    'food',
    created_at,
    case n % 3 when 0 then 5 when 1 then 10 else 15 end,
    case n % 4 when 1 then 1609 when 2 then 3219 else 8047 end,
    created_at + interval '10 minutes',
    case when room_status = 'verdict_ready' then 600 else 30 end,
    case n % 4
        when 1 then 'Mission District'
        when 2 then 'Logan Square'
        else 'Downtown'
    end,
    37.7600 + (n::double precision / 10000),
    -122.4200 - (n::double precision / 10000),
    case n % 2 when 0 then 'manual' else 'gps' end,
    jsonb_build_object(
        'meal_time', case n % 3 when 0 then 'now' when 1 then 'tonight' else 'tomorrow' end,
        'group_context', scope,
        'service_shape', case n % 2 when 0 then 'dine_in' else 'takeout' end,
        'transport_mode', case n % 2 when 0 then 'walk' else 'drive' end
    ),
    plan_id,
    case when room_status in ('locked', 'expired') then created_at + interval '50 minutes' end,
    case when room_status = 'locked' then created_at + interval '60 minutes' end
from seed_plans
on conflict (id) do update
set
    status = excluded.status,
    timer_minutes = excluded.timer_minutes,
    radius_meters = excluded.radius_meters,
    deadline_at = excluded.deadline_at,
    correctability_window_seconds = excluded.correctability_window_seconds,
    location_name = excluded.location_name,
    location_lat = excluded.location_lat,
    location_lng = excluded.location_lng,
    location_source = excluded.location_source,
    session_params = excluded.session_params,
    plan_id = excluded.plan_id,
    verdict_committed_at = excluded.verdict_committed_at,
    locked_at = excluded.locked_at;

with room_members as (
    select
        n,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id,
        ('10000000-0000-4000-8000-' || lpad(((((n - 1) + participant_offset) % 48) + 1)::text, 12, '0'))::uuid as user_id,
        participant_offset,
        now() - (n || ' hours')::interval as joined_at
    from generate_series(1, 96) as n
    cross join (values (0), (7), (13), (29)) as offsets(participant_offset)
    where n % 4 <> 0
)
insert into public.members (
    room_id,
    user_id,
    role,
    joined_at,
    quiz_progress,
    display_name
)
select
    room_id,
    user_id,
    case when participant_offset = 0 then 'owner' else 'participant' end,
    joined_at + (participant_offset || ' minutes')::interval,
    jsonb_build_object(
        'last_index', case when participant_offset in (0, 7) then 4 else 2 end,
        'source', 'local_seed'
    ),
    case when participant_offset = 0 then 'Owner ' else 'Guest ' end || right(user_id::text, 4)
from room_members
on conflict (room_id, user_id) do update
set
    quiz_progress = excluded.quiz_progress,
    display_name = excluded.display_name;

with vote_rows as (
    select
        n,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id,
        ('10000000-0000-4000-8000-' || lpad(((((n - 1) + participant_offset) % 48) + 1)::text, 12, '0'))::uuid as user_id,
        participant_offset,
        case n % 4 when 1 then 'open' when 2 then 'verdict_ready' else 'expired' end as room_status
    from generate_series(1, 96) as n
    cross join (values (0), (7), (13), (29)) as offsets(participant_offset)
    where n % 4 <> 0
      and (n % 4 <> 1 or participant_offset in (0, 7))
)
insert into public.votes (room_id, user_id, q1, q2, q3, q4, q5)
select
    room_id,
    user_id,
    jsonb_build_object(
        'meta', jsonb_build_object('question_kind', 'cuisine_craving', 'prompt', 'What sounds good tonight?'),
        'answer', jsonb_build_object('cuisines', jsonb_build_array(case (n + participant_offset) % 4 when 0 then 'mexican' when 1 then 'thai' when 2 then 'italian' else 'japanese' end))
    ),
    jsonb_build_object(
        'meta', jsonb_build_object('question_kind', 'budget_cap', 'prompt', 'What is the spend cap?'),
        'answer', jsonb_build_object('tier', 2 + ((n + participant_offset) % 3))
    ),
    jsonb_build_object(
        'meta', jsonb_build_object('question_kind', 'reputation', 'prompt', 'What kind of reputation fits?'),
        'answer', jsonb_build_object('reputation', case (n + participant_offset) % 4 when 0 then 'popular' when 1 then 'hidden_gem' when 2 then 'classic' else 'no_preference' end)
    ),
    jsonb_build_object(
        'meta', jsonb_build_object('question_kind', 'vibe', 'prompt', 'Choose the energy.'),
        'answer', jsonb_build_object('level', ((n + participant_offset) % 5))
    ),
    jsonb_build_object(
        'meta', jsonb_build_object('question_kind', 'regret', 'prompt', 'How excited does each of these make you?'),
        'answer', jsonb_build_object(
            'ratings', jsonb_build_array(
                jsonb_build_object('droppedAxis', 'cuisine', 'score', 5 - ((n + participant_offset) % 2)),
                jsonb_build_object('droppedAxis', 'crowd_approval', 'score', 3 + ((n + participant_offset) % 3)),
                jsonb_build_object('droppedAxis', 'vibe', 'score', 2 + ((n + participant_offset) % 4))
            )
        )
    )
from vote_rows
on conflict (room_id, user_id) do nothing;

with option_rows as (
    select
        n,
        rank,
        ('40000000-0000-4000-8000-' || lpad(((n * 10) + rank)::text, 12, '0'))::uuid as option_id,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id
    from generate_series(1, 96) as n
    cross join generate_series(1, 4) as rank
    where n % 4 in (2, 3)
)
insert into public.options (id, room_id, place_provider, google_place_id, created_at)
select
    option_id,
    room_id,
    'google',
    'local-google-place-' || lpad(n::text, 3, '0') || '-' || rank,
    now() - (n || ' hours')::interval
from option_rows
on conflict (room_id, place_provider, google_place_id) do nothing;

with verdict_rows as (
    select
        n,
        ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as verdict_id,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id,
        ('40000000-0000-4000-8000-' || lpad(((n * 10) + 1)::text, 12, '0'))::uuid as winning_option_id,
        now() - (n || ' hours')::interval as computed_at
    from generate_series(1, 96) as n
    where n % 4 in (2, 3)
)
insert into public.verdicts (
    id,
    room_id,
    option_id,
    computed_at,
    method,
    rule_text,
    winner_place_provider,
    winner_google_place_id,
    final_fit_score,
    scoring_version,
    receipts
)
select
    verdict_id,
    room_id,
    winning_option_id,
    computed_at,
    case n % 4 when 2 then 'quorum' else 'deadline' end,
    'Local synthetic winner from complete seeded votes.',
    'google',
    'local-google-place-' || lpad(n::text, 3, '0') || '-1',
    4.15 + ((n % 10)::numeric / 100),
    'local_seed_v1',
    jsonb_build_array(
        jsonb_build_object('label', 'Shared craving', 'detail', 'Seeded members converged on compatible cuisines.'),
        jsonb_build_object('label', 'Budget fit', 'detail', 'Winner stayed under the seeded spend cap.')
    )
from verdict_rows
on conflict (room_id) do update
set
    option_id = excluded.option_id,
    method = excluded.method,
    rule_text = excluded.rule_text,
    winner_place_provider = excluded.winner_place_provider,
    winner_google_place_id = excluded.winner_google_place_id,
    final_fit_score = excluded.final_fit_score,
    scoring_version = excluded.scoring_version,
    receipts = excluded.receipts;

with slate_rows as (
    select
        n,
        rank,
        ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as verdict_id,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id
    from generate_series(1, 96) as n
    cross join generate_series(1, 4) as rank
    where n % 4 in (2, 3)
)
insert into public.verdict_slate_entries (
    verdict_id,
    room_id,
    slate_rank,
    place_provider,
    google_place_id,
    final_fit_score,
    scoring_version,
    receipts
)
select
    verdict_id,
    room_id,
    rank,
    'google',
    'local-google-place-' || lpad(n::text, 3, '0') || '-' || rank,
    4.25 - (rank::numeric / 10),
    'local_seed_v1',
    jsonb_build_array(
        jsonb_build_object('label', 'Seeded slate rank', 'detail', 'Synthetic option ' || rank || ' for local QA.')
    )
from slate_rows
on conflict (verdict_id, slate_rank) do update
set
    google_place_id = excluded.google_place_id,
    final_fit_score = excluded.final_fit_score,
    scoring_version = excluded.scoring_version,
    receipts = excluded.receipts;

with reroll_rows as (
    select
        n,
        burn,
        ('60000000-0000-4000-8000-' || lpad(((n * 10) + burn)::text, 12, '0'))::uuid as reroll_id,
        ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as room_id,
        ('10000000-0000-4000-8000-' || lpad((((n - 1) % 48) + 1)::text, 12, '0'))::uuid as user_id
    from generate_series(1, 96) as n
    cross join generate_series(1, 2) as burn
    where n % 8 = 2
)
insert into public.rerolls (id, room_id, user_id, reason, detail, created_at)
select
    reroll_id,
    room_id,
    user_id,
    case burn when 1 then 'cost' else 'mood' end,
    case burn when 1 then 'Local seed cost reroll' else 'Local seed mood reroll' end,
    now() - (n || ' hours')::interval + (burn || ' minutes')::interval
from reroll_rows
on conflict (id) do update
set
    reason = excluded.reason,
    detail = excluded.detail;
