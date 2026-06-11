---
status: done
type: HITL
github_issue: 347
---

# TB-03: Google Console And Supabase Secret Readiness

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Prepare and verify the human-owned Google Places setup needed for the provider migration: enabled Google Places API access, the Enterprise + Atmosphere field tier needed by ADR 0022, billing/quota readiness, and Supabase Edge Function secret configuration. Code should expose a narrow readiness check or deploy-time validation that fails closed when configuration is missing or invalid.

This is HITL because provider account, billing, quota, and secret custody require owner access outside the repo.

## Acceptance criteria

- [x] Google Places API access is enabled for the intended project with the field tier required by ADR 0022.
- [x] The required server-side API key or credential is configured only as a Supabase secret and is not exposed to mobile or web clients.
- [x] Environments used for v0.1.0 can distinguish configured, missing, and invalid Google credentials without leaking the secret.
- [x] Quota/cost guardrail settings needed by the Edge Function are documented or configured in the app-owned environment.
- [x] Provider readiness failure returns a fail-closed app error and stores only policy-safe operational receipts.
- [x] No client bundle, test fixture, log, or committed file contains a real Google credential.

## Blocked by

None - can start immediately.

## Closure evidence

2026-06-11:

- Google Cloud project for v0.1.0: `DMPL` / `wide-bastion-499103-u2` / `929845574684`.
- Supabase project for v0.1.0: `gettoit-prod` / `rlnevdqebmzbxpntghzb`.
- Places API (New) service `places.googleapis.com` is enabled.
- Billing is active. Budget alerts are configured for the single-project org; Places quotas were reviewed and left at defaults.
- `generativeSummary` and `reviewSummary` were verified in Google Place Data Fields (New) docs as Enterprise + Atmosphere fields.
- Dedicated server-side Google key `gettoit-prod-supabase-places-server` was created with application restrictions `None` and API restriction `Places API / places.googleapis.com`.
- Supabase prod secret `GOOGLE_PLACES_API_KEY` exists by name/digest in `supabase secrets list --project-ref rlnevdqebmzbxpntghzb`.
- Repo exposure scans found no real Google credential, no `NEXT_PUBLIC_*GOOGLE`, and no `EXPO_PUBLIC_*GOOGLE` usage.
- Added and deployed `google-places-readiness` Edge Function. It performs a server-side Places API (New) readiness call with fixed field mask `id`, returns only readiness metadata, and never returns Google response bodies, Place IDs, or secret material.
- Live prod readiness response returned HTTP 200 with `provider: "google_places"`, `readiness: "configured"`, `field_mask: "google_places_readiness_v1"`, and no key-like material.
- Tests added for missing credential, invalid credential, configured credential, provider-unavailable failure, method/auth gating, deploy-lane wiring, and live readiness.

Verification:

- `npx -y deno@2 test --allow-net --allow-env --allow-read supabase/functions/google-places-readiness/index.test.ts supabase/functions/google-places-readiness/deploy-lane.test.ts` passed.
- `npx -y deno@2 test --allow-net --allow-env --allow-read supabase/functions/google-places-readiness/live-integration.test.ts` passed with local Supabase env exported.
- `npx -y deno@2 fmt --check supabase/functions/google-places-readiness/handler.ts supabase/functions/google-places-readiness/index.ts supabase/functions/google-places-readiness/index.test.ts supabase/functions/google-places-readiness/live-integration.test.ts supabase/functions/google-places-readiness/deploy-lane.test.ts` passed.
- Full Edge suite via `npx -y deno@2 test --allow-net --allow-env --allow-read supabase/functions` did not fully pass because two pre-existing APNS stub integration tests failed in `supabase/functions/apns-sender/stub-apns.test.ts`; all Google readiness tests passed.
