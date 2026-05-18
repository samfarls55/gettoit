---
folder: 60_engineering/research/foursquare-tastes-vibe-2026-05
purpose: Sample the live Foursquare `tastes` field and curate a direction-tagged vibe-token allowlist for the tb-18 Q4 vibe classifier
prd: v1.1-quiz-redesign-prd
issue: 15_issues/v1.1/issues/research-02-tastes-vibe-token-allowlist
---

# foursquare-tastes-vibe-2026-05 — Research

Research spike for the v1.1 quiz redesign's Q4 vibe axis. Samples the live Foursquare `tastes` field across a representative venue pool and curates the **vibe-token allowlist** that [[../../../15_issues/v1.1/issues/tb-18-q4-vibe-tastes-signal|tb-18]]'s `Q5VenueClassifier` consumes — a flat list of `tastes` tokens, each tagged `+1` (loud-leaning) or `-1` (quiet-leaning).

**No application code shipped** — this is a documentation deliverable. It closes issue [[../../../15_issues/v1.1/issues/research-02-tastes-vibe-token-allowlist|research-02]].

## Contents

- [[report|report.md]] — the full spike: method, the live-sampled token-frequency table, the observed `tastes` coverage rate, the 30-token curated allowlist, and the curation rationale (what was excluded and why).
- `sample-tastes.ts` — the Deno sampler script that pulls the live `GET /places/search` surface and aggregates the `tastes` cloud. Reproducible; not wired into the proxy.
- `validate-allowlist.test.ts` — a Deno test suite that asserts the deliverable's acceptance criteria against the sampled data (real-sample size, coverage consistency, every token tagged +/-1, noise excluded).
- `data/raw-sample.json` — per-venue `tastes` arrays for the 1090-venue sample.
- `data/token-frequency.json` — the aggregated token-frequency table (2732 distinct tokens).
- `data/vibe-token-allowlist.json` — the curated allowlist as a machine artifact, for tb-18 to transcribe.

## Status

- [x] Live Foursquare `tastes` sampled — 1090 unique venues, 8 US metros x 3 categories (2026-05-18).
- [x] Token-frequency table aggregated (venue-document-frequency).
- [x] `tastes` coverage rate measured: **66.8%** — corrects the ~76% estimate the tb-18 ticket and research-01 cited.
- [x] Vibe-token allowlist curated: **30 tokens** (16 `+1`, 14 `-1`), folksonomy noise and energy-ambiguous tokens excluded.
- [x] Validation suite green (`deno test --allow-read validate-allowlist.test.ts`).

## Key findings

- `tastes` coverage is **66.8%**, not ~76%, and it is category-dependent — restaurants 83%, bars 75%, cafes/coffee shops only 44%. The classifier's archetype-only fallback path runs for a third of all venues.
- The cloud is ~98.9% folksonomy noise by distinct-token count (dish names, ingredients, meal slots).
- The hard curation call was excluding atmosphere-*adjacent* but non-energy-directional tokens — `casual` (56% of venues), `music`, `good for special occasions`, `cute` — none of which place a venue on the Quiet/Rowdy axis.
