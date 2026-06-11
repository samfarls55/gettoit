---
status: ready-for-agent
github_issue: 344
---

# Google Places Provider Migration PRD

## Problem Statement

GetToIt's current candidate-pool system still carries Foursquare / MapKit assumptions in provider calls, schema, telemetry, Q5 candidate generation, verdict shaping, and historical display. That provider model no longer fits the product. Vibe is load-bearing for the Q5 preference probe and verdict quality, and the product needs Google Places Enterprise + Atmosphere fields to support the next stage of recommendation quality.

The migration must not merely swap API endpoints. It must keep the product inside Google's storage, attribution, field-mask, and cost-control boundaries while preserving GetToIt's core behavior: real Q5 candidates, a trustworthy verdict, rerolls from a stored slate, and Plan history that remains useful without storing third-party display content.

## Solution

Switch the candidate-pool provider entirely to Google Places API. Google Places becomes the only active provider for Q5 probe fetches, verdict candidate fetches, and current display refetches. Foursquare / MapKit runtime behavior, fallback paths, provider config, schema artifacts, telemetry streams, and executable migration history are removed from the active v0.1.0 baseline.

All Google calls go through a Supabase Edge Function. The Edge Function owns Google API key custody, field masks, response shaping, redaction, attribution payloads, rate limits, per-Room budgets, cost guardrails, and provider policy enforcement. Mobile and web clients render assigned Q5 cards and verdict output; they do not call Google directly and do not rank candidates locally.

Durable storage keeps app-owned state and provider identity only: `place_provider = "google"`, Google Place ID, Room / Plan / verdict IDs, Q5 votes, outcome labels, winner / reroll metadata, top-four Verdict slate IDs, final aggregate Verdict fit scores, scoring version, decided timestamp, and app-owned receipts / reason codes. Google place display content is transient. Q5, live verdict, read-only verdict, and history surfaces refetch current Google display data by Place ID when they need to show it.

## User Stories

