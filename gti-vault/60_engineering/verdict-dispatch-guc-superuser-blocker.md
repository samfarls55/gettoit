---
title: Verdict-dispatch app.* GUCs cannot be set without superuser â€” bug-09 blocker
created: 2026-05-18
related: bug-09, verdict-path-options-table-never-populated, waiting-fire-trigger
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Verdict-dispatch `app.*` GUCs need a superuser â€” bug-09 cannot land as specified

## Summary

bug-09's prescribed fix â€” set `app.supabase_url` via a committed
`ALTER DATABASE postgres SET ...` migration and `app.service_role_key`
via a CI step that runs the same statement â€” **cannot work on this
Supabase project**. Setting any `app.*` placeholder GUC at the
database or role level requires a Postgres superuser. On Supabase the
`postgres` role is **not** a superuser; only `supabase_admin` is, and
`supabase_admin` is not reachable by `supabase db push`, the
Management API SQL endpoint, or any agent-held credential.

The issue was re-triaged HITL â†’ AFK on the assumption that "every step
is mechanically agent-executable." That assumption is false. The work
is genuinely HITL.

## Evidence (live project `rlnevdqebmzbxpntghzb`, 2026-05-18)

Management API `/database/query` runs SQL as `current_user = postgres`:

```
select current_user;                      -> postgres
select rolsuper from pg_roles
  where rolname = 'postgres';              -> false
select rolname, rolsuper from pg_roles
  where rolname in ('postgres','supabase_admin');
  -> supabase_admin | true
  -> postgres       | false
```

`postgres` owns the `postgres` database (`datdba -> postgres`) but
database ownership is **not** sufficient â€” Postgres 15+ requires
superuser to `ALTER DATABASE`/`ALTER ROLE ... SET` a *placeholder*
(custom-class, e.g. `app.*`) parameter. Every variant fails with the
same SQLSTATE:

```
alter database postgres set app.supabase_url     = '...'  -> 42501 permission denied
alter role     postgres set app.supabase_url     = '...'  -> 42501 permission denied
alter role     authenticator set app.foo         = '...'  -> 42501 permission denied
alter database postgres set "app.settings.test"  = 'x'    -> 42501 permission denied
```

Session-scoped `SET app.test_guc = 'x'` *does* succeed â€” but a
session `SET` does not persist and is invisible to `pg_net`'s
background worker, so it cannot fix the dispatch.

`postgres` is a member of no superuser role
(`pg_has_role(current_user, oid, 'MEMBER') and rolsuper` returns zero
rows), so there is no `SET ROLE` escalation path either.

## Why the bug-09 plan fails specifically

- **Migration half.** `supabase db push` authenticates as the
  `postgres` role (the `SUPABASE_DB_PASSWORD` is the `postgres` role
  password). A migration containing `ALTER DATABASE postgres SET
  app.supabase_url = ...` would abort with `42501` â€” which would turn
  the shared `supabase-db` CI lane **red for the whole repo**, not
  just for this PR.
- **CI-step half.** The proposed step hits the same Management API
  `/database/query` endpoint, also as `postgres`. Same `42501`.

So the prescribed fix does not just "not help" â€” committing the
migration actively breaks CI for every subsequent PR.

## The actual fix (HITL)

Supabase exposes persistent custom Postgres parameters through the
**dashboard**: Project Settings â†’ Database â†’ *Custom Postgres config*
(equivalently the Management API `PATCH
/0.1.0/projects/{ref}/config/database/postgres` `restart`-class config,
or a support-tier `ALTER` run as `supabase_admin`). The dashboard
route runs the change as the platform superuser.

A human must, once, in the dashboard, add:

```
app.supabase_url     = https://rlnevdqebmzbxpntghzb.supabase.co
app.service_role_key = <service-role key from project API settings>
```

These persist across connections and are picked up by `pg_net`'s
worker on its next connection. They do **not** survive a project
re-provision automatically â€” but neither does any dashboard config,
and there is no agent-executable migration/CI alternative on the
current Supabase permission model.

## Alternative worth re-evaluating

bug-09 rejected "restore an iOS-side `compute-verdict` invoke" because
it reverses the tb-13/tb-19 server-side decision. But the *other*
rejected-by-omission option â€” have the `votes_maybe_fire_verdict`
trigger pass the URL/key some way that does not need a persistent
superuser-set GUC â€” is worth a look:

- A `SECURITY DEFINER` function **owned by `supabase_admin`** could
  carry the config, but creating such a function still needs
  `supabase_admin` to own it â€” same blocker.
- Storing the config in an ordinary table (`app_config(key, value)`)
  that `dispatch_compute_verdict` reads with a normal `SELECT` needs
  **no** superuser â€” any role can `INSERT` into a table. The
  service-role key would then live in a row instead of a GUC; RLS +
  `REVOKE` keeps it readable only by the definer. This is fully
  agent-executable (migration creates the table, a CI step or even a
  seed `INSERT ... ON CONFLICT` populates it) and survives a
  re-provision. **This is the recommended re-scope** if bug-09 is to
  stay AFK.

## Recommendation

Re-triage bug-09. Either:

1. **HITL** â€” a human sets the two GUCs once in the Supabase
   dashboard (5-minute task), and the `dispatch_compute_verdict`
   function is left unchanged; or
2. **AFK, re-scoped** â€” change `dispatch_compute_verdict` to read its
   URL/key from an `app_config` table instead of `current_setting()`,
   which removes the superuser dependency entirely. This is a code
   change, not an ops change, and is genuinely agent-executable.

Option 2 is the more durable fix and keeps the work AFK; it does need
a `dispatch_compute_verdict` change, which bug-09's current "Out of
scope" section forbids â€” so it is a spec change either way and must go
back through triage.
