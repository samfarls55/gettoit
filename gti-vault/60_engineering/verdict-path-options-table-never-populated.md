---
folder: 60_engineering
purpose: 2026-05-18 diagnosis — why the post-Q5 verdict never resolves ("Lining Up the Verdict" spins forever)
---

# Verdict path broken — `options` table never populated (2026-05-18)

Diagnosis of a TestFlight report: the build clears Q5 but hangs forever on the
S05-pre "LINING UP THE VERDICT" resolving spinner. Investigated against the live
Supabase project (`rlnevdqebmzbxpntghzb`).

**Verdict: the verdict path has never produced a row. Three compounding
defects, two of them load-bearing.**

> **Triaged 2026-05-18** into three issues — [[../15_issues/v1.1/issues/bug-08-verdict-pipeline-integration-unwired|bug-08]] (Defect A, GitHub #116), [[../15_issues/v1.1/issues/bug-09-verdict-fire-dispatch-guc-noop|bug-09]] (Defect B, #117), [[../15_issues/v1.1/issues/bug-10-verdict-poll-no-timeout|bug-10]] (Defect C, #118). This doc is the diagnosis record; the issues carry the fix.

## Symptom

Solo session. Q5 submit succeeds → `PostQuizHost` enters `.resolving` →
`VerdictPoller` polls the `verdicts` table for the room → no row ever lands →
spinner never leaves `.resolving`. No error surfaces.

## Live evidence

Queried via the Supabase Management API (`/database/query`).

- **`options` table is empty system-wide** — `0` rows across **2587** rooms.
  `0` rows in `verdicts`, ever. The verdict path has never completed once.
- The user's test room `f8087f7c-5aed-4abc-8ae0-483541617099`: `1` member,
  `1` votes row (q5 slot carries `meta.question_kind = 'regret'` correctly),
  `count_q5_complete_members = 1`, room **stuck in `status = 'firing'`**,
  `0` verdict rows, `0` option rows.
- Trigger `votes_maybe_fire_verdict` is installed + enabled; it fired
  correctly (the room flipped `open → firing`).
- Database GUCs `app.supabase_url` / `app.service_role_key` are **unset**
  (`current_setting(...) = null`).
- `compute-verdict` Edge Function is deployed + `ACTIVE` (v21). Invoked
  directly against the stuck room it returns `{"error":"no_candidates"}`,
  HTTP 404.

## Defect A — verdict candidate-pool + scoring integration never wired (root cause)

The `compute-verdict` engine ranks a **candidate pool** read from the `options`
table (`fetchOptions` → `.from("options")`). With zero rows it returns
`no_candidates` (404) — confirmed by direct invoke.

This is not just "the `options` table has no writer." The whole integration
that was supposed to assemble, score, and persist the candidate pool — PRD
modules A / E / G — was never wired into a live session:

- **`RunningUnionPoolManager` (tb-10) and `PreferenceFunction` (tb-09) have
  zero live callers.** Both ship as pure, unit-tested modules; grep-confirmed
  they are referenced only by their own tests. tb-10's own note punted the
  wiring to tb-11 / tb-13; both closed without it.
- **`options` has no writer anywhere** — iOS, Edge Function, SQL, migration.
  `20260513183000_places_and_options.sql` names the intended writer as an
  *"Edge Function on room create"* — never built.
- **The live quiz fetches the pool, then discards it.** `QuizCandidateFetch`
  fetches the per-member venue union, classifies it, runs the factorial to
  pick three Q5 cards — and drops the union as a local variable.

Crucially, **candidates ≠ the 3 Q5 cards.** By design the candidate pool is
the running union of every member's full Foursquare fetch (dozens of venues);
the 3 Q5 cards are a deliberately-imperfect *preference probe* used only to
elicit each member's `prefFn`. The engine reads per-member `scores` from the
`votes.q5.answer.scores` slot — which carries only the 3 raw card ratings, not
a `prefFn`-scored map over the full pool. So the engine is starved on **both**
inputs: empty `options`, and a 3-entry score map for a probe, not a pool.

Net: even a perfectly-wired fire path cannot produce a meaningful verdict.
**This is the load-bearing bug.** Full breakdown + the fix fork in
[[../15_issues/v1.1/issues/bug-08-verdict-pipeline-integration-unwired|bug-08]].

## Defect B — verdict-fire dispatch silently no-ops

The `votes` AFTER INSERT trigger flips the room to `firing` and calls
`dispatch_compute_verdict()`, which POSTs to the Edge Function via `pg_net`.
That function reads two **database GUCs** — `app.supabase_url` and
`app.service_role_key` — and, when either is empty, `return`s silently
(by design, so the trigger never fails the votes INSERT).

Those GUCs are unset on the live project. Nothing in the repo sets them — no
migration, no CI step. (The CI `edge-deploy` lane sets the Edge Function
*runtime* env; the Postgres-level `app.*` GUCs are a separate thing set via
`ALTER DATABASE … SET`.) So the engine is **never auto-invoked**.

v1 masked this: the iOS client used to invoke `compute-verdict` directly
(`client.functions.invoke`) as the live fire path — see `VerdictStore`
header + [[waiting-fire-trigger]] §"Two fire paths". The tb-19 post-Q5
router (`PostQuizHost` / `VerdictPoller`) is **poll-only** — it reads
`verdicts`, never invokes the engine. tb-19 removed the one fire path that
worked in a GUC-unset environment.

Side effect: a fired room is left wedged in `firing` permanently — no
verdict, and `fire_verdict` returns `already_firing` because status ≠ `open`.

## Defect C — resolving poll has no timeout

`VerdictPoller.run()` is `while true`; it leaves `.resolving` only on a
verdict row or a thrown fetch error. Any silent server-side failure (Defect A
or B — `pg_net` POSTs are fire-and-forget, a 404/500 is swallowed) therefore
manifests as an **eternal spinner**, never the `.failed` retry surface. The
resolving copy literally promises *"no spinners forever"* — the code cannot
honor that. Real bug independent of A/B.

## Failure chain

Q5 submit → votes row ✓ → trigger fires, room `open→firing` ✓ →
`dispatch_compute_verdict` hits null-GUC branch, no-ops **(B)** → engine never
called → even if called, `options` empty → `no_candidates` 404 **(A)** → no
`verdicts` row → iOS polls forever, no error **(C)** → spinner forever.

Fixing B alone does **not** fix the bug — A still blocks. Both A and B must
land for a verdict to resolve; C is a robustness/UX fix.

## Fix directions

**Defect A** ([[../15_issues/v1.1/issues/bug-08-verdict-pipeline-integration-unwired|bug-08]]) —
wire the union-pool + preference-scoring integration. Carries an unresolved
architecture fork: run the union + scoring **iOS-side** (wire the existing
Swift `RunningUnionPoolManager`, persist pool + scores to the DB) or
**server-side** (port modules A/E/G to TS in the `compute-verdict` path). A
human decision, then decomposition via `/to-issues` — see bug-08.

> Rejected shortcut: persisting only the 3 `votes.q5.scores` venues into
> `options`. The 3 cards are engineered to be imperfect; a verdict over them
> is the degenerate outcome the running-union design exists to prevent.

**Defect B** ([[../15_issues/v1.1/issues/bug-09-verdict-fire-dispatch-guc-noop|bug-09]]) —
set the GUCs on the live project (`ALTER DATABASE … SET app.supabase_url /
app.service_role_key`); the service-role key must NOT go in a committed
migration — set it in the dashboard or via a CI step from a secret, durably.

**Defect C** ([[../15_issues/v1.1/issues/bug-10-verdict-poll-no-timeout|bug-10]]) —
bound `VerdictPoller`; route to `.failed` on exhaustion.

The stuck room `f8087f7c…` cannot be salvaged (no candidates ever existed for
it); it stays wedged in `firing`.

## Related

- [[../15_issues/v1.1/issues/bug-08-verdict-pipeline-integration-unwired|bug-08]] /
  [[../15_issues/v1.1/issues/bug-09-verdict-fire-dispatch-guc-noop|bug-09]] /
  [[../15_issues/v1.1/issues/bug-10-verdict-poll-no-timeout|bug-10]] — the triaged fixes
- [[verdict-engine]] — engine architecture + idempotency contract
- [[waiting-fire-trigger]] — the two fire paths + GUC no-op note
- `supabase/migrations/20260513183000_places_and_options.sql` — `options`
  table + the never-built "Edge Function on room create" writer
- `supabase/migrations/20260515020000000_verdict_fire_on_q5_complete.sql` —
  tb-13 Q5-complete trigger + `dispatch_compute_verdict`
- `ios/Sources/App/PostQuizHost.swift` / `VerdictPoller.swift` — tb-19
  poll-only post-Q5 router
