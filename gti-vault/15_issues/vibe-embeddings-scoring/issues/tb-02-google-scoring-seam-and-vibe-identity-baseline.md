---
status: done
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

- [x] The current five visible Vibe labels are inventoried and mapped to stable backend IDs and 1.0-5.0 positions.
- [x] Any 0-4 Vibe representation remains a legacy adapter only at module boundaries.
- [x] The active Google-backed Q5 candidate generation seam is identified and covered by tests.
- [x] The active Google-backed final verdict scoring seam is identified and covered by tests.
- [x] Active Q5 axes are aligned to `cuisine`, `crowd_approval`, and `vibe`; legacy `reputation` language is not extended.
- [x] No summaries, embeddings, vectors, `vibe_position`, or numeric confidence are persisted.
- [x] Tests prove existing Q5/verdict behavior remains unchanged except for intentional terminology/identity adapters.

## Implementation Notes

- Added `_shared/vibe-band.ts` as the stable backend Vibe band identity baseline: `quiet`, `chill`, `social`, `lively`, `rowdy`, visible labels `QUIET` through `ROWDY`, legacy indices `0..4`, and canonical positions `1.0..5.0`.
- Added `_shared/google-scoring-seams.ts` to document the active Google Q5 and final verdict scoring seams future embedding slices should attach to.
- Changed the active Q5 rating axis contract to `cuisine`, `crowd_approval`, and `vibe`. Legacy persisted or caller-supplied `droppedAxis: "reputation"` normalizes to `crowd_approval` in the vote reader.
- The existing Q3 answer/provider bucket field remains named `reputation` as a legacy boundary value; no display/UI behavior changed.
- No schema fields, summaries, embeddings, vectors, `vibe_position`, confidence values, or provider-derived vibe storage were added.

## Verification

- `PATH=/home/agent/.deno/bin:/usr/local/bin:/usr/bin:/bin npm run verify:edge` passed on 2026-06-12: 510 passed, 0 failed, 3 ignored.

## Blocked by

- [[tb-01-voyage-secret-and-embedding-env-readiness|TB-01: Voyage Secret And Embedding Env Readiness]] - GH [#358](https://github.com/samfarls55/gettoit/issues/358) - human setup confirms backend flag and secret names before downstream wiring
