---
status: done
type: HITL
github_issue: 358
---

# TB-01: Voyage Secret And Embedding Env Readiness

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Prepare the production-only embedding configuration gate before AFK agents wire embeddings into scoring. Add the server-only Voyage API key and embedding-related environment variables/secrets in the configured Supabase/runtime location, document the exact names available to backend code, and verify that the kill switch can keep embeddings disabled until the implementation and privacy checks are ready.

This slice does not implement embeddings or call Voyage from product code. It creates the human-owned setup surface the following AFK slices can safely depend on.

## Acceptance criteria

- [x] `VOYAGE_API_KEY` is available as a server-only Supabase/runtime secret and is not exposed to web or mobile clients.
- [x] The embedding feature flag/kill switch name and disabled-by-default value are defined for backend code.
- [x] Any local developer env placeholder or secret documentation uses placeholder values only.
- [x] A human can confirm the Voyage account/key is intended for this app and the v0.1.0 production-only lane.
- [x] No product code sends restaurant text to Voyage in this slice.
- [x] Verification records that the secret is present where backend code will read it, without printing the secret value.

## Blocked by

None - can start immediately

## Comments

- 2026-06-11 - Closed HITL setup. Human added the Voyage API key locally after confirming it is intended for GetToIt v0.1.0 production-only backend use. `VOYAGE_API_KEY` and `VIBE_EMBEDDINGS_ENABLED=false` were set as Supabase Edge Function runtime secrets and verified by name via `supabase secrets list --project-ref ... -o json`; no secret value was printed. The same names were mirrored into GitHub Actions secrets for future deploy/smoke gates and verified by name via `gh secret list`. Repo placeholders/runbooks document names only. No product code was changed and no restaurant text is sent to Voyage in this slice.