1. As a Plan member, I want Q5 cards to use current real Google places, so that I rate actual options instead of placeholders.
2. As a Plan member, I want Q5 cards to show only the place name in v0.1.0, so that the choice stays focused and uncluttered.
3. As a Plan member, I want Google attribution wherever Google place content appears, so that the app is transparent about source data.
4. As a Plan member, I want Q5 to keep three cards with one differing axis each, so that my ratings still teach the app what tradeoff matters.
5. As a Plan member, I want Q5 axes to reflect cuisine, crowd approval, and vibe, so that the probe matches what makes a meal decision feel right.
6. As a Plan member, I want a same-axis replacement if a Q5 card becomes unavailable before I see it, so that the probe remains fair.
7. As a Plan member, I want already-seen Q5 card positions preserved when a visible card is replaced, so that the interaction does not reshuffle under me.
8. As a Plan member, I want one fresh Q5 retry if the visible card set fails, so that transient provider issues do not silently drop me.
9. As a Plan member, I want Q5 to fail cleanly when it cannot preserve the probe shape, so that the app does not infer preferences from a broken card set.
10. As a Plan member, I want no-results behavior instead of low-quality recommendations, so that the app avoids sending me somewhere bad.
11. As a Plan member, I want vibe to relax before hard constraints when the pool is thin, so that the app can find reasonable alternatives without violating requirements.
12. As a Plan member, I want price cap, meal timing, Search area, dine-in needs, dietary hard needs, and Cuisine NEVERs respected, so that core constraints do not get silently widened.
13. As a Plan member, I want missing price or hours to disqualify a candidate, so that the app does not recommend a place with basic trust gaps.
14. As a Plan member, I want dine-in Plans to require explicit dine-in support, so that a social meal is not sent to a place that cannot host us.
15. As a Plan member, I want takeout Plans to disqualify only explicit no-takeout evidence, so that lower-risk uncertainty does not over-prune the pool.
16. As a Plan member with allergies or hard dietary restrictions, I want every active participant's hard needs enforced by union, so that the recommendation is safe enough to present.
17. As a Plan member with Cuisine NEVERs, I want those vetoes enforced by union, so that one person's hard no rules out the candidate for the group.
18. As a Plan member, I want soft cuisine cravings treated as positive signals, so that the group can still find a good fit without strict intersection.
19. As a Plan member selecting one cuisine, I want two Q5 cards from that cuisine and one contrast card, so that the app can test whether cuisine truly matters to me.
20. As a Plan member selecting multiple cuisines, I want Q5 to show feasible cuisine keep cards and a contrast card, so that the probe measures axis weight rather than displaying every selected cuisine.
21. As a Plan member selecting No Preference, I want the app to use the shared no-preference meal-venue pool, so that I am not forced into an arbitrary cuisine.
22. As a Plan member, I want explicit cuisine choices to use product-facing one-word labels, so that Q1 feels human instead of provider-taxonomy-shaped.
23. As a Plan member, I want American, Mexican, Italian, Japanese, Chinese, Thai, Indian, Mediterranean, Middle Eastern, Korean, Vietnamese, Seafood, and Comfort Food as Q1 chips, so that common meal cravings are covered.
24. As a Plan member, I want vegan handled as dietary/profile data rather than a cuisine chip, so that it protects safety/identity rather than acting like a craving.
25. As a Plan member, I want breakfast handled as meal timing rather than cuisine, so that time-of-day logic stays separate from food style.
26. As a Plan member, I want the selected Search area to be the hard geography boundary, so that candidates outside the circle cannot win.
27. As a Plan member, I do not want distance inside the Search area to affect ranking, so that closer does not unfairly beat better fit.
28. As an initiator, I want Search area, meal timing, and dine-in/takeout mode locked once the Room is minted, so that the group is deciding against one stable setup.
29. As an initiator, I want changing Room parameters to mean starting a new decision, so that active decisions do not mutate under participants.
30. As an initiator, I want manual close to decide only for submitted, non-exited members, so that absent members do not impose unseen constraints.
31. As an exiting member, I want my answers and constraints removed from the active decision set, so that I no longer steer a social plan I left.
32. As a waiting group member, I want the verdict to compile group constraints and Q5 signals into a final candidate fetch plan, so that the winner is based on the submitted group.
33. As a waiting group member, I want the final verdict fetch to be deterministic, so that provider quirks do not create unpredictable winners.
34. As a waiting group member, I want chunked provider results merged by Google Place ID when chunking is required, so that duplicates do not boost a candidate.
35. As a waiting group member, I do not want Google result order, chunk order, duplicate appearance, provider ranking, or distance inside the circle to decide ranking, so that GetToIt's score owns the verdict.
36. As a waiting group member, I want every eligible candidate in the final merged pool scored, so that no hidden provider ordering shortcut decides the result.
37. As a Plan member, I want the verdict surface to show place name, Google Maps link, and optionally formatted address, so that I can act on the recommendation.
38. As a Plan member, I do not want ratings, hours, photos, summaries, atmosphere fields, or fit score shown in v0.1.0 verdict UI, so that the first release stays action-minimal.
39. As a Plan member, I want Google Maps links refetched or derived at render time, so that the app does not store stale provider display content.
40. As a Plan member, I want live verdict display to refetch current display data by Place ID, so that the place details are current when I act.
41. As a Plan member, I want a failed live winner refetch to force reroll or recompute, so that the group is not sent to a dead place.
42. As an initiator, I want rerolls to advance through a stored top-four Verdict slate, so that rerolls do not require a new fetch-and-score cycle.
43. As an initiator, I want unavailable slate entries skipped without burning a reroll, so that technical/provider availability does not consume my limited rerolls.
44. As an initiator, I want a reroll burn consumed only when a viable replacement is presented, so that the burn count matches user-visible value.
45. As an initiator, I want slate exhaustion to stop with a new-decision CTA, so that the app does not secretly widen Room parameters.
46. As a Plan history viewer, I want history to refetch current Google display data by Place ID, so that past decisions do not store stale Google display snapshots.
47. As a Plan history viewer, I want degraded history when refetch fails, so that I still see app-owned Plan context without stale place data.
48. As a Plan history viewer, I want degraded history to show Plan name, decided time, Place unavailable, and unavailable details, so that the record remains understandable.
49. As a Plan history viewer, I do not want stale place names shown after refetch failure, so that the app stays inside Google display-content boundaries.
50. As a founder, I want durable storage to keep Google Place IDs and app-owned learning records, so that the product can improve without storing forbidden display data.
51. As a founder, I want final aggregate Verdict fit scores stored, so that future scoring work can learn from room-specific fit.
52. As a founder, I want fit score treated as room-specific, not objective venue quality, so that it is not misused across contexts.
53. As a founder, I want component scores that reconstruct provider facts kept transient, so that durable learning data stays policy-safe.
54. As a founder, I want outcome labels stored as app-owned behavioral signals, so that later analysis can learn from voted, accepted, rerolled, skipped, and abandoned outcomes.
55. As a founder, I want reason codes controlled and append-only, so that analytics remains stable and provider-display leakage risk stays low.
56. As a founder, I want no user-authored free-text reasons in v0.1.0, so that privacy and provider-content leakage risk stay lower.
57. As a founder, I want Q5 non-response recorded as an outcome label when a member exits or leaves incomplete, so that future analysis sees missing-signal patterns.
58. As a founder, I want candidate keep/cut receipts stored only as lean app-owned reason codes, so that auditability does not become a provider-fact archive.
59. As a founder, I want logs and analytics treated as durable storage for policy purposes, so that display content does not leak through observability.
60. As a founder, I want operational logs to prefer app IDs, counts, status, errors, latency, field-mask/SKU labels, and reason summaries, so that debugging remains useful without storing Google content.
61. As a founder, I want Google Place IDs in logs only when needed for access-controlled short-retention debugging, so that operational traces do not become analytics archives.
62. As a founder, I want overfetch telemetry only as aggregate counts and radii, so that edge-effect analysis does not store per-place identifiers.
63. As a founder, I want no durable Places response cache, so that GetToIt does not recreate the old Foursquare cache pattern under Google.
64. As a founder, I want per-request in-memory dedupe allowed, so that one flow can be efficient without becoming durable cache.
65. As a founder, I want reviewSummary and generativeSummary requested for validation and future learning design, so that vibe roadmap work has real provider shape to inspect.
66. As a founder, I do not want raw reviews or editorialSummary in v1, so that the first migration limits policy and product surface area.
67. As a founder, I want summaries excluded from v0.1.0 UI and ranking, so that embeddings/scoring changes happen in a separate future design.
68. As a founder, I want hard dietary safety and Cuisine NEVERs not inferred from summaries or future embeddings in v0.1.0, so that false confidence does not create high-cost failures.
69. As a founder, I want missing atmosphere/summaries to hurt vibe confidence but not disqualify, so that useful places are not over-eliminated by soft-field gaps.
70. As a founder, I want missing rating/count to disqualify, so that public-trust gaps do not become bad recommendations.
71. As a founder, I want rating >= 3.7 and userRatingCount >= 15 as the v0.1.0 floor, so that the app has a minimum quality standard.
72. As a founder, I want higher combined rating and count preferred above the floor, so that a strong public signal still helps ranking.
73. As a platform owner, I want all Google field masks server-owned and versioned, so that clients cannot widen cost or data exposure.
74. As a platform owner, I want field-mask version stored only as operational metadata when useful, so that returned Google fields do not become durable by association.
75. As a platform owner, I want quota, budget, and cost guardrail failures to fail closed, so that the app does not skip attribution or fall back to a forbidden provider path.
76. As a platform owner, I want guardrail failure receipts stored without provider payloads or display content, so that failures are auditable and policy-safe.
77. As a platform owner, I want bounded server-side retries for transient Google failures, so that temporary provider issues do not immediately break flows.
78. As a platform owner, I want hard Google failures not retried, so that invalid configs, permissions, and NOT_FOUND cases fail cleanly.
79. As a platform owner, I want clients to receive final app decisions rather than run Google retry loops, so that policy and budget control stay server-side.
80. As a platform owner, I want active Supabase migration history rewritten or squashed to a clean baseline, so that fresh local/CI resets do not recreate FSQ or MapKit artifacts.
81. As a platform owner, I want already-applied remote migrations followed by cleanup migrations if they cannot be rewritten, so that the active schema still ends Google-only.
82. As a developer, I want ADR 0022 and CONTEXT.md to be authoritative for this migration, so that older docs can remain historical without confusing active implementation.
83. As a developer, I want old FSQ/MapKit references marked superseded when touched, so that doc cleanup happens where implementation actually works.
84. As a developer, I want tests that prove forbidden Google display content is not persisted, so that policy boundaries are verified in code.
85. As a developer, I want tests around no-results, refetch failure, slate/reroll, guardrail failure, and storage-policy boundaries, so that the risky flows stay protected.

