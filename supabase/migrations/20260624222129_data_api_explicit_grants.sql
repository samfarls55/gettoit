-- Supabase now supports projects where public tables are not exposed to
-- PostgREST/GraphQL automatically. Keep grants explicit so fresh local and
-- hosted databases behave like the new production default.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table
    public.plans,
    public.rooms,
    public.members,
    public.votes
to authenticated;

grant select on table
    public.options,
    public.verdicts,
    public.option_cuts,
    public.verdict_slate_entries,
    public.rerolls
to authenticated;

grant all privileges on table
    public.plans,
    public.rooms,
    public.members,
    public.votes,
    public.options,
    public.verdicts,
    public.option_cuts,
    public.verdict_slate_entries,
    public.rerolls,
    public.events,
    public.check_ins,
    public.ratifications,
    public.push_tokens,
    public.user_preferences,
    public.claim_codes,
    public.app_config
to service_role;

revoke all on table public.claim_codes from anon, authenticated;
