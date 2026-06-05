---
issue: bug-09
title: Verdict engine is never auto-invoked â€” dispatch_compute_verdict silently no-ops because the app.* database GUCs are unset
status: done
type: AFK
github_issue: 117
created: 2026-05-18
prd: 0.1.0-quiz-redesign-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-09 â€” Verdict-fire dispatch silently no-ops; the engine is never auto-invoked

## Parent

[[../_index|0.1.0 backlog]] â€” found during the 2026-05-18 verdict diagnosis ([[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]], Defect B).

## What's broken

When all members complete Q5, the `AFTER INSERT ON votes` trigger (`votes_maybe_fire_verdict`, tb-13) correctly flips the room `open â†’ firing` and calls `dispatch_compute_verdict()` to invoke the `compute-verdict` Edge Function. **That dispatch silently does nothing**, so the engine is never auto-invoked and no `verdicts` row is ever written. The room is left wedged in `firing` permanently.

## Root cause

`dispatch_compute_verdict` builds its HTTP POST target from two **Postgres database GUCs** â€” `app.supabase_url` and `app.service_role_key` â€” and, by design, `return`s silently when either is empty (so the trigger never fails the votes INSERT in a local-dev / CI environment that lacks `pg_net` config).

On the live project both GUCs are unset. Nothing in the repo ever sets them â€” no migration, no CI step. (The CI `edge-deploy` lane sets the Edge Function *runtime* env `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; those are unrelated to the Postgres-level `app.*` GUCs, which are set via `ALTER DATABASE â€¦ SET`.)

0.1.0 masked this: the iOS client used to invoke `compute-verdict` directly via the SDK as the live fire path. The tb-19 post-Q5 router (`PostQuizHost` / `VerdictPoller`) is **poll-only** â€” it reads `verdicts`, never invokes the engine â€” so tb-19 removed the one fire path that worked in a GUC-unset environment.

## Live evidence (production project `rlnevdqebmzbxpntghzb`, 2026-05-18)

- `select current_setting('app.supabase_url', true)` â†’ `null`; `app.service_role_key` â†’ not set.
- Reporter's solo test room is stuck in `status='firing'` with no `verdicts` row â€” the trigger fired (status flipped) but the engine was never reached.
- Trigger `votes_maybe_fire_verdict` is installed and enabled; `compute-verdict` Edge Function is deployed and `ACTIVE`.

## Side effect

A room whose trigger fires but whose dispatch no-ops is wedged in `firing` forever â€” `fire_verdict` then returns `already_firing` because status â‰  `open`, so there is no recovery path. (Existing such rows are unrecoverable and can be left; this issue is about new sessions.)

## Fix â€” re-scoped plan (triaged 2026-05-18)

The original plan â€” set the two values as Postgres `app.*` GUCs via `ALTER DATABASE postgres SET` â€” is **abandoned**. That statement requires a Postgres superuser, and Supabase's `postgres` role (used by `supabase db push` and the Management API) is not one; committing it would have reded the shared `supabase-db` CI lane. Full evidence: [[../../../60_engineering/verdict-dispatch-guc-superuser-blocker|verdict-dispatch-guc-superuser-blocker]].

Re-scoped fix: stop using GUCs entirely. `dispatch_compute_verdict` reads its URL and key from an ordinary `app_config(key, value)` table. Writing a table row needs no special privilege, so the whole fix is a normal migration + CI PR â€” version-controlled, agent-executable, and self-healing across a project re-provision.

- **`app_config` table.** A new committed migration creates `app_config(key text primary key, value text not null)`, enables RLS with **no policies**, and `REVOKE`s all access from `anon` / `authenticated` â€” so the row holding the service-role key is unreachable over PostgREST.
- **`dispatch_compute_verdict` reads the table.** The function is changed to `SELECT value FROM app_config WHERE key = ...` instead of `current_setting('app.*')`. It keeps its silent-return-when-empty behavior so a local/CI database with no rows still no-ops cleanly. The function **must be `SECURITY DEFINER`**, owned by a role that owns `app_config`, so it bypasses the table's RLS when the `votes` trigger fires under an end-user's role â€” the one behavior dependency the GUC version did not have.
- **`supabase_url` â€” not secret.** Seeded by the same committed migration: `INSERT INTO app_config VALUES ('supabase_url', 'https://<ref>.supabase.co') ON CONFLICT (key) DO UPDATE ...`. Replays on any fresh database â€” zero human action, full version-controlled trail.
- **`service_role_key` â€” secret.** Never committed. Re-applied on every deploy by a step in the existing CI database-deploy job that `INSERT ... ON CONFLICT`s the key from the `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret. A re-provision self-heals on the next deploy.

**Durability decision (resolved 2026-05-18).** Automated CI over a runbook â€” a runbook relies on a human remembering to re-seed the key after a re-provision, exactly the silent-regression failure mode the durability AC names. The `SUPABASE_SERVICE_ROLE_KEY` Actions secret was created by the maintainer on 2026-05-18 (one-time setup, done â€” the agent does not create it). Exposure is bounded: the repo is private, the deploy job does not run for fork PRs, and the key already transits CI (Supabase injects it into the deployed Edge Function runtime).

**Alternatives considered and rejected:**
- *HITL â€” a human sets the two values once in the Supabase dashboard's Custom Postgres config, `dispatch_compute_verdict` unchanged.* Rejected at triage: dashboard config does not survive a project re-provision â€” exactly the silent-regression failure mode this issue exists to prevent.
- *Restore an iOS-side `compute-verdict` invoke in the post-Q5 router.* Rejected â€” reverses the deliberate tb-13 / tb-19 decision to move verdict firing server-side, and re-introduces the client as a load-bearing part of the fire path.

## Agent Brief

**Category:** bug / ops-config
**Summary:** The verdict-fire dispatch no-ops because `dispatch_compute_verdict` reads two unset Postgres `app.*` GUCs that cannot be set without superuser. Re-scope: replace the GUC reads with reads from a new `app_config` table, which any role can populate.

**Prerequisite (already done â€” verify, do not redo):** the `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret on `samfarls55/gettoit` was created by the maintainer on 2026-05-18. Confirm with `gh secret list`. If it is somehow missing, escalate â€” do not attempt to create it (the agent token lacks the scope).

**Steps:**

1. **Migration â€” `app_config` table.** Add a migration under `supabase/migrations/` that:
   - `CREATE TABLE app_config (key text PRIMARY KEY, value text NOT NULL);`
   - `ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;` with **no policies**, and `REVOKE ALL ON app_config FROM anon, authenticated;` â€” the service-role-key row must be unreachable over PostgREST.
   - Seed the non-secret URL: `INSERT INTO app_config (key, value) VALUES ('supabase_url', 'https://<project-ref>.supabase.co') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`. Project ref is in `/workspace/.env` (`SUPABASE_PROJECT_REF`). No secret in this file.
2. **Migration â€” rewrite `dispatch_compute_verdict`.** `CREATE OR REPLACE FUNCTION dispatch_compute_verdict()` reading both values from `app_config` (`SELECT value INTO ... FROM app_config WHERE key = 'supabase_url'` / `'service_role_key'`) instead of `current_setting('app.*')`. Preserve the silent-return-when-empty guard â€” a NULL/missing row returns, never fails the votes INSERT. Ensure the function is `SECURITY DEFINER` and owned by a role that owns `app_config`, so it bypasses the table's RLS when the `votes` trigger fires under an end-user role. Everything else â€” the `pg_net` POST, the payload â€” is unchanged.
3. **CI step â€” seed the secret key.** In the existing database-deploy job in `.github/workflows/ci.yml` (the job that already pushes the DB with `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF`), add a step *after* migrations apply that runs, against the live DB via the Management API `/database/query` endpoint, `INSERT INTO app_config (key, value) VALUES ('service_role_key', '<key>') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;` with the value from `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`. Mask the value; never echo it. A step in an existing job â€” not a new lane. (This INSERT needs no superuser â€” the whole point of the re-scope.)
4. **Apply live now.** Set both rows on the live DB immediately via the Management API (values from `/workspace/.env`: `SUPABASE_PROJECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`; auth with `SUPABASE_ACCESS_TOKEN`) so the fix does not wait for the next deploy. Plain `INSERT ... ON CONFLICT` â€” works as the non-superuser `postgres` role.
5. **Verify.** Confirm `SELECT value FROM app_config WHERE key IN ('supabase_url','service_role_key')` returns both non-empty on the live project, and that `anon` cannot read the table.

**Key interfaces:**
- `dispatch_compute_verdict()` â€” rewritten to read `app_config` instead of GUCs; `pg_net` POST logic unchanged.
- A new `app_config` table + migration under `supabase/migrations/`.
- `.github/workflows/ci.yml` â€” the database-deploy job; one step added, no new job/lane.

**Out of scope:**
- The empty candidate pool â€” [[bug-08-verdict-pipeline-integration-unwired|bug-08]] / tb-21â€“tb-23. A verdict still will not resolve until those land; this issue only makes the engine *reachable*. (tb-21 has since merged.)
- Recovering rooms already wedged in `firing` â€” unrecoverable, leave them.
- The iOS fire path â€” unchanged; firing stays server-side.

**Notes / gotchas:**
- The GUC â†’ table switch introduces an RLS dependency the GUC version did not have: if `dispatch_compute_verdict` is `SECURITY INVOKER`, the trigger runs under the voting end-user's role, which RLS blocks from reading `app_config` â†’ silent no-op again. `SECURITY DEFINER` (step 2) is load-bearing, not optional.
- `CREATE TABLE` / `CREATE OR REPLACE FUNCTION` / `ENABLE ROW LEVEL SECURITY` are all within the `postgres` role's ordinary rights â€” no superuser, unlike the abandoned `ALTER DATABASE SET`.
- Verifying the end-to-end criterion (an actual `verdicts` row) needs a non-empty candidate pool â€” only checkable once bug-08's tb-21/tb-23 land. Not a gate for closing bug-09; cross-check then.

## Why this is AFK

Re-confirmed AFK at the 2026-05-18 re-triage, after the first AFK run escalated. The escalation cause â€” `ALTER DATABASE SET app.*` needs a superuser â€” is removed entirely by the re-scope: every step is now a table write or a `CREATE`/`REPLACE` within the `postgres` role's ordinary rights, plus one CI step. The single non-agent action â€” creating the `SUPABASE_SERVICE_ROLE_KEY` Actions secret â€” was done by the maintainer at triage. The fix lands as a normal migration + CI PR.

## Acceptance criteria

- [x] An `app_config(key, value)` table exists, created by a committed migration, with RLS enabled and unreadable by `anon` / `authenticated`.
- [x] `dispatch_compute_verdict` reads `supabase_url` and `service_role_key` from `app_config` (not `current_setting('app.*')`), is `SECURITY DEFINER`, and still silently no-ops when a value is missing.
- [x] On the live project, `app_config` holds non-empty `supabase_url` and `service_role_key` rows; the URL is seeded by the committed migration, the key re-applied by a step in the CI database-deploy job from the `SUPABASE_SERVICE_ROLE_KEY` Actions secret â€” both survive a project re-provision with no manual action.
- [x] No service-role key value appears in any committed file (migration, workflow, or otherwise).
- [ ] After a quiz completes â€” once bug-08's candidate-pool slices land â€” `dispatch_compute_verdict` reaches `compute-verdict` and a `verdicts` row is written. Cross-checked when tb-21/tb-23 merge; not a gate for closing this issue. (Engine *reachability* verified live this run via a `pg_net` smoke POST that reached `compute-verdict`.)

## Blocked by

Not blocked. Necessary but not sufficient on its own: with [[bug-08-verdict-pipeline-integration-unwired|bug-08]] unfixed the engine still returns `no_candidates` even once it is reached. Both must land for the verdict to resolve.

## Related

- [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] â€” full diagnosis (Defect B)
- [[../../../60_engineering/waiting-fire-trigger|waiting-fire-trigger.md]] â€” the two fire paths + the GUC-unset no-op note
- [[tb-13-verdict-firing-q5-complete|tb-13]] â€” the Q5-complete trigger + `dispatch_compute_verdict`
- [[tb-19-solo-verdict-route|tb-19]] â€” the poll-only post-Q5 router that dropped the iOS-side invoke

## Comments

**2026-05-18 â€” filed.** Root cause confirmed live: both `app.*` GUCs unset; test room wedged in `firing`. Triaged `ready-for-human` â€” the fix is an ops action (set a production GUC containing the service-role key) plus a durability decision; not AFK-delegable.

**2026-05-18 â€” re-triaged HITL â†’ AFK.** The original `ready-for-human` call assumed dashboard / secret handling needed a human. It does not: the service-role key and Management API token are in `/workspace/.env` (agent-readable via that absolute path, even from an isolated worktree), and the `gh` token has the `repo` scope to create the Actions secret. Robust plan added â€” `app.supabase_url` via a committed migration, `app.service_role_key` via a CI database-deploy step fed by a new `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret (confirmed not currently present). Durability decision resolved to automated CI over a runbook (rationale in "Fix â€” robust plan"). Agent Brief added. Re-triaged `ready-for-agent` / AFK on the vault and GitHub.

**2026-05-18 â€” AFK run ESCALATED; re-triaged AFK â†’ needs-triage.** The AFKâ†’HITL re-triage assumed the prescribed fix is mechanically agent-executable. It is not. Setting any `app.*` placeholder GUC at the database or role level (`ALTER DATABASE postgres SET ...` / `ALTER ROLE ... SET ...`) requires a **Postgres superuser**. On this Supabase project the `postgres` role â€” which `supabase db push` and the Management API `/database/query` endpoint both authenticate as â€” is **not** a superuser; only `supabase_admin` is, and it is not reachable by any agent-held credential. Every variant of the statement returns `42501 permission denied` (verified live, 2026-05-18). Consequences:

- The prescribed **migration half cannot land** â€” committing `ALTER DATABASE postgres SET app.supabase_url = ...` would abort the shared `supabase-db` CI lane with `42501`, reding CI for the whole repo.
- The prescribed **CI-step half cannot work** â€” it runs the same statement against the same Management API endpoint as the same non-superuser `postgres` role.
- The two secondary ACs (no committed key; both halves survive a re-provision) are moot once the primary mechanism is unavailable.

Full evidence + the recommended re-scope are in [[../../../60_engineering/verdict-dispatch-guc-superuser-blocker|verdict-dispatch-guc-superuser-blocker]]. Two viable paths, both needing a triage decision: (1) **HITL** â€” a human sets the two values once in the Supabase dashboard's *Custom Postgres config*, `dispatch_compute_verdict` unchanged; (2) **AFK, re-scoped** â€” change `dispatch_compute_verdict` to read its URL/key from an ordinary `app_config` table instead of `current_setting()`, which removes the superuser dependency entirely (any role can `INSERT`/`SELECT` a table) â€” but this needs a `dispatch_compute_verdict` change, which the current "Out of scope" section forbids, so it is a spec change. No code merged on `afk/bug-09`; the run produced only the engineering diagnosis note. Re-triaged `needs-triage`.

**2026-05-18 â€” re-triaged needs-triage â†’ ready-for-agent (Option 2, re-scoped).** Maintainer chose the AFK re-scope over the HITL dashboard route. The fix abandons the `app.*` GUCs (unsettable without a superuser) and moves the URL/key into an `app_config` table that `dispatch_compute_verdict` reads â€” a plain table write, no superuser. The `dispatch_compute_verdict` change is now in scope (a deliberate spec change made at triage; the iOS fire path stays out of scope). The `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret was created by the maintainer on 2026-05-18, so the issue is cleanly agent-executable end to end. "Fix â€” re-scoped plan", Agent Brief, and acceptance criteria rewritten for the table approach. Re-triaged `ready-for-agent` / AFK on the vault and GitHub.

**2026-05-18 â€” done (AFK run, `afk/bug-09`, PR #122).** Re-scoped Option-2 fix landed. Migration `20260518010000000_app_config_verdict_dispatch.sql` creates the `app_config(key, value)` table (RLS on, no policies, `REVOKE ALL` from `anon` / `authenticated`), seeds the non-secret `supabase_url` row idempotently, and rewrites both `dispatch_compute_verdict` overloads to read `app_config` instead of the `app.*` GUCs â€” both `SECURITY DEFINER`, both keeping the silent-return-when-empty guard. CI: a step added to the existing `supabase-db` job seeds the secret `service_role_key` row from the `SUPABASE_SERVICE_ROLE_KEY` Actions secret on every deploy via the Management API `/database/query` endpoint. Applied live on `rlnevdqebmzbxpntghzb`: both rows present and non-empty; `anon` read of `app_config` over PostgREST returns `42501 permission denied`; a smoke invoke of `dispatch_compute_verdict` queued a `pg_net` POST that reached `compute-verdict` (HTTP 404 `room_not_found` for a random UUID â€” proving the engine is now *reachable*, where it previously silently no-op'd). Regression guard: `supabase/functions/compute-verdict/app-config-dispatch.test.ts` (13 deno tests, runs in the `edge` CI lane). The end-to-end `verdicts`-row criterion stays pending bug-08's tb-21/tb-23 candidate-pool slices â€” not a gate for closing this issue, per the AC. One CI fix made during the run: an early `jq @json` approach double-quoted the SQL string literal (Postgres read it as an identifier); switched the CI seed step to plain single-quote SQL escaping.
