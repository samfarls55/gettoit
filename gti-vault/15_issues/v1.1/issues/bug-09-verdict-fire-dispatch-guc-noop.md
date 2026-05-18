---
issue: bug-09
title: Verdict engine is never auto-invoked — dispatch_compute_verdict silently no-ops because the app.* database GUCs are unset
status: ready-for-agent
type: AFK
github_issue: 117
created: 2026-05-18
prd: v1.1-quiz-redesign-prd
---

# bug-09 — Verdict-fire dispatch silently no-ops; the engine is never auto-invoked

## Parent

[[../_index|v1.1 backlog]] — found during the 2026-05-18 verdict diagnosis ([[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]], Defect B).

## What's broken

When all members complete Q5, the `AFTER INSERT ON votes` trigger (`votes_maybe_fire_verdict`, tb-13) correctly flips the room `open → firing` and calls `dispatch_compute_verdict()` to invoke the `compute-verdict` Edge Function. **That dispatch silently does nothing**, so the engine is never auto-invoked and no `verdicts` row is ever written. The room is left wedged in `firing` permanently.

## Root cause

`dispatch_compute_verdict` builds its HTTP POST target from two **Postgres database GUCs** — `app.supabase_url` and `app.service_role_key` — and, by design, `return`s silently when either is empty (so the trigger never fails the votes INSERT in a local-dev / CI environment that lacks `pg_net` config).

