---
status: ready-for-agent
type: AFK
github_issue: 365
---

# TB-08: Privacy, Storage, And Observability Proof

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Prove the full Vibe embeddings implementation stays inside ADR 0022 and ADR 0023 boundaries across successful scoring, disabled mode, provider failure, timeout, budget exhaustion, Q5 selection, and final verdict persistence. Add targeted storage, logging, redaction, and metrics tests so summaries, source spans, vectors, numeric Vibe internals, and broad provider facts never become durable data or analytics payloads.

This slice is the merge-safety proof before production enablement.

## Acceptance criteria

- [ ] Tests prove Google summaries, source spans, vectors, `vibe_position`, numeric confidence, place names, provider facts, and provider-fact component scores are not persisted.
- [ ] Tests prove request text and response embeddings are not logged in success, provider failure, timeout, budget exhaustion, and disabled-mode paths.
- [ ] Tests prove `VOYAGE_API_KEY` never appears in logs, errors, receipts, or client responses.
- [ ] Observability records only aggregate provider-content-free metrics approved by the PRD.
- [ ] Metrics do not include source spans, summaries, vectors, per-place vibe positions, place names, provider facts, broad-stream Google Place IDs, or numeric confidence.
- [ ] Durable receipts carry only controlled code/status class/step/latency style data.
- [ ] Field-mask tests prove summaries are requested only through internal scoring masks when needed and omitted from display/refetch/disabled paths where possible.
- [ ] DTO tests prove Vibe Fit cannot read unrelated provider facts from raw Google payloads.

## Blocked by

- [[tb-06-q5-vibe-keep-drop-selection|TB-06: Q5 Vibe Keep/Drop Selection]] - GH [#363](https://github.com/samfarls55/gettoit/issues/363)
- [[tb-07-verdict-per-member-vibe-scoring|TB-07: Verdict Per-Member Vibe Scoring]] - GH [#364](https://github.com/samfarls55/gettoit/issues/364)
