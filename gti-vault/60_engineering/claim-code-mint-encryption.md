---
title: Claim-code refresh-token encryption — application-layer AES-GCM
created: 2026-05-21
issue: tb-WF-13
---

# Claim-code refresh-token encryption

tb-WF-13 implementation note. Records why the `claim_codes` table stores
the web anonymous session's refresh token encrypted with
**application-layer AES-GCM in the Edge Function**, rather than a
Postgres `pgcrypto` column default.

## Context

[[adr/0015-web-invitee-account-claim-bridge|ADR 0015]] decided the
web-invitee account-claim bridge: a single-use claim code carries the
browser anonymous session into a freshly-installed iOS app. There is no
Supabase server primitive to mint a session for an arbitrary anonymous
user, so the code must carry the session key itself — the row holds the
session's **refresh token**. ADR 0015 §Consequences specified the token
is stored "encrypted at rest, single-use, short-TTL."

The open implementation question: *where* the encryption happens.

## Decision

**Encrypt in the Edge Function, application-layer, with AES-GCM.** The
shared helper `supabase/functions/_shared/claim-code.ts` exposes
`encryptToken` / `decryptToken`; `mint-claim-code` encrypts before the
INSERT and `redeem-claim-code` (tb-WF-14) decrypts after the lookup. The
ciphertext format is `<iv-b64>:<ciphertext+tag-b64>` — a 12-byte random
IV per call plus the 16-byte GCM auth tag WebCrypto appends. The key is
a base64-encoded 32-byte runtime secret, `CLAIM_CODE_ENC_KEY`, set via
`supabase secrets set` (and the CI edge-deploy lane).

## Why not pgcrypto

A `pgcrypto` column-level encryption (`pgp_sym_encrypt` with a key
passed in the SQL, or a key in a GUC) was the obvious alternative.
Rejected because:

1. **The key would have to reach the database.** Either embedded in
   every INSERT/SELECT statement the Edge Function issues (the key then
   lives in query logs and in the function source) or set as a database
   GUC. The GUC route is exactly the trap bug-09 hit — setting an
   `app.*` GUC needs a Postgres superuser, which the Supabase `postgres`
   role is not (see [[verdict-dispatch-guc-superuser-blocker]]). An
   `app_config`-table key would put the plaintext key one RLS slip away
   from exposure.
2. **Application-layer keeps the key in one place.** As an Edge Function
   runtime secret the key never lives in the database at all — a
   database read, even by a superuser, never yields a usable token. The
   key and the ciphertext are stored in two different systems.
3. **The same helper serves both halves.** `mint-claim-code` and
   `redeem-claim-code` (tb-WF-14) share `_shared/claim-code.ts`, so the
   encrypt and decrypt sides cannot drift — they are literally the same
   code. A `pgcrypto` split would put encrypt in one SQL function and
   decrypt in another.

AES-GCM (authenticated encryption) over a plain cipher: a tampered
ciphertext or a wrong key both surface as a thrown `decrypt`, so the
redeem side fails closed — it can never hand the app a garbage "token."

## Stakes are low either way

ADR 0015 already established the protected asset is small: one anonymous
web invitee's vote in one dinner Plan, behind a single-use code with a
~30-minute TTL. The encryption is defense-in-depth, not the primary
control — the primary control is the RLS lock (the `claim_codes` table
has RLS on, zero policies, and `anon`/`authenticated` grants revoked, so
only the service-role Edge Functions reach it at all). The
application-layer choice simply ensures that even a direct row read
never yields a live session key.

## Operational note

The live `mint-claim-code` function returns
`mint_claim_code_misconfigured` (HTTP 500) until the `CLAIM_CODE_ENC_KEY`
repo secret exists. Generate one with:

```
openssl rand -base64 32
```

and add it as a GitHub Actions repo secret. The CI edge-deploy lane
pushes it to the Supabase function runtime when present and emits a
warning (does not fail the lane) when absent — unlike `FOURSQUARE_API_KEY`
it is a brand-new secret, so failing the lane would block unrelated
merges.

## Cross-references

- [[adr/0015-web-invitee-account-claim-bridge|ADR 0015]] — the bridge
  architecture; §Consequences specified "encrypted at rest."
- [[verdict-dispatch-guc-superuser-blocker]] — the bug-09 GUC-superuser
  trap that argues against a database-held key.
- [[../15_issues/workflow-overhaul/issues/tb-wf-13-claim-code-mint|tb-WF-13]]
  — the issue this note records.
