---
status: done
type: AFK
github_issue: 361
---

# TB-04: Google Summary Mask And VibeFitCandidate Path

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Wire Google summary access into the active scoring path through an internal-only field-mask and narrowed `VibeFitCandidate` DTO. Summaries are requested only when Vibe fit is enabled and needed after hard eligibility cuts, kept server-only, passed to the pure Vibe Fit core through a DTO that excludes unrelated provider facts, and discarded before response or storage.

Weak structured hints may be carried only as curated hint fields, not embedded candidate text.

## Acceptance criteria

- [ ] `reviewSummary` and `generativeSummary` are requested only through internal scoring masks when Vibe fit is enabled and needed.
- [ ] Display/refetch masks and disabled/budget-skipped paths omit summary fields where field-mask control allows.
- [ ] Vibe fitting runs only after hard eligibility cuts for Search area, price cap, meal-time eligibility, service mode, hard dietary safety, Cuisine NEVERs, required metadata, and crowd approval floor.
- [ ] The Vibe Fit module receives a narrowed `VibeFitCandidate` DTO, not raw Google Places responses.
- [ ] The DTO excludes cuisine/type, price, rating, service format, full address, display name, reviews, raw payload fields, and unrelated provider facts.
- [ ] Allowed weak structured hints are limited to the PRD-approved set and are not embedded as text.
- [ ] `neighborhoodSummary`, raw reviews, and `editorialSummary` are excluded.
- [ ] Tests prove summaries are discarded before response/storage and cannot leak into durable records or client payloads.

## Blocked by

- [[tb-02-google-scoring-seam-and-vibe-identity-baseline|TB-02: Google Scoring Seam And Vibe Identity Baseline]] - GH [#359](https://github.com/samfarls55/gettoit/issues/359)
- [[tb-03-pure-transient-vibe-fit-signal|TB-03: Pure Transient Vibe Fit Signal]] - GH [#360](https://github.com/samfarls55/gettoit/issues/360)
