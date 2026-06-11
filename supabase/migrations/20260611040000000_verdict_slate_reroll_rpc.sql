-- TB-11 (Google provider migration) -- slate-backed reroll burn RPC.
--
-- The client/server provider path refetches a slate entry by Google
-- Place ID before calling this function. This RPC only burns the reroll
-- and advances durable app-owned winner identity after a viable
-- replacement is ready to present.

create or replace function public.apply_verdict_slate_reroll(
    p_room_id uuid,
    p_google_place_id text,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_verdict_id uuid;
    v_option_id uuid;
    v_burn_count int;
begin
    if v_user_id is null then
        return jsonb_build_object('error', 'unauthorized');
    end if;

    if p_reason not in ('cost', 'dist', 'mood', 'diet', 'avail') then
        return jsonb_build_object('error', 'invalid_reason');
    end if;

    if not exists (
        select 1
        from public.members m
        where m.room_id = p_room_id
          and m.user_id = v_user_id
    ) then
        return jsonb_build_object('error', 'not_a_member');
    end if;

    select count(*)::int
    into v_burn_count
    from public.rerolls rr
    where rr.room_id = p_room_id;

    if v_burn_count >= 3 then
        return jsonb_build_object('error', 'cap_exhausted');
    end if;

    select v.id
    into v_verdict_id
    from public.verdicts v
    where v.room_id = p_room_id
      and v.option_id is not null
    order by v.computed_at desc
    limit 1;

    if v_verdict_id is null then
        return jsonb_build_object('error', 'verdict_not_found');
    end if;

    if not exists (
        select 1
        from public.verdict_slate_entries vse
        where vse.verdict_id = v_verdict_id
          and vse.place_provider = 'google'
          and vse.google_place_id = p_google_place_id
    ) then
        return jsonb_build_object('error', 'not_in_slate');
    end if;

    select o.id
    into v_option_id
    from public.options o
    where o.room_id = p_room_id
      and o.place_provider = 'google'
      and o.google_place_id = p_google_place_id
    limit 1;

    insert into public.rerolls (room_id, user_id, reason, detail)
    values (p_room_id, v_user_id, p_reason, null);

    update public.verdicts
    set option_id = coalesce(v_option_id, option_id),
        winner_place_provider = 'google',
        winner_google_place_id = p_google_place_id,
        reroll_reason = p_reason
    where id = v_verdict_id;

    return jsonb_build_object(
        'ok', true,
        'google_place_id', p_google_place_id,
        'burns_used', v_burn_count + 1
    );
end;
$$;

comment on function public.apply_verdict_slate_reroll(uuid, text, text) is
    'TB-11 Google verdict slate reroll. Burns only after a viable refetched slate entry is selected; no new fetch/scoring cycle and no Google display content is stored.';

revoke all on function public.apply_verdict_slate_reroll(uuid, text, text) from public;
grant execute on function public.apply_verdict_slate_reroll(uuid, text, text) to authenticated;
