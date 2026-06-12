---
status: done
type: AFK
github_issue: 362
---

# TB-05: Voyage Wrapper, Budgets, Kill Switch, And Degradation

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Add the thin backend Voyage embedding wrapper and runtime controls used by Vibe Fit. The wrapper owns `voyage-4-lite` request construction, auth, batching, timeout, one bounded retry for transient failures, error mapping, per-flow dedupe, and budget-aware degradation. A server-side kill switch keeps embeddings disabled unless the production checklist gate is satisfied.

Provider failure, timeout, disabled mode, or budget exhaustion must degrade affected candidates to neutral/low-confidence Vibe fit with controlled receipts rather than failing the Room.

## Acceptance criteria

- [ ] Backend code calls Voyage `voyage-4-lite` through a thin wrapper, not a generic multi-provider framework.
- [ ] `VOYAGE_API_KEY` is read only from server-side secret/runtime configuration and never exposed to clients.
- [ ] Embedding inputs are batched per active scoring flow and identical text is deduped only in memory within that flow.
- [ ] One short per-flow timeout is enforced.
- [ ] At most one bounded retry is allowed for transient `429`, `5xx`, or network-timeout failures when the retry fits budget.
- [ ] No per-candidate retry loops exist.
- [ ] Disabled embeddings skip Voyage calls and do not fall back to legacy category/type vibe heuristics.
- [ ] Provider unavailable, timeout, and budget-exhausted cases return neutral/low-confidence outputs with controlled receipts.
- [ ] Normal tests mock Voyage and use deterministic fake embeddings; live smoke is opt-in behind `VOYAGE_API_KEY` and an explicit live-smoke flag.
- [ ] Logs and thrown errors never include request text, response embeddings, vectors, or the API key.

## Blocked by

- [[tb-01-voyage-secret-and-embedding-env-readiness|TB-01: Voyage Secret And Embedding Env Readiness]] - GH [#358](https://github.com/samfarls55/gettoit/issues/358)
- [[tb-03-pure-transient-vibe-fit-signal|TB-03: Pure Transient Vibe Fit Signal]] - GH [#360](https://github.com/samfarls55/gettoit/issues/360)
