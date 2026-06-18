---
title: Expo Dev Run Logs
date: 2026-06-18
status: active
---

# Expo Dev Run Logs

`npx expo start` in `mobile/` loads `mobile/metro.config.js`, which creates one
local JSONL log file per Expo dev server process:

```text
mobile/.dev-run-logs/<timestamp>-pid-<pid>.jsonl
```

The Metro config prints the exact path at startup:

```text
Expo dev-run log: C:\development\gettoit\mobile\.dev-run-logs\...
```

The running app posts dev-only events back to Metro at `__gti_dev_run_log`.
This is separate from `supabase/functions/.local-test-logs/`, which is only for
Edge Function tests.

Current logged Plan flow events:

- `plans.list.*` - Plan list reads, counts, and duration.
- `plan.save.*` - `plans` insert/update timing and result.
- `plan.room.read.*` - lookup for an existing Room linked to the Plan.
- `plan.room.create.*` - Room insert timing and result.
- `plan.owner_membership.upsert.*` - owner `members` upsert timing and result.
- `plan.launch.*` - full save + room + membership launch timing.

Current logged quiz/verdict events:

- `quiz.progress.*` - loaded/stored quiz progress, raw answers, mapped answers,
  and `members_progress_upsert` payloads.
- `quiz.q5.*` - Q5 answers entering the candidate fetch, the body sent to the
  `q5-card-set` Edge Function, the raw parsed function response, mapped Q5
  candidates, and an opt-in `quiz.q5.backend_trace` from the real Edge call.
- `quiz.submit.*` - final answers, Q5 ratings, Q5 candidates, and the exact
  `votes` row produced from them.
- `waiting.snapshot.*` - room/member/vote rows read while waiting for a verdict.
- `verdict.fire.*` - `fire_verdict` RPC input/output and polling snapshots.
- `verdict.rows.read` - raw verdict and slate rows read by the app.
- `verdict.display.*` - `places-proxy` request/response used to refetch the
  current Google display data for the verdict.
- `verdict.load.*` - final live/no-survivor verdict view model and rule text.

When the app can reach Metro's `__gti_dev_run_log` endpoint, the Q5 repository
adds `debug_trace: "expo_dev_run"` to the real `q5-card-set` request. The Edge
Function returns its local instrumentation inline, so the Expo JSONL log can show
the Q5 fetch plan, Google/places-proxy parameters, shaped candidate pool, axis
receipts, selected cards, and no-result reasons.

For the nested Q5 provider call, `q5-card-set` forwards that same debug marker
to `places-proxy`. The nested `places-proxy` trace is returned inside the Q5
trace and includes provider request metadata, the raw Google response body
including every returned candidate and attribute present on the response, local
candidate eligibility evaluations, and the shaped app-facing candidate list.
When this debug marker is present, `places-proxy` uses a wider Q5 Google field
mask for local inspection; normal Q5 calls keep the lean production field mask.
This is intentionally broader than production observability and is for temporary
local debugging only.

If the app requests `debug_trace: "expo_dev_run"` but the backend response does
not include a trace, the app records `quiz.q5.backend_trace.missing`. That means
the answering `q5-card-set` deployment did not return provider internals; the
Google candidate cannot be recovered from the Expo log for that completed run.

The normal verdict path is different: vote insert triggers and the
`fire_verdict` RPC ask Postgres to dispatch `compute-verdict` asynchronously via
`net.http_post`. Expo does not receive that Edge Function response, so the app
log records what the app can actually observe: submitted vote row, fire RPC,
polling, persisted verdict/slate rows, Google display refetch, and final view
model. Full `compute-verdict` internals, including Google verdict pool, scoring,
vibe-fit embedding text, embedding vectors, projections, vibe scale mapping, and
engine receipts, are available from Edge local-test logs or a direct dev
invocation that includes `debug_trace: "expo_dev_run"`.

This local logging path does not require CI. CI remains useful only for broad
regression checks.

Payloads still redact auth/session secrets and API keys. Plan flow payloads
intentionally omit raw Plan names, coordinates, labels, auth/session data, and
complete request bodies; quiz and local debug trace payloads intentionally keep
raw local answers/candidates because they are for temporary local inspection.

Disable locally with:

```powershell
$env:GTI_DEV_RUN_LOGS="0"; npx expo start
```
