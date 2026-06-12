---
status: ready-for-agent
github_issue: 357
---

# Vibe Embeddings Scoring PRD

## Problem Statement

GetToIt's Q5 preference probe and final verdict both depend on understanding a restaurant's **Vibe band** fit. Today the active scoring model still carries older bucket-shaped assumptions: a venue has a coarse vibe value, Q5 treats vibe as one of three probe axes, and final scoring grades by distance from the member's selected band. That is not expressive enough for real restaurant language.

People describe atmosphere with many overlapping phrases: quiet, intimate, cozy, mellow, buzzy, packed, lively, scene-y, hard to hear, easy to talk, and many more. A keyword list would miss too much, while a closed category classifier would flatten useful nuance. The product needs a semantic, continuous way to place candidate restaurants on the Quiet-to-Rowdy **Vibe band**, while preserving the strict Google Places retention boundary locked by ADR 0022.

The risk is that embeddings could accidentally become a durable Google-derived venue profile, a provider cache, or a shortcut for non-vibe facts such as cuisine, price, service mode, crowd approval, or dietary safety. This PRD exists to improve vibe mapping quality without crossing those boundaries.

## Solution

Add a backend-only Vibe Fit module that uses transient embeddings to compare short atmosphere-focused **Vibe evidence** from current Google Places data against versioned app-owned **Vibe anchors**. The module produces a transient **Vibe fit signal**: a continuous `vibe_position` on the canonical 1.0-5.0 Quiet-to-Rowdy scale, plus transient confidence and controlled receipt codes.

The signal feeds both Q5 card generation and final verdict scoring through the same app-owned vibe ruler. Q5 uses the signal to choose cleaner vibe-axis keep/drop cards with a higher confidence bar. Final verdict scoring uses the same signal per member, blends low-confidence fits toward neutral, and caps low-confidence upside so missing or sparse evidence does not become a perfect vibe match.

Embeddings run only after hard eligibility cuts have already produced candidates worth scoring. Google summaries, source spans, vectors, `vibe_position`, numeric confidence, and provider-fact component scores remain transient. Durable records may keep only final aggregate Verdict fit score, scoring/version identifiers, Google Place IDs where ADR 0022 allows them, Q5 outcome labels, axis roles, and app-owned controlled receipt/reason codes.

The first implementation uses Voyage `voyage-4-lite`, called from Supabase Edge Functions through a thin backend wrapper. It ships behind a server-side kill switch/checklist gate in the single production environment, with deterministic fake embeddings for normal tests and opt-in live smoke/calibration paths.

## User Stories

