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
    v_plan            public.plans%rowtype;
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
        select 1
        from public.members
        where room_id = p_room_id
          and user_id = v_caller
    ) into v_is_member;

    if not v_is_member then
        return jsonb_build_object('error', 'not_a_member');
    end if;

    if v_room.plan_id is not null then
        select * into v_plan from public.plans where id = v_room.plan_id;
        if found and (
            v_plan.status = 'decided-expired'
            or (
                v_plan.status = 'decided-active'
                and v_plan.reroll_window_closes_at is not null
                and v_plan.reroll_window_closes_at <= now()
            )
        ) then
            return jsonb_build_object('error', 'window_closed');
        end if;
    end if;

    select count(*)::int into v_count
    from public.rerolls
    where room_id = p_room_id;

    if v_count >= 3 then
        return jsonb_build_object('error', 'cap_exhausted', 'count', v_count, 'cap', 3);
    end if;

    if p_reason = 'diet' and (p_diet_chip is null or length(p_diet_chip) = 0) then
        return jsonb_build_object('error', 'diet_chip_required');
    end if;
    if p_reason = 'mood' and (p_new_vibe is null or p_new_vibe < 0 or p_new_vibe > 4) then
        return jsonb_build_object('error', 'new_vibe_required');
    end if;

    select * into v_current_verdict
    from public.verdicts
    where room_id = p_room_id;

    insert into public.rerolls (room_id, user_id, reason, detail)
    values (p_room_id, v_caller, p_reason, p_detail)
    returning id into v_reroll_id;

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
        perform public.votes_patch_answer(
            p_room_id,
            v_caller,
            'vibe',
            jsonb_build_object('level', p_new_vibe)
        );

    elsif p_reason = 'diet' then
        v_diet_slot := public.votes_slot_of_kind(p_room_id, v_caller, 'dietary_veto');
        if v_diet_slot is not null then
            v_diet_extra := coalesce(v_diet_slot #> '{answer,vetoes_extra}', '[]'::jsonb)
                            || to_jsonb(p_diet_chip);
            perform public.votes_patch_answer(
                p_room_id,
                v_caller,
                'dietary_veto',
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
        'status', 'rerolled',
        'reroll_id', v_reroll_id,
        'reason', p_reason,
        'count', v_count + 1,
        'remaining', greatest(0, 3 - (v_count + 1)),
        'last_reroll_reason', p_reason
    );
end;
$$;

comment on function public.apply_reroll(uuid, text, text, text, int) is
    'TB-10 reroll RPC repaired after sg-WF-6: keeps the reroll-window guard and uses generic jsonb votes helpers instead of retired typed vote columns.';

revoke all on function public.apply_reroll(uuid, text, text, text, int) from public;
grant execute on function public.apply_reroll(uuid, text, text, text, int) to authenticated;