## Implementation Decisions

- Google Places API fully replaces Foursquare / MapKit for candidate-pool work.
- Foursquare / MapKit provider code, fallback branches, env vars, config, schema artifacts, telemetry streams, and active migration paths are removed for v0.1.0.
- Supabase migration history for the active baseline is rewritten / squashed when possible; if an already-applied remote migration must remain, a follow-up cleanup migration removes FSQ / MapKit artifacts before the schema is valid.
- Google calls run only through a Supabase Edge Function.
- The provider Edge Function owns API key custody, request construction, field masks, response shaping, redaction, attribution payloads, logging redaction, rate limiting, cost controls, per-Room budgets, and guardrails.
- Clients cannot choose field masks, widen constraints, increase call counts, rank Google candidates, or call Google directly.
- Edge Function responses that contain Google display content include the required attribution payload / render instruction for the current surface.
- Q5 display payload includes Google Place ID, current display name, and attribution payload; v0.1.0 Q5 does not show summaries, ratings, hours, photos, addresses, or atmosphere fields.
- Verdict display payload includes Google Place ID, current display name, Google Maps link, optional formatted address, and attribution payload.
- The Edge Function does not return summaries to clients in v0.1.0 when they are not displayed.
- Enterprise + Atmosphere fields are requested for server-side validation and future design: structured atmosphere fields, reviewSummary, and generativeSummary.
- Raw reviews and editorialSummary are excluded from v1.
- No durable Google display content is stored: no names, addresses, Maps URI, summaries, raw payloads, ratings, hours, price, atmosphere, types, photos, or distance.
- Durable app state may store Google Place ID, place_provider, Room / Plan / verdict IDs, votes, outcome labels, reason codes, final aggregate Verdict fit score, scoring version, top-four Verdict slate, winner / reroll metadata, decided timestamp, and app-owned receipts.
- Persisted rule text must be place-name-free. Venue-name copy is composed only after current refetch.
- Current display surfaces refetch Google display data by Place ID. Plan history degrades to app-owned content if refetch fails.
- The Candidate pool remains transient except for the top-four Verdict slate and lean receipts.
- The final aggregate Verdict fit score is app-owned and room-specific. It is not an objective venue score and is not shown in v0.1.0 UI.
- Provider-fact component scores remain transient and are not stored.
- Q1 craving chips are American, Mexican, Italian, Japanese, Chinese, Thai, Indian, Mediterranean, Middle Eastern, Korean, Vietnamese, Seafood, and Comfort Food.
- Vegan is profile/dietary data, not a Q1 chip. Breakfast is meal timing, not a Q1 chip.
- Q1 chips map server-side to one or more Google primary types. "No preference" maps to the union of Q1-selectable meal-venue mappings, not every Google Food and Drink type.
- Selected Q1 chips narrow fetch planning but do not hard-lock a member inside those cuisines. The planner keeps contrast / no-preference coverage where budget and provider limits allow.
- Group positive cuisine support combines by union and score strength, not intersection.
- Cuisine NEVERs combine by union as hard vetoes.
- Q2 price is a cap. The group effective cap is the strictest submitted, non-exited member cap. Missing Google price disqualifies.
- Meal timing is a single shared Room Parameter. Immediate/current flows may use openNow; otherwise the server evaluates current / regular hours. Missing hours disqualifies.
- Dine-in requires explicit dineIn true. Takeout disqualifies only explicit takeout false.
- Hard dietary safety constraints combine by union across submitted, non-exited members and must be confidently satisfied or disqualify a candidate.
- Vibe is a qualitative 1-5 band and may widen when pools are thin. It is not a hard group intersection.
- Missing atmosphere fields or summaries hurt vibe confidence but do not disqualify.
- Crowd approval quality floor is platform-owned: rating >= 3.7 and userRatingCount >= 15. Missing rating or count disqualifies.
- Stronger combined rating/count evidence above the floor remains preferred, but exact scoring math is deferred.
- Search area is one initiator-set Room Parameter. It is immutable after launch, shared by all members, and hard binary eligibility.
- Distance inside the committed Search area does not affect scoring, ranking, or tie-breaking.
- The provider layer may overfetch by committed radius plus min(radius * 0.15, 0.5 mi / 805 m), then trims to the committed Search area before Q5 or verdict use.
- Overfetch telemetry stores only aggregate radii and counts, no Place IDs or per-place identifiers.
- Q5 preserves strict-factorial shape with axes cuisine, crowd approval, and vibe.
- Q5 uses deterministic app-owned shuffle keyed to member and q5_card_set_id. Google result order is not a display or learning signal.
- Q5 replacement must preserve the failed card's axis role. If not possible after visibility, the member gets one fresh retry under the same locked Room parameters.
- Exited members stop contributing answers, Q5 ratings, profile constraints, hard dietary constraints, price caps, Cuisine NEVERs, and vibe signals to the active decision set.
- Manual close includes only submitted, non-exited members. Not-yet-submitted members impose no constraints or preferences.
- Verdict uses a separate final group-level fetch plan from Q5 probe fetches.
- "One fetch" means one deterministic verdict fetch cycle. Deterministic chunking is allowed inside server-owned budget when provider limits require it.
- Chunk results merge by Google Place ID. Duplicate appearance does not boost. Chunk order, Google ordering, provider ranking, and distance inside the circle are ignored for ranking and tie-breaking.
- Every candidate that survives final eligibility is scored in v0.1.0.
- Verdict persistence stores up to four ranked Google Place IDs as the Verdict slate.
- Rerolls advance through the existing slate without a new fetch-and-score cycle, while refetching the selected Place ID before display.
- Unavailable slate entries are skipped without consuming a reroll burn. A burn is consumed only when a viable recommendation is presented.
- Slate exhaustion does not widen parameters or fetch a new slate. The recovery path is starting a new decision / Room.
- Outcome labels are durable app-owned learning signals. System skips/refetch failures are operational receipts, not outcome labels.
- Reason codes are app-authored, controlled, place-name-free, provider-fact-free, stable, and append-only once released.
- Logs, telemetry, and analytics are durable for policy purposes and must not include Google display content, provider facts, raw responses, or stale place names.
- No durable Places cache exists in v0.1.0. Per-request / in-memory dedupe is allowed.
- The provider migration is done only when no active FSQ / MapKit references remain in code, config, env vars, schema, migrations, Edge Functions, tests, or telemetry; Google provider contracts own current display and attribution; Q5/verdict storage keeps only policy-safe state; history refetch/degraded states work; and tests cover no-results, refetch failure, slate/reroll, guardrails, and storage boundaries.

