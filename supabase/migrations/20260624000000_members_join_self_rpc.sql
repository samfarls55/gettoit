-- Web membership join RPC.
--
-- Browser clients should not send authorization fields such as
-- members.user_id or members.role. This RPC pins user_id to auth.uid()
-- and always creates a participant membership.

create or replace function public.members_join_self(
    p_room_id uuid,
    p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller uuid := (select auth.uid());
    v_display_name text := nullif(btrim(p_display_name), '');
begin
    if v_caller is null then
        raise exception 'members_join_self requires an authenticated user'
            using errcode = '42501';
    end if;

    insert into public.members (room_id, user_id, role, display_name)
    values (p_room_id, v_caller, 'participant', v_display_name)
    on conflict (room_id, user_id) do nothing;
end;
$$;

comment on function public.members_join_self(uuid, text) is
    'Join the authenticated caller to a room as a participant. Pins '
    'members.user_id to auth.uid() and keeps role server-owned so browser '
    'clients cannot forge authorization columns.';

revoke all on function public.members_join_self(uuid, text) from public;
grant execute on function public.members_join_self(uuid, text) to authenticated;

create or replace function public.votes_submit_self(
    p_room_id uuid,
    p_q1 jsonb default null,
    p_q2 jsonb default null,
    p_q3 jsonb default null,
    p_q4 jsonb default null,
    p_q5 jsonb default null
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
        raise exception 'votes_submit_self requires an authenticated user'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.members
        where room_id = p_room_id
          and user_id = v_caller
    ) then
        raise exception 'votes_submit_self requires room membership'
            using errcode = '42501';
    end if;

    insert into public.votes (room_id, user_id, q1, q2, q3, q4, q5)
    values (p_room_id, v_caller, p_q1, p_q2, p_q3, p_q4, p_q5)
    on conflict (room_id, user_id) do nothing;
end;
$$;

comment on function public.votes_submit_self(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) is
    'Submit the authenticated caller''s vote for a room. Re-checks room '
    'membership and pins votes.user_id to auth.uid() so browser clients '
    'cannot forge the voter column.';

revoke all on function public.votes_submit_self(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.votes_submit_self(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.events_insert_self(
    p_event_type text,
    p_room_id uuid default null,
    p_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller uuid := (select auth.uid());
    v_properties jsonb := coalesce(p_properties, '{}'::jsonb);
begin
    if v_caller is null then
        raise exception 'events_insert_self requires an authenticated user'
            using errcode = '42501';
    end if;

    if jsonb_typeof(v_properties) is distinct from 'object' then
        raise exception 'p_properties must be a jsonb object';
    end if;

    if p_room_id is not null and not exists (
        select 1
        from public.members
        where room_id = p_room_id
          and user_id = v_caller
    ) then
        raise exception 'events_insert_self requires room membership'
            using errcode = '42501';
    end if;

    insert into public.events (room_id, user_id, event_type, properties)
    values (p_room_id, v_caller, p_event_type, v_properties);
end;
$$;

comment on function public.events_insert_self(text, uuid, jsonb) is
    'Insert an authenticated telemetry event. Re-checks room membership '
    'when a room is present and pins events.user_id to auth.uid().';

revoke all on function public.events_insert_self(text, uuid, jsonb) from public;
grant execute on function public.events_insert_self(text, uuid, jsonb) to authenticated;