1. As a Plan member, I want the app to understand atmosphere language beyond exact UI labels, so that a restaurant described as cozy, mellow, buzzy, energetic, or hard to hear maps naturally onto the Vibe band.
2. As a Plan member, I want vibe matching to be continuous from Quiet to Rowdy, so that close fits and near misses are treated more fairly than rigid buckets.
3. As a Plan member, I want Q5 vibe cards to show real restaurants whose atmosphere meaningfully differs from my target, so that my ratings teach the app how much vibe matters to me.
4. As a Plan member, I want Q5 vibe keep cards to sit near my selected Vibe band, so that a high rating reinforces my actual target.
5. As a Plan member, I want Q5 vibe drop cards to be meaningfully outside my selected Vibe band, so that the contrast reveals whether vibe matters.
6. As a Plan member, I do not want Q5 vibe cards forced to cartoonish extremes when the pool is thin, so that the probe still uses plausible restaurants.
7. As a Plan member, I want thin Q5 pools to relax vibe confidence or contrast before failing, so that the app can still produce a usable probe when possible.
8. As a Plan member, I want Q5 to fail honestly if it cannot form a useful vibe-axis card, so that the app does not infer preferences from a broken probe.
9. As a Plan member, I want final verdict scoring to use the same vibe meaning as Q5, so that I am not probed under one ruler and scored under another.
10. As a Plan member, I want each member's vibe target scored independently, so that the group does not erase individual vibe preferences into one averaged target.
11. As a Plan member, I want missing vibe evidence to behave like uncertainty rather than a negative judgment, so that a restaurant is not disqualified just because Google summaries are thin.
12. As a Plan member, I want low-confidence vibe fits to avoid a harsh penalty, so that otherwise strong candidates can still win.
13. As a Plan member, I do not want low-confidence vibe fits to earn a perfect vibe score by accident, so that sparse text does not overpower better evidence.
14. As a Plan member, I want restaurants with no vibe evidence to remain eligible to win when they strongly satisfy other axes, so that embeddings do not become a hidden hard filter.
15. As a Plan member, I want the app to distinguish vibe from cuisine and menu facts, so that "quiet local steakhouse with a seafood tower" maps quiet/local atmosphere separately from steakhouse/seafood facts.
16. As a Plan member, I want the app to ignore quality-only words like excellent, best, favorite, popular, and highly rated for vibe unless they include atmosphere texture, so that crowd approval does not leak into vibe.
17. As a Plan member, I want packed, crowded, busy, buzzy, and hard-to-hear descriptions to count as vibe when they describe experienced atmosphere, so that lively/rowdy evidence is captured.
18. As a Plan member, I want price and service facts excluded from vibe, so that expensive, cheap, counter-service, takeout, and fast-casual service-format facts do not distort the Vibe band.
19. As a Plan member, I want mood-facing atmosphere words like upscale, elegant, romantic, date-night, white-tablecloth, and casual to count where appropriate, so that finer vibe texture is not lost.
20. As a Plan member, I want simple negations like not loud, not too crowded, and not quiet handled correctly, so that the signal is not inverted.
21. As a Plan member, I want ambiguous sarcasm or complex negation to lower confidence rather than become a confident guess, so that the app avoids false precision.
22. As a Plan member, I want meal-time-specific evidence to matter when a place feels different at brunch, dinner, or late night, so that the vibe fit reflects the Plan.
23. As a Plan member, I do not want Google display name, address, or Maps link used as vibe evidence, so that display content does not become scoring text.
24. As a Plan member with allergies or dietary needs, I do not want summaries or embeddings used to infer dietary safety, so that hard safety remains based on proper user-owned constraints and high-confidence provider fields/types.
25. As a Plan member with Cuisine NEVERs, I do not want embeddings used to infer or override those hard vetoes, so that cuisine safety remains separate from vibe scoring.
26. As a Plan member, I do not want embeddings to alter price, service mode, cuisine, venue type, or crowd approval later in the same flow, so that each scoring axis stays understandable.
27. As a Plan member, I want the five visible Vibe labels to keep their product meaning even if UI copy changes, so that scoring does not silently shift.
28. As a founder, I want stable backend Vibe label IDs mapped to the five UI labels, so that the backend owns the scoring identity rather than display copy.
29. As a founder, I want app-owned Vibe anchors for each band, so that the model compares restaurant evidence against a versioned GetToIt ruler.
30. As a founder, I want anchor phrase sets richer than the UI labels, so that high-end Rowdy can include energetic, loud, packed, high-energy, party-like, and scene-y without changing UI copy.
31. As a founder, I want anchor edits treated as scoring changes, so that Q5/verdict behavior remains explainable across versions.
32. As a founder, I want one shared Vibe Fit signal feeding Q5 and verdict, so that scoring behavior does not drift.
33. As a founder, I want Q5 to use a stricter confidence bar than final verdict scoring, so that the probe teaches from clearer contrasts.
34. As a founder, I want final verdict scoring to tolerate neutral/low-confidence vibe candidates, so that the final recommendation is not over-pruned.
35. As a founder, I want the formula shape documented, so that future agents can reason about cosine similarities, anchor aggregation, weighted-centroid projection, confidence, and member scoring.
36. As a founder, I want formula constants centralized in a versioned backend config, so that a scoring receipt can identify exactly which app-owned ruler was used.
37. As a founder, I want Voyage `voyage-4-lite` locked for v0.1.0, so that cost, fixtures, and scoring versions have one embedding target.
38. As a founder, I want a future model change to require fixture/eval evidence, so that provider churn does not happen by taste alone.
39. As a founder, I want a thin Voyage wrapper rather than a broad multi-provider framework, so that the implementation stays simple.
40. As a founder, I want `VOYAGE_API_KEY` stored server-side only, so that clients never handle embedding provider credentials.
41. As a founder, I want Voyage data-use/retention terms reviewed before enablement, so that Google-derived transient text is not sent to an unacceptable processor.
42. As a founder, I want embeddings controlled by a server-side kill switch, so that production-only v0.1.0 can disable the path quickly.
43. As a founder, I want embeddings disabled until the enablement checklist is complete, so that retention review, fixtures, privacy tests, and smoke testing happen first.
44. As a founder, I want disabled embeddings to skip Voyage calls and degrade safely, so that the app does not silently resurrect legacy category/type heuristics.
45. As a founder, I want weak structured Google hints used only as confidence-capped nudges, so that `liveMusic` or `goodForGroups` can help but not dominate.
46. As a founder, I want Google "Atmosphere" treated as a SKU tier, not a GetToIt ontology, so that provider packaging does not shape product semantics.
47. As a founder, I want `reviewSummary` and `generativeSummary` used only through internal scoring masks, so that summaries stay server-only and transient.
48. As a founder, I want raw reviews, `editorialSummary`, and `neighborhoodSummary` excluded from v0.1.0 vibe embeddings, so that the first pass has a narrower policy and product surface.
49. As a founder, I want summary fields omitted from display/refetch masks and unnecessary disabled paths, so that field masks stay conservative.
50. As a founder, I want no visible UI changes in v0.1.0, so that vibe embeddings improve backend recommendation quality without new explanation surfaces.
51. As a founder, I do not want summary snippets, extracted phrases, `vibe_position`, or confidence shown to users, so that internal scoring remains internal.
52. As a founder, I want no durable venue vibe profiles or Place ID-to-vibe caches, so that Google-derived summaries do not become stored app metadata.
53. As a founder, I want no pgvector/Supabase Vector table in v0.1.0, so that the first implementation stays transient.
54. As a founder, I want no stored extracted phrases, summary embeddings, or training datasets containing Google-derived spans, so that the app honors ADR 0022.
55. As a founder, I want app-owned anchor embeddings allowed to be cached/precomputed if useful, so that app-owned text can be optimized safely.
56. As a founder, I want in-flow dedupe allowed for Vibe fit signals, so that Q5 and verdict do not embed the same candidate repeatedly inside one scoring flow.
57. As a founder, I want in-flow dedupe forbidden from surviving the scoring cycle, so that it does not become a cache.
58. As a founder, I want embedding budgets per Room/scoring flow, so that cost and latency are bounded.
59. As a founder, I want embedding inputs batched per active scoring flow, so that anchor and candidate span embeddings are efficient and deterministic.
60. As a founder, I want at most five Vibe evidence spans embedded per candidate, so that verbose summaries do not overpower concise ones or blow the budget.
61. As a founder, I want span selection deterministic by source priority, atmosphere strength, and meal-time relevance, so that repeated runs are explainable.
62. As a founder, I want provider failures, timeouts, and budget exhaustion to degrade vibe toward neutral/low-confidence, so that the Room keeps moving.
63. As a founder, I want at most one bounded retry for transient Voyage failures when budget allows, so that the app avoids per-candidate retry loops.
64. As a founder, I want controlled receipt codes for no evidence, low confidence, conflict, mealtime weighting, unavailable embeddings, disabled embeddings, and Q5 vibe relaxations, so that auditability stays provider-content-free.
65. As a founder, I do not want numeric confidence or `vibe_position` persisted, so that transient Google-derived math does not become durable place metadata.
66. As a founder, I want aggregate metrics for counts, latency, confidence buckets, anchor buckets, budget exhaustion, and relaxation counts, so that quality can be monitored without content leakage.
67. As a founder, I do not want logs or analytics carrying source spans, summaries, vectors, per-place vibe positions, place names, provider facts, or broad Google Place IDs, so that observability stays policy-safe.
68. As a developer, I want a narrowed `VibeFitCandidate` DTO instead of raw Google responses, so that vibe scoring cannot accidentally read price, rating, type, address, name, or raw payload fields.
69. As a developer, I want a backend seam audit before implementation, so that embeddings wire into the active Google scoring path rather than stale FSQ/reputation paths.
70. As a developer, I want one pure core Vibe Fit scorer plus thin Q5/verdict adapters, so that the core math is tested once and reused.
71. As a developer, I want deterministic fake embeddings in normal tests, so that CI failures are explainable.
72. As a developer, I want synthetic app-authored fixture summaries, so that extraction/projection behavior is tested without storing Google text.
73. As a developer, I want fixture coverage for all five Vibe anchors, so that synonym-heavy language maps across the full band.
74. As a developer, I want fixtures proving type, food, service, price, quality, and crowd words do not leak into vibe, so that the extraction boundary holds.
75. As a developer, I want fixtures for low/no evidence, conflicting evidence, meal-time conflicts, provider unavailable, disabled embeddings, and budget exhaustion, so that degraded behavior is locked.
76. As a developer, I want Q5 keep/drop fixtures, so that vibe-axis card selection preserves intended contrast.
77. As a developer, I want privacy tests proving request text, response embeddings, provider errors, and secrets are not logged, so that the Voyage path is safe.
78. As a developer, I want an opt-in live Voyage smoke test, so that provider wiring can be checked without making normal CI flaky or costly.
79. As a developer, I want an opt-in local calibration script using only app-authored examples, so that anchors/formulas can be tuned without committing provider text.
80. As a developer, I want a manual quality gate, so that obviously wrong common vibe language blocks merge even if synthetic fixtures pass.
81. As a developer, I want a manual privacy/logging audit before enablement, so that real logs are checked for successful, failure, budget-exhausted, and disabled-mode runs.
82. As a developer, I want no POS-tagging or LLM span classifier dependency in v0.1.0 unless fixtures prove local span assembly fails, so that complexity stays controlled.
83. As a developer, I want schema changes allowed only for controlled receipts/versioning if needed, so that implementation is not blocked by storage mechanics.
84. As a developer, I do not want schema changes for vectors, stored positions, stored confidence, stored phrases, or training capture, so that v0.1.0 remains transient.
85. As a developer, I want implementation to verify current Vibe UI labels before coding, so that backend IDs match the shipped quiz vocabulary.

