---
status: ready-for-human
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

- [ ] Google Places API access is enabled for the intended project with the field tier required by ADR 0022.
- [ ] The required server-side API key or credential is configured only as a Supabase secret and is not exposed to mobile or web clients.
- [ ] Environments used for v0.1.0 can distinguish configured, missing, and invalid Google credentials without leaking the secret.
- [ ] Quota/cost guardrail settings needed by the Edge Function are documented or configured in the app-owned environment.
- [ ] Provider readiness failure returns a fail-closed app error and stores only policy-safe operational receipts.
- [ ] No client bundle, test fixture, log, or committed file contains a real Google credential.

## Blocked by

None - can start immediately.
