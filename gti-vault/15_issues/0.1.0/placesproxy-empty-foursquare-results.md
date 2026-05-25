---
note: placesproxy-empty-foursquare-results
status: done
created: 2026-05-16
related:
  - "[[issues/tb-14-restore-placesproxy-foursquare-path]]"
  - "[[issues/tb-17-edge-function-cuisine-tag]]"
---

> **RESOLVED 2026-05-17.** Root cause was not a bad key or a version pin — see [[#Resolution (2026-05-17)]] at the bottom. The diagnosis section below is preserved as the original hypothesis record; it was partly wrong.

# Follow-up — places-proxy deployed but Foursquare returns zero rows

Surfaced 2026-05-16 by the [[issues/tb-14-restore-placesproxy-foursquare-path|tb-14]] post-merge CI run. tb-14 closed the deploy gap; this note captures a fault tb-14's "deploy + secrets" scope cannot itself resolve.

## What tb-14 fixed

The `places-proxy` Edge Function was never deployed. tb-14 added the `edge-deploy` CI lane (`supabase functions deploy` + `supabase secrets set FOURSQUARE_API_KEY`). On the post-merge run the deploy steps **succeeded** and a live invocation returned **HTTP 200** — not `404` (undeployed) and not `places_proxy_misconfigured` (secrets unset). The function is live and configured.

## The remaining fault

The live integration test (`supabase/functions/places-proxy/live-integration.test.ts`) invoked the deployed function with a known dense-urban coordinate (Times Square, NYC, 1km radius) and got back a **200 with an empty `places` array** and `is_thin: true`.

A dense-urban coordinate must return many restaurants from a healthy Foursquare path. An empty result means one of:

1. **The `FOURSQUARE_API_KEY` is invalid or expired.** tb-14's premise was explicitly "the key is known-good (one historical call logged during 0.1.0 development)." That historical call was during 0.1.0 dev; the key may have lapsed, been scoped wrong, or been a different key than what is in the `FOURSQUARE_API_KEY` GitHub secret. The handler returns an empty 200 with **no `error` field** on a Foursquare 4xx (see `_shared/places-proxy-core.ts` — only a 410 or an unexpected exception sets `error`), so a 401/403 from Foursquare is indistinguishable from a genuine zero-result query in the response envelope.
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

## Resolution (2026-05-17)

Diagnosed directly against the live Foursquare API. The hypothesis above was wrong on the specifics — the key was valid and the version pin was current. **Two independent faults**, both swallowed by the handler's silent-4xx path:

1. **No API credits.** The proxy's `fields` list requests six *premium* fields (`price`, `hours`, `photos`, `tastes`, `rating`, `stats`). Any call requesting a premium field is a billable "Premium call", and the Foursquare account had **zero credits** — so every live call returned **HTTP 429** ("no API credits remaining"). Free-field-only calls returned 200; that is why one historical 0.1.0-dev call had succeeded. Not a bad key — a billing state. **Resolved:** the operator added credits / enabled billing on the Foursquare account on 2026-05-17; premium fields now flow (verified — a deployed-function call returns 50 venues with `price`/`rating` populated).

2. **Wrong category ids.** `CUISINE_CATEGORY_MAP` and `DIETARY_CHIP_MAP` used legacy short numeric ids (`13303` etc.). The post-2025 surface rejects those with **HTTP 400** — so every per-cuisine and every dietary-category call returned empty, even after credits were restored. **Resolved:** PR [#101](https://github.com/samfarls55/gettoit/pull/101) replaced all 12 ids with live-probed 24-char hex ids, renamed `FoursquareCategory.id` → `fsq_category_id`, and **hardened the handler to surface a `foursquare_upstream_<status>` error** instead of the silent empty 200 that hid both faults. See [[issues/tb-17-edge-function-cuisine-tag|tb-17]] (cuisine scoping) and ADR 0002 (corrected).

End state: the deployed `places-proxy` returns Foursquare-sourced venues for general, per-cuisine, and dietary calls — verified 2026-05-17 against the live deployment (`cuisine=mexican` → 50 Mexican venues; `dietary=halal` → 50 halal venues).

**Remaining open thread:** Tier 2 of the live integration test is still diagnostic-only. Promoting it to a hard CI assert (original next-step #4) is worth doing now that data flows — left as a small follow-up, not tracked as a blocker.