## Implementation Decisions

- Start with a backend seam audit. Identify the active Google candidate payload shaping path, Q5 card generation path, final verdict candidate fetch path, candidate profiling path, member preference scoring path, summary fetch/discard behavior, and any remaining legacy FSQ / `reputation` paths. Embeddings must wire only into the active Google scoring seam.
- FSQ-era venue-classifier behavior is not a compatibility target for this work. Tests that bless Foursquare categories, tastes, price-tier vibe fallback, or pool-relative reputation semantics should be replaced or marked legacy/superseded where this seam is implemented.
- The Q5 axes for this work are `cuisine`, `crowd_approval`, and `vibe`. If an active seam still uses the legacy `reputation` name, the implementation aligns it to the Google-era axis language rather than extending the old name.
- Vibe embeddings run in the recommendation/scoring layer, not in the Google provider layer, not in the client, and not as a durable provider cache.
- Vibe embeddings run only after hard eligibility cuts: Search area, price cap, meal-time eligibility, service mode, hard dietary safety, Cuisine NEVERs, required metadata, and crowd approval floor. Hard cuts never depend on embeddings.
- The Google provider layer may request `reviewSummary` and `generativeSummary` only through internal scoring field-mask versions when Vibe fit is enabled and needed for Q5 or verdict scoring.
- Summary fields remain server-only and are discarded before any response or storage.
- Display-only/refetch masks and disabled/budget-skipped paths omit summary fields where field-mask control allows.
- The Vibe Fit module receives a narrowed internal `VibeFitCandidate` DTO, not raw Google Places responses.
- The DTO may carry only the in-flow candidate identifier, Google Place ID for joining under ADR 0022 boundaries, Plan meal-time context, allowed weak structured hints, server-only summary text when enabled, and minimal provider/source metadata needed for controlled receipts.
- The DTO must not expose cuisine/type, price, rating, service format, full address, display name, reviews, or raw payload fields to vibe extraction/projection.
- Vibe evidence is built from short atmosphere descriptor spans, not isolated keywords and not normalized/rephrased descriptors generated by the app.
- The span assembler selects source spans from Google text only and never commits those spans.
- The first implementation uses deterministic local span assembly, not POS tagging, not a new LLM classifier, and not a model-generated keyword extractor.
- POS tagging or LLM span classification stays out of v0.1.0 unless fixtures prove local span assembly cannot protect the vibe/type boundary.
- The span assembler excludes venue type facts, cuisine/menu facts, service-mode facts, dietary safety, Cuisine NEVERs, price facts, quality-only words, and crowd-approval-only words.
- The span assembler handles simple local negation such as not loud, not too crowded, and not quiet.
- Complex negation, sarcasm, and ambiguous scope lower confidence or exclude the span rather than producing high-confidence opposite evidence.
- Vibe evidence is embedded at extracted-span level and then combined into one transient Vibe fit signal.
- Strongly conflicting span results lower confidence. Explicit daypart/meal-time clues may weight spans toward the Plan meal time.
- v0.1.0 embeds at most five Vibe evidence spans per candidate.
- Span selection is deterministic by source priority, atmosphere signal strength, and meal-time relevance.
- Extra valid spans may affect only aggregate provider-content-free metrics or controlled receipt buckets.
- Vibe anchors are hardcoded as versioned backend configuration for v0.1.0, not stored in the database for runtime tuning.
- The PRD implementation must inventory the current five Vibe UI labels, define stable backend IDs / 1-5 positions, define a v1 starter anchor set, and cross-check anchors against UI labels.
- The starter anchor set should cover: 1 Quiet; 2 Chill/Mellow; 3 Social/Balanced; 4 Lively; 5 Rowdy.
- Anchor phrase sets may be richer than UI labels. Scoring does not depend on exact UI wording.
- Anchor edits are scoring changes. Any anchor phrase edit requires code review, fixture expectations, and a Vibe anchor/scoring version bump.
- Anchor projection uses a weighted centroid across the five Vibe bands, not nearest-anchor-only classification.
- Clear top-anchor wins land near that band, adjacent ambiguity may land between bands, and non-adjacent conflict lowers confidence.
- Vibe confidence combines evidence amount, anchor clarity, and conflict penalty. Venue type/category, price, rating, and crowd approval must not boost vibe confidence.
- The v1 formula contract is cosine similarity from selected evidence spans to anchor phrases, aggregation of anchor scores by Vibe band, weighted-centroid projection to `vibe_position`, confidence from evidence amount plus anchor separation minus conflict, and distance-based member vibe scoring blended/capped by confidence.
- Exact thresholds and constants may be tuned during implementation with fixture evidence before merge.
- Formula constants live in a versioned backend config object rather than scattered literals.
- The config includes anchor version, max spans, confidence caps, weak-hint weights, timeout/budget names, and formula constants.
- The canonical domain output is a continuous `vibe_position` on the 1.0-5.0 Vibe band plus transient confidence. Any 0-4 representation is a legacy implementation index adapted at module boundaries.
- One versioned Vibe fit signal feeds both Q5 card generation and final verdict scoring.
- Expose one shared core Vibe Fit scorer and thin Q5/verdict adapters.
- Q5 uses a stronger confidence bar for vibe-axis cards than final verdict scoring.
- Q5 vibe keep candidates sit near the member's target band. Q5 vibe drop candidates sit meaningfully outside the target band while matching other axes.
- Thin Q5 pools may relax vibe confidence or contrast distance before failing, using controlled receipt codes.
- Final verdict scoring can tolerate neutral/low-confidence vibe candidates because it aggregates many axes and members.
- Final vibe-axis scoring is per member, not a group-average target first.
- Missing or low-confidence vibe evidence weakens the vibe component toward neutral and does not disqualify a candidate.
- Candidates with no vibe evidence remain eligible to win if they score strongly enough on other axes.
- Low-confidence vibe fits blend toward neutral and cap maximum positive contribution, so sparse evidence cannot produce a perfect vibe match.
- Curated Google structured hints are not embedded as candidate text.
- Allowed weak structured hints include `liveMusic`, `goodForGroups`, `goodForWatchingSports`, and possibly weak-context `outdoorSeating`.
- Structured hints may apply small confidence-capped post-embedding nudges when summary-derived evidence is absent, weak, or consistent.
- Structured hints must not overpower summary-derived atmosphere spans or produce high confidence by themselves.
- Service, meal, price, rating, menu, and dietary fields remain outside vibe evidence.
- `neighborhoodSummary`, raw reviews, and `editorialSummary` are excluded from v0.1.0 vibe embeddings.
- English-first behavior is acceptable. Translation is out of scope.
- The embedding provider is Voyage `voyage-4-lite` with default 1024-dimensional output.
- Any provider/model change requires fixture/eval evidence that the locked model fails the vibe/type boundary or anchor projection quality bar.
- Supabase Edge Functions call Voyage through a thin backend wrapper that owns API URL, auth header, request/response parsing, batching, timeout, retry, and error mapping.
- v0.1.0 does not introduce a generic multi-provider embedding framework.
- `VOYAGE_API_KEY` is a server-only Supabase secret and a prerequisite for live embeddings.
- Voyage API data-use/retention review is a production enablement gate. If terms are unacceptable, embeddings remain disabled or provider choice is revisited.
- Embeddings are controlled by a server-side feature flag/kill switch. Clients do not control it.
- v0.1.0 has no separate user-facing environments. Enablement is a production-only checklist gate: secret present, Voyage retention review done, fixtures passing, privacy tests passing, smoke test passing, and kill switch available.
- Disabled embeddings skip Voyage calls and must not fall back to legacy category/type vibe heuristics.
- When embeddings are disabled, Q5 still attempts to preserve the vibe-axis card shape using weak hints or neutral/low-confidence behavior, with controlled relaxation reason codes.
- Embedding inputs are batched per active scoring flow, not one candidate at a time.
- Q5 generation and verdict scoring select spans deterministically, add app-owned anchor phrases, dedupe identical text within that flow, call Voyage in as few batches as budget allows, then project candidates.
- The backend owns per-Room/per-scoring-flow embedding budgets plus global provider guardrails.
- Use one short per-flow embedding timeout, batch requests where practical, and allow at most one bounded retry only for transient `429`, `5xx`, or network-timeout failures when the retry fits budget.
- No per-candidate retry loops.
- Provider failure, timeout, or budget exhaustion degrades affected candidates toward neutral/low-confidence rather than failing the Room.
- Durable records may keep only controlled operational receipt codes for embedding failures, not provider text or vectors.
- App-owned anchor embeddings may be precomputed/cached as app-owned configuration if useful.
- Google-derived candidate spans and embeddings may not be cached durably.
- In-memory/per-flow dedupe of Vibe fit signals is allowed only inside one active Q5 generation or verdict scoring flow.
- No vector table, venue vibe profile table, stored confidence/position column, stored extracted phrase table, or training-data capture table is added for Google-derived text.
- Schema changes are allowed only where existing durable receipts/scoring-version structures cannot represent app-owned controlled codes and version components cleanly.
- Durable records may keep final aggregate Verdict fit score, version IDs, allowed Google Place IDs, Q5 outcome labels, axis roles, and app-owned controlled receipts/reason codes.
- Durable scoring version should identify Google scoring field-mask version, Vibe anchor version, span assembler version, embedding provider/model, projection/confidence formula version, Q5 generation rules version, and verdict scoring formula version.
- Seed controlled vibe receipt codes: `vibe_no_evidence`, `vibe_low_confidence`, `vibe_conflicting_evidence`, `vibe_mealtime_weighted`, `vibe_embedding_unavailable`, `vibe_embedding_budget_exhausted`, `vibe_embeddings_disabled`, `selected_vibe_low_confidence_relaxed`, `selected_vibe_contrast_relaxed`, `selected_vibe_high_confidence_keep`, and `selected_vibe_high_confidence_drop`.
- Released durable code meanings remain append-only under the existing Reason codes rules.
- Observability may record aggregate provider-content-free metrics: candidate no-evidence counts, selected/embedded span counts, embedding calls per flow, Voyage latency, timeout/error/budget counts, aggregate confidence buckets, aggregate anchor/position buckets, Q5 vibe relaxation counts, and no-results counts due to vibe confidence or contrast shortage.
- Logs and analytics must not carry source spans, summaries, vectors, per-place `vibe_position`, place names, provider facts, broad-stream Google Place IDs, numeric confidence, or numeric vibe internals.
- There are no client-visible UI changes in v0.1.0. Do not show summary snippets, extracted phrases, `vibe_position`, confidence, or embedding status.