Major seams to use:

- Supabase provider Edge Function seam for Google calls, redaction, field masks, attribution, budgets, and guardrails.
- Supabase schema / migration seam for Google identity, Verdict slate, receipts, and removal of FSQ / MapKit artifacts.
- Q5 candidate repository / card-generation seam for member probe fetches, card display payload, replacement, retry, and telemetry.
- Verdict computation seam for final fetch planning, eligibility, scoring inputs, tie-breaking, slate persistence, reroll, and no-results.
- Mobile verdict / Q5 repositories and screen-model seams for rendering current display payloads and degraded states.
- Web fallback / read-only verdict seams for invitee and history display behavior.
- Observability seams for logs, analytics, telemetry, reason codes, and storage-policy redaction.

## Testing Decisions

Good tests assert external behavior and policy boundaries, not implementation detail. Provider tests should assert request shape, field-mask ownership, response shaping, attribution payloads, redaction, budgets, and failure behavior. Storage tests should assert what is persisted and, just as importantly, what is not persisted. Product-flow tests should assert Q5, verdict, reroll, and history outcomes from user-visible states and durable records.

Modules / seams that need tests:

- Google provider Edge Function request construction, named field-mask contracts, attribution payloads, response shaping, and redaction.
- Guardrail behavior for quota exhaustion, per-Room budget exhaustion, and cost guardrail blocking.
- Storage-policy tests proving names, addresses, Maps URI, summaries, ratings, hours, price, atmosphere fields, photos, raw payloads, provider facts, and provider-fact component scores are not durable.
- Supabase migration tests proving a fresh reset does not recreate FSQ / MapKit active schema artifacts.
- Q1 chip mapping tests for each product-facing chip and No Preference union behavior.
- Q2 price cap tests for cap semantics, strictest-member group cap, and missing-price disqualification.
- Meal-time eligibility tests for current/openNow flow, future hours evaluation, and missing-hours disqualification.
- Dine-in / takeout asymmetry tests.
- Hard dietary safety and Cuisine NEVER union-veto tests.
- Search area trimming tests, including allowed overfetch and distance-not-scoring behavior.
- Q5 strict-factorial card-generation tests for one selected cuisine, multiple selected cuisines, No Preference, contrast pool, deterministic shuffle, replacement, and retry.
- Q5 no-results tests when same-axis card shape cannot be formed.
- Final verdict fetch-cycle tests for deterministic chunk merge by Google Place ID, duplicate handling, and rejection of provider order as ranking input.
- Verdict eligibility and ranking-input tests for crowd floor, vibe relaxation, missing soft atmosphere/summaries, and missing hard quality metadata.
- Verdict slate persistence tests for top-four Place IDs, rank, final aggregate fit score, scoring version, and no display content.
- Reroll tests for advancing through the slate, skipping unavailable entries, burn consumption, and slate exhaustion.
- Refetch tests for transient retry, hard failure handling, live verdict reroll/recompute, and degraded history.
- UI tests for Q5 name-only display with attribution, action-minimal verdict display with attribution, and degraded history without attribution.
- Outcome label, reason code, receipt, log, analytics, and telemetry tests for controlled vocabulary and provider-content redaction.

