---
status: ready-for-agent
type: AFK
github_issue: 360
---

# TB-03: Pure Transient Vibe Fit Signal

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Build the pure backend Vibe Fit core with synthetic inputs and deterministic fake embeddings. The module extracts short atmosphere-focused Vibe evidence spans, compares them to versioned app-owned Vibe anchors, projects a transient `vibe_position` on the 1.0-5.0 scale, calculates transient confidence, and emits controlled receipt codes for no evidence, low confidence, conflict, and meal-time weighting.

This slice proves the core scoring contract without Google field masks, Voyage network calls, Q5 card selection, or verdict persistence.

## Acceptance criteria

- [ ] Vibe anchors are hardcoded in a versioned backend config with the v0.1.0 starter bands: Quiet, Chill/Mellow, Social/Balanced, Lively, Rowdy.
- [ ] The span assembler selects short source spans, not isolated keywords and not generated replacement wording.
- [ ] Span extraction excludes venue type, cuisine/menu, service mode, dietary, Cuisine NEVER, price, quality-only, and crowd-approval-only terms.
- [ ] Simple negation such as `not loud`, `not too crowded`, and `not quiet` is handled.
- [ ] Complex negation, sarcasm, and ambiguous scope lower confidence or exclude evidence instead of producing a confident opposite signal.
- [ ] At most five Vibe evidence spans per candidate are selected deterministically.
- [ ] Projection uses fake embeddings in normal tests, weighted-centroid position, confidence from evidence amount and anchor clarity with conflict penalties, and controlled receipt codes.
- [ ] Synthetic fixtures cover all five bands, synonym-heavy descriptors, type/food/service-only neutral behavior, quality/crowd leakage, mixed quiet/lively conflict, and no-evidence behavior.
- [ ] The pure module does not persist summaries, spans, vectors, `vibe_position`, numeric confidence, or provider facts.

## Blocked by

- [[tb-02-google-scoring-seam-and-vibe-identity-baseline|TB-02: Google Scoring Seam And Vibe Identity Baseline]] - GH [#359](https://github.com/samfarls55/gettoit/issues/359)