Major seams to use:

- Backend seam audit for active Google candidate shaping, Q5 generation, final verdict fetch/scoring, candidate profiling, member preference scoring, and summary fetch/discard behavior.
- Pure Vibe Fit module for span assembly, anchor config, projection, confidence, provider wrapper consumption, and controlled receipts.
- Google internal scoring field-mask / DTO seam for summary fields and weak structured hints.
- Q5 card-generation adapter seam for high-confidence vibe keep/drop selection and relaxation.
- Final verdict/member preference scoring adapter seam for per-member vibe scoring, neutral/low-confidence blending, and versioned final fit.
- Observability/redaction seam for provider-content-free metrics and leak prevention.
- Optional schema/receipt seam only if current durable structures cannot represent controlled codes/version IDs.

## Testing Decisions

Good tests assert external behavior, scoring contracts, and policy boundaries. They should not depend on implementation details such as helper names or private intermediate arrays. The most valuable tests prove what enters/leaves each seam: selected Vibe evidence, transient Vibe fit behavior, Q5 card roles, final scoring behavior, provider failure degradation, durable storage boundaries, and log/redaction safety.

- Normal CI uses deterministic fake embeddings and synthetic app-authored summaries.
- The fake embedder uses fixed vectors by fixture label / deterministic embedding map, not a local mini semantic model.
- Voyage integration is mocked by default.
- Live Voyage smoke is secret-gated and explicit, for example requiring `VOYAGE_API_KEY` plus `RUN_LIVE_EMBEDDING_SMOKE=1`.
- Local development may use a deterministic fake embedder behind an explicit dev/test flag or degrade to neutral when `VOYAGE_API_KEY` is absent.
- Production must not silently use fake embeddings.
- Synthetic fixtures must be app-authored and realistic without copying Google summaries or spans.
- Real Google summaries may inform transient manual analysis, but copied summary text or extracted spans must not be committed to repo fixtures, vault notes, or durable eval datasets.
- Required fixture coverage includes vibe/type separation, quality/crowd/service leakage, meal-time conflicts, synonym coverage across all five anchors, low/no evidence behavior, embedding unavailable behavior, budget-exhausted behavior, disabled embeddings, and no durable leakage.
- Span extraction fixtures must prove type, food, service, price, quality, crowd approval, dietary, and cuisine terms do not leak into `vibe_position`.
- Projection fixtures must prove synonym-heavy examples for each band land inside expected ranges.
- Type/food/service-only summaries must land neutral/low-confidence.
- Mixed quiet/lively evidence must lower confidence.
- Q5 vibe keep/drop fixtures must choose intended contrast and preserve strict-factorial axis shape.
- Final scoring fixtures must prove low/no-confidence vibe blends toward neutral and caps positive upside.
- Provider failure fixtures must prove timeout, transient error, budget exhaustion, and kill-switch-disabled behavior degrade to neutral/low-confidence with controlled receipts.
- Batching tests must prove selected spans and anchors are deduped within a flow and no per-candidate retry loop happens.
- Storage/privacy tests must prove summaries, spans, vectors, `vibe_position`, numeric confidence, provider facts, place names, and provider-fact component scores are not persisted.
- Security/privacy tests must prove request text and response embeddings are not logged, provider errors are redacted, `VOYAGE_API_KEY` never appears in logs or thrown errors, and receipts carry only controlled code/status class/step/latency.
- Observability tests must prove aggregate metrics do not include source spans, summaries, vectors, per-place vibe positions, place names, provider facts, or broad Google Place IDs.
- Field-mask tests must prove summary fields are requested only through internal scoring masks when needed and omitted from display/refetch/disabled paths where possible.
- DTO tests must prove Vibe Fit cannot read unrelated provider facts from raw Google payloads.
- Q5 tests should use the existing pure card-generation style and assert card roles, contrast, relaxation codes, and no-results behavior.
- Verdict tests should use the existing compute/verdict style and assert final fit, scoring version, slate behavior, neutral degradation, and no display-content persistence.
- A narrow manual calibration pass may block merge if common vibe language clearly lands on the wrong part of the Quiet-to-Rowdy band. Manual calibration may use app-authored examples and transient real Google observations, but no stored Google-derived summaries or spans.
- A short manual privacy/logging audit is required before enablement. Inspect one successful embedding run, one provider failure, one budget exhaustion, and one disabled-mode run for leaks.
- An opt-in local calibration script may send only app-authored synthetic summaries and anchors to Voyage, print projected positions/confidence, require `VOYAGE_API_KEY`, stay outside normal CI, and write no persistent outputs unless a developer explicitly redirects stdout.

