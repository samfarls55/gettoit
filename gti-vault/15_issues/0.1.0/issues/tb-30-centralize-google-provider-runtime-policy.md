---
status: ready-for-agent
type: AFK
github_issue: 370
---

# TB-30: Centralize Google Provider Runtime Policy

## What to build

Create a deep Google provider runtime module that owns the provider-facing policy used by Q5, final Verdict fetch, and Verdict display refetch. The module should own field masks, attribution handling, request redaction, retries, guardrail responses, provider receipts, and display-content retention boundaries.

The goal is not to change provider choice; ADR 0022 already chose Google. The goal is to stop each caller from carrying its own thin implementation of Google policy.

## Acceptance criteria

- [ ] Q5 provider fetch uses the centralized Google provider runtime path.
- [ ] Final Verdict provider fetch uses the centralized Google provider runtime path.
- [ ] Verdict display refetch uses the centralized Google provider runtime path.
- [ ] Field masks are versioned or otherwise traceable from one provider policy location.
- [ ] Attribution metadata is returned consistently for Q5 and Verdict display surfaces.
- [ ] Provider request/response logging redacts Google display content and user-sensitive context consistently.
- [ ] Retry and degraded-response behavior is centralized enough that callers do not implement their own Google-specific fallback policy.
- [ ] Tests cover Q5 fetch, Verdict fetch, display refetch, attribution, redaction, and degraded provider responses through the shared runtime path.

## Blocked by

None - can start immediately.