Prior art:

- Existing Supabase Edge Function tests around `places-proxy`, `compute-verdict`, verdict firing, no-survivor handling, and reroll behavior.
- Existing mobile tests around Q5 factorial behavior, Q5 candidate repository behavior, verdict repository behavior, VerdictScreen rendering, SearchAreaPicker, and app routing.
- Existing web tests around candidate fetch, quiz, Waiting, read-only verdict, invite shell, and Places empty states.

## Out of Scope

- Exact scoring formula, weights, normalization, and formula tuning.
- Summary-derived embeddings or durable embedding artifacts.
- Using reviewSummary or generativeSummary in v0.1.0 ranking.
- Displaying summaries, ratings, hours, photos, atmosphere fields, raw reviews, editorialSummary, or fit score in v0.1.0 UI.
- Raw review ingestion.
- User-authored free-text reason capture.
- Member-specific Search areas or per-member radii.
- Distance-based scoring inside the committed Search area.
- Text Search for typed cuisine / place intent.
- Any Foursquare or MapKit fallback.
- Durable Google Places response cache.
- Auto-fetching a new slate after reroll slate exhaustion.
- Mutating active Room parameters after launch.
- Mass-editing old historical docs that mention FSQ / MapKit unless implementation touches them.
- Breaking this PRD into implementation issues.

## Further Notes

ADR 0022 and `CONTEXT.md` are authoritative for provider migration behavior. Older PRDs, surface docs, and design notes may still mention FSQ / MapKit until touched; touched references should be marked superseded by ADR 0022 rather than mass-edited during PRD creation.

Google policy reading from the grill drives the conservative storage stance: Place IDs can be retained, but place display content and provider facts are refetched for current display and not preserved in durable history. Logs and analytics are treated as durable storage, so the same boundary applies there.

The future scoring-engine / embeddings grill should revisit exact scoring math, atmosphere/summary use, embeddings retention policy, and how Q5-inferred axis weights interact with summary-derived vibe signals.