Prior art:

- Existing Supabase Edge Function tests for provider proxy behavior, Google field masks, attribution, guardrails, redaction, compute-verdict, no-survivor handling, final Google verdict fetch, slate persistence, reroll behavior, and schema/storage boundaries.
- Existing pure tests for preference-function axis scoring and verdict-engine final scoring behavior.
- Existing Q5 factorial tests and vote-wire tests for axis roles and member preference input shapes.

## Out of Scope

- Any client-visible UI change.
- Showing summaries, extracted phrases, `vibe_position`, confidence, or embedding status.
- Durable Google-derived summary text, atmosphere text, source spans, extracted phrases, embeddings, `vibe_position`, numeric confidence, or provider-fact component scores.
- Durable venue vibe profiles, Place ID-to-vibe caches, pgvector/Supabase Vector tables, or training/eval datasets containing Google-derived spans.
- Raw reviews, `editorialSummary`, or `neighborhoodSummary` for v0.1.0 vibe embeddings.
- Translation/multilingual support beyond English-first behavior.
- POS-tagging dependency, LLM span classifier, or model-generated keyword extraction unless fixture evidence proves local span assembly fails.
- Generic multi-provider embedding framework.
- Model/provider changes without fixture/eval evidence.
- Using embeddings to infer or modify cuisine, venue type, service mode, dietary eligibility, dietary safety, Cuisine NEVER handling, price, or crowd approval.
- Hard disqualification based on missing/low-confidence vibe evidence.
- Client-controlled embedding flags, provider keys, field masks, or embedding budgets.
- Staged environment rollout; v0.1.0 is production-only with a checklist gate and kill switch.
- Open-ended model perfection. v0.1.0 quality bar is fixtures plus the narrow manual calibration pass.
- Writing implementation tickets/tracer bullets as part of this PRD.

## Further Notes

This PRD is governed by [[../../60_engineering/adr/0022-google-places-primary-provider|ADR 0022]] and [[../../60_engineering/adr/0023-transient-vibe-embeddings-in-scoring|ADR 0023]]. ADR 0022 controls Google Places retention, attribution, field-mask, and provider boundary decisions. ADR 0023 controls transient Vibe embeddings, model/provider choice, and scoring behavior.

The Places migration has already landed, but implementation must still verify the active Google scoring seam before adding embeddings. If the active code still has legacy `reputation` or FSQ-era names in the path that actually feeds Q5/verdict scoring, this work aligns that seam rather than building new embeddings on top of stale language.

The first implementation should bias toward a small, testable core: local span assembly, app-owned anchors, deterministic fake embeddings in CI, Voyage behind a thin wrapper, and controlled neutral degradation when anything is missing or disabled. The goal is better mapping quality without turning embeddings into durable provider-derived venue memory.
