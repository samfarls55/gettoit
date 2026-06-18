---
title: Local Edge Test Debug Logs
date: 2026-06-18
status: active
---

# Local Edge Test Debug Logs

`npm run verify:edge` runs Supabase Edge Function tests through
`scripts/run-edge-tests.mjs`. On local machines, the runner creates one JSONL
file per run under `supabase/functions/.local-test-logs/` and sets:

- `GTI_LOCAL_TEST_LOGS=1`
- `GTI_LOCAL_TEST_RUN_ID=<timestamp>-pid-<pid>`
- `GTI_LOCAL_TEST_LOG_FILE=.local-test-logs/<run-id>.jsonl`

The logger is no-op unless `GTI_LOCAL_TEST_LOGS` is truthy. It also stays off in
CI unless set to `force`, so deployed functions and CI lanes do not produce
these files by default.

Logged areas:

- Q5 request parsing, member profile, fetch plan, places-proxy request/response
  body, raw pool, stable pool, factorial cards, shuffle, assigned cards, and
  no-results reasons.
- Verdict Google candidate fetch request body/field mask, response body, shaped
  candidates, inserted option rows, candidate pool before `computeVerdict`,
  effective votes, eligible vibe-fit candidates, vibe-fit signals, member score
  matrix, engine result, persisted verdict, cuts, and slate.
- Vibe embedding flow inputs, exact text strings sent to Voyage, provider
  response payload, per-text embeddings, projected band scores, confidence,
  receipts, and Q5 vibe keep/drop selection stages.

The logs intentionally include local debug detail such as candidate payloads,
summary text, embedding vectors, and scores. API keys, service-role keys,
authorization headers, bearer tokens, secrets, and password-like fields are
redacted or never passed to the logger.
