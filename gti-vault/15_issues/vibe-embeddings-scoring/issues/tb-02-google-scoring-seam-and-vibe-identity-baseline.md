---
status: ready-for-agent
type: AFK
github_issue: 359
---

# TB-02: Google Scoring Seam And Vibe Identity Baseline

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Establish the backend seam where Vibe embeddings will attach, without changing scoring behavior yet. Inventory the active Google-backed Q5 and verdict paths, align any live `reputation` naming to the Google-era `crowd_approval` / `vibe` axis language where needed, and define stable backend Vibe band identities mapped to the current five visible UI labels and canonical 1.0-5.0 Quiet-to-Rowdy positions.

The output is a small, tested baseline that future slices can import: stable Vibe band IDs, positions, adapter handling for any legacy 0-4 index, and a documented active scoring seam. No client-visible UI changes are included.

## Acceptance criteria

- [ ] The current five visible Vibe labels are inventoried and mapped to stable backend IDs and 1.0-5.0 positions.
- [ ] Any 0-4 Vibe representation remains a legacy adapter only at module boundaries.
- [ ] The active Google-backed Q5 candidate generation seam is identified and covered by tests.
- [ ] The active Google-backed final verdict scoring seam is identified and covered by tests.
- [ ] Active Q5 axes are aligned to `cuisine`, `crowd_approval`, and `vibe`; legacy `reputation` language is not extended.
- [ ] No summaries, embeddings, vectors, `vibe_position`, or numeric confidence are persisted.
- [ ] Tests prove existing Q5/verdict behavior remains unchanged except for intentional terminology/identity adapters.

## Blocked by

- [[tb-01-voyage-secret-and-embedding-env-readiness|TB-01: Voyage Secret And Embedding Env Readiness]] - GH [#358](https://github.com/samfarls55/gettoit/issues/358) - human setup confirms backend flag and secret names before downstream wiring
