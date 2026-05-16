---
note: placesproxy-empty-foursquare-results
status: needs-triage
created: 2026-05-16
related:
  - "[[issues/tb-14-restore-placesproxy-foursquare-path]]"
---

# Follow-up — places-proxy deployed but Foursquare returns zero rows

Surfaced 2026-05-16 by the [[issues/tb-14-restore-placesproxy-foursquare-path|tb-14]] post-merge CI run. tb-14 closed the deploy gap; this note captures a fault tb-14's "deploy + secrets" scope cannot itself resolve.

## What tb-14 fixed

The `places-proxy` Edge Function was never deployed. tb-14 added the `edge-deploy` CI lane (`supabase functions deploy` + `supabase secrets set FOURSQUARE_API_KEY`). On the post-merge run the deploy steps **succeeded** and a live invocation returned **HTTP 200** — not `404` (undeployed) and not `places_proxy_misconfigured` (secrets unset). The function is live and configured.

## The remaining fault

The live integration test (`supabase/functions/places-proxy/live-integration.test.ts`) invoked the deployed function with a known dense-urban coordinate (Times Square, NYC, 1km radius) and got back a **200 with an empty `places` array** and `is_thin: true`.

A dense-urban coordinate must return many restaurants from a healthy Foursquare path. An empty result means one of:

1. **The `FOURSQUARE_API_KEY` is invalid or expired.** tb-14's premise was explicitly "the key is known-good (one historical call logged during v1 development)." That historical call was during v1 dev; the key may have lapsed, been scoped wrong, or been a different key than what is in the `FOURSQUARE_API_KEY` GitHub secret. The handler returns an empty 200 with **no `error` field** on a Foursquare 4xx (see `_shared/places-proxy-core.ts` — only a 410 or an unexpected exception sets `error`), so a 401/403 from Foursquare is indistinguishable from a genuine zero-result query in the response envelope.
2. **A stale `X-Places-Api-Version` pin.** `_shared/foursquare.ts` pins `FOURSQUARE_API_VERSION = "2025-06-17"`. If Foursquare retired that version, the new host can answer 4xx — again swallowed into an empty 200.
3. **Query construction** — `buildFoursquareQuery` may emit a parameter the post-2025 surface rejects.

## Why this is not in tb-14 scope

tb-14 is "deploy + secrets" and the issue explicitly framed the key as known-good and the problem as deployment-only. The deploy is done and verified. Distinguishing cause (1) from (2)/(3) needs the Edge Function's **runtime logs** (`supabase functions logs places-proxy`) — the handler `console.error`s the upstream Foursquare status, but that line never reaches the HTTP response. Reading those logs needs the `SUPABASE_ACCESS_TOKEN`; an AFK worktree does not carry it.

## Current state of the guard

The live integration test is split into two tiers:

- **Tier 1 — deploy contract** (hard CI gate): asserts 200, not `places_proxy_misconfigured`, well-formed envelope. Passes — this is what tb-14 owns.
- **Tier 2 — Foursquare data quality** (diagnostic, not a gate): logs a loud warning listing the empty-result / soft-error / `mapkit:`-id problems, but does not red the `main` lane. Acceptance criterion #4 (assert a Foursquare-sourced response) is encoded here but deliberately non-blocking until this follow-up is fixed.

## Next step

Triage as a bug. Diagnosis pass:

1. Pull `supabase functions logs places-proxy` for an invocation — read the upstream Foursquare HTTP status the handler logs.
2. If 401/403 → the key is bad: regenerate at foursquare.com/developers, update the `FOURSQUARE_API_KEY` GitHub secret (and `.env`). This is the credentials problem tb-14 ruled out.
3. If 4xx with a version complaint → bump `FOURSQUARE_API_VERSION` in `_shared/foursquare.ts` and re-verify against ADR 0002's live-surface notes.
4. Once fixed, promote Tier 2 of the live test from diagnostic warnings to hard asserts so the founder check (acceptance criterion #5) is also CI-guarded.
