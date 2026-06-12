---
title: Vibe embeddings runtime secrets
description: Server-only Supabase Edge Function secret names for the transient Vibe fit embedding path.
type: runbook
status: active
created: 2026-06-11
related:
  - "[[adr/0023-transient-vibe-embeddings-in-scoring]]"
  - "[[github-actions-secrets]]"
---

# Vibe Embeddings Runtime Secrets

ADR 0023 keeps the Vibe fit embedding path transient and server-side. The backend reads these names from the Supabase Edge Function runtime with `Deno.env.get(...)`.

| Name | Required value | Client exposure | Notes |
| --- | --- | --- | --- |
| `VOYAGE_API_KEY` | Voyage API key for this app's v0.1.0 production lane | Never | Provider credential for `voyage-4-lite`; do not log, return, or prefix with `NEXT_PUBLIC_` / `EXPO_PUBLIC_`. |
| `VIBE_EMBEDDINGS_ENABLED` | `true` while embeddings are enabled | Never | Kill switch. Set to exact string `true` to call Voyage; set to `false` to skip Voyage calls and degrade to neutral / low-confidence Vibe behavior. |

Set them in Supabase Edge Function secrets:

```powershell
supabase secrets set --project-ref $env:SUPABASE_PROJECT_REF VOYAGE_API_KEY="$env:VOYAGE_API_KEY" VIBE_EMBEDDINGS_ENABLED="true"
```

Verify by name only:

```powershell
supabase secrets list --project-ref $env:SUPABASE_PROJECT_REF
```

The verification record should mention that both names are present without printing the API key value.

Operational note, 2026-06-12: embeddings were turned on by setting `VIBE_EMBEDDINGS_ENABLED=true` in Supabase Edge Function secrets, the mirrored GitHub Actions secret, and local `.env`.