On the live project both GUCs are unset. Nothing in the repo ever sets them — no migration, no CI step. (The CI `edge-deploy` lane sets the Edge Function *runtime* env `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; those are unrelated to the Postgres-level `app.*` GUCs, which are set via `ALTER DATABASE … SET`.)

v1 masked this: the iOS client used to invoke `compute-verdict` directly via the SDK as the live fire path. The tb-19 post-Q5 router (`PostQuizHost` / `VerdictPoller`) is **poll-only** — it reads `verdicts`, never invokes the engine — so tb-19 removed the one fire path that worked in a GUC-unset environment.

## Live evidence (production project `rlnevdqebmzbxpntghzb`, 2026-05-18)

- `select current_setting('app.supabase_url', true)` → `null`; `app.service_role_key` → not set.
- Reporter's solo test room is stuck in `status='firing'` with no `verdicts` row — the trigger fired (status flipped) but the engine was never reached.
- Trigger `votes_maybe_fire_verdict` is installed and enabled; `compute-verdict` Edge Function is deployed and `ACTIVE`.

## Side effect

A room whose trigger fires but whose dispatch no-ops is wedged in `firing` forever — `fire_verdict` then returns `already_firing` because status ≠ `open`, so there is no recovery path. (Existing such rows are unrecoverable and can be left; this issue is about new sessions.)

## Fix — robust plan

The two GUCs have different secret profiles; treat them separately so the fix is durable, version-controlled, and never exposes the service-role key in a committed file.

- **`app.supabase_url` — not secret.** Set it in a **committed migration**: `ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co'`. Migrations replay on any fresh database, so this half survives a project re-provision automatically — zero human action, full version-controlled trail.
- **`app.service_role_key` — secret.** Must not be committed. Make it durable via a **step in the existing CI database-deploy job** that re-applies `ALTER DATABASE postgres SET app.service_role_key` from a **GitHub Actions secret** on every deploy. A re-provision then self-heals on the next deploy — no runbook step a human must remember.

With both in place the fix applies itself through the normal deploy pipeline on merge: the migration sets the URL GUC, the CI step sets the key GUC. No out-of-band manual production write is required (an agent may still apply both immediately via the Management API so the fix does not wait for the next deploy — optional).

**Durability decision (resolved 2026-05-18).** AC3 allows a runbook step or an automated CI step. Automated CI is chosen: a runbook relies on a human remembering to re-run `ALTER DATABASE` after a re-provision — exactly the silent-regression failure mode AC3 names. The marginal exposure of adding the service-role key as a GitHub Actions secret is bounded — the repo is private, the deploy job does not run for fork PRs, and the key already transits CI conceptually (Supabase injects it into the deployed Edge Function runtime). Self-healing durability outweighs it.

**Alternative considered and rejected:** restore an iOS-side `compute-verdict` invoke in the post-Q5 router. Rejected — it reverses the deliberate tb-13 / tb-19 decision to move verdict firing server-side, and re-introduces the client as a load-bearing part of the fire path.

## Agent Brief

**Category:** bug / ops-config
**Summary:** The verdict-fire dispatch no-ops because two Postgres `app.*` GUCs are unset on the live project. Set them and make both durable — the non-secret URL via a committed migration, the secret service-role key via a CI deploy step fed by a new GitHub Actions secret.

**Steps:**

1. **Create the GitHub Actions secret.** Add `SUPABASE_SERVICE_ROLE_KEY` as a repo Actions secret on `samfarls55/gettoit`, value sourced from `/workspace/.env` (`gh secret set`; the `.env` `GH_TOKEN` has the `repo` scope this needs). One-time setup, outside the PR. Skip if it already exists.
2. **Migration — the URL GUC.** Add a new migration under `supabase/migrations/` running `ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';`. The project ref is in `/workspace/.env` (`SUPABASE_PROJECT_REF`). No secret in this file.
3. **CI step — the key GUC.** In the existing database-deploy job in `.github/workflows/ci.yml` (the job already using `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` to push the DB), add a step — after migrations apply — that runs `ALTER DATABASE postgres SET app.service_role_key = '<key>';` against the live DB using `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`. Reuse the job's existing access path; the Management API `/database/query` endpoint is simplest (the job already has `SUPABASE_ACCESS_TOKEN`). Mask the value; never echo it. This is a step in an existing job, not a new lane.
4. **Apply immediately (optional).** Optionally set both GUCs on the live DB right away via the Management API (values from `/workspace/.env`) so the fix does not wait for the next deploy. Reversible via `ALTER DATABASE postgres RESET ...`.
5. **Verify.** Confirm `current_setting('app.supabase_url', true)` and `current_setting('app.service_role_key', true)` both return non-empty on the live project.

**Key interfaces:**
- `dispatch_compute_verdict()` — the function that reads the two GUCs and POSTs to `compute-verdict` via `pg_net`. Unchanged by this fix; it simply starts seeing non-empty GUCs.
- `.github/workflows/ci.yml` — the database-deploy job; one step added, no new job/lane.
- A new migration file under `supabase/migrations/`.

**Out of scope:**
- The empty candidate pool — [[bug-08-verdict-pipeline-integration-unwired|bug-08]] / tb-21–tb-23. A verdict still will not resolve until those land; this issue only makes the engine *reachable*.
- Recovering rooms already wedged in `firing` — unrecoverable, leave them.
- Any change to `dispatch_compute_verdict`'s logic or the iOS fire path.

**Notes / gotchas:**
- `ALTER DATABASE ... SET` applies to new connections only; `pg_net`'s background worker picks it up on its next connection, so new dispatches read it without a restart.
- Verifying AC's end-to-end criterion (an actual `verdicts` row) needs a non-empty candidate pool — only checkable once bug-08's tb-21/tb-23 merge. Not a gate for closing bug-09; cross-check then.

## Why this is AFK, not HITL

Originally triaged `ready-for-human` on the assumption that setting a GUC containing the service-role key needs a human at the dashboard. That assumption does not hold here: the service-role key and the Management API token are already in `/workspace/.env` — readable by an agent via that absolute path, even from an isolated worktree — and the `gh` token carries the `repo` scope needed to create the Actions secret. Every step above is mechanically agent-executable, and the fix lands as a normal migration + CI PR. Re-triaged `ready-for-agent` / AFK on 2026-05-18.

## Acceptance criteria

- [ ] `current_setting('app.supabase_url', true)` and `current_setting('app.service_role_key', true)` both return non-empty values on the live project.
- [ ] The `app.supabase_url` GUC is set by a committed migration; the `app.service_role_key` GUC is re-applied by a step in the CI database-deploy job from a GitHub Actions secret — both survive a project re-provision with no manual action.
- [ ] No service-role key value appears in any committed file (migration, workflow, or otherwise).
- [ ] After a quiz completes — once bug-08's candidate-pool slices land — `dispatch_compute_verdict` reaches `compute-verdict` and a `verdicts` row is written. Cross-checked when tb-21/tb-23 merge; not a gate for closing this issue.

## Blocked by

Not blocked. Necessary but not sufficient on its own: with [[bug-08-verdict-pipeline-integration-unwired|bug-08]] unfixed the engine still returns `no_candidates` even once it is reached. Both must land for the verdict to resolve.

## Related

- [[../../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]] — full diagnosis (Defect B)
- [[../../../60_engineering/waiting-fire-trigger|waiting-fire-trigger.md]] — the two fire paths + the GUC-unset no-op note
- [[tb-13-verdict-firing-q5-complete|tb-13]] — the Q5-complete trigger + `dispatch_compute_verdict`
- [[tb-19-solo-verdict-route|tb-19]] — the poll-only post-Q5 router that dropped the iOS-side invoke

## Comments

**2026-05-18 — filed.** Root cause confirmed live: both `app.*` GUCs unset; test room wedged in `firing`. Triaged `ready-for-human` — the fix is an ops action (set a production GUC containing the service-role key) plus a durability decision; not AFK-delegable.

**2026-05-18 — re-triaged HITL → AFK.** The original `ready-for-human` call assumed dashboard / secret handling needed a human. It does not: the service-role key and Management API token are in `/workspace/.env` (agent-readable via that absolute path, even from an isolated worktree), and the `gh` token has the `repo` scope to create the Actions secret. Robust plan added — `app.supabase_url` via a committed migration, `app.service_role_key` via a CI database-deploy step fed by a new `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret (confirmed not currently present). Durability decision resolved to automated CI over a runbook (rationale in "Fix — robust plan"). Agent Brief added. Re-triaged `ready-for-agent` / AFK on the vault and GitHub.
