---
status: done
type: AFK
github_issue: 354
---

# TB-10: Deterministic Verdict Fetch And Scoring Inputs

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Build the Google-backed final verdict fetch cycle. Verdict does not reuse Q5 probe fetches as the final source of truth; it compiles submitted, non-exited member constraints and Q5 signals into one deterministic final fetch cycle. Chunking is allowed inside the server-owned budget when provider limits require it. Results merge by Google Place ID; duplicate appearance, chunk order, Google ordering, provider ranking, and distance inside the circle do not affect rank or tie-breaks. Every candidate that survives final eligibility is scored, and up to four ranked Google Place IDs are persisted as the Verdict slate with app-owned fit score and receipts.

This is intentionally a larger vertical slice because fetch planning, eligibility, scoring inputs, deterministic merge, and slate persistence must be proven together.

## Acceptance criteria

- [ ] Verdict uses a separate final group-level Google fetch cycle derived from submitted, non-exited members.
- [ ] Deterministic chunking is used only when needed for provider limits or budget constraints.
- [ ] Chunk results merge by Google Place ID and duplicates do not boost a candidate.
- [ ] Google result order, chunk order, provider ranking, duplicate appearance, and distance inside the Search area are not ranking or tie-breaking inputs.
- [ ] Every candidate surviving final eligibility is scored in v0.1.0.
- [ ] Final aggregate fit score is persisted as app-owned, room-specific learning data and is not shown in UI.
- [ ] Provider-fact component scores remain transient and are not persisted.
- [ ] Verdict slate persists up to four ranked Google Place IDs with rank, fit score, scoring version, and place-name-free receipts.
- [ ] Tests cover deterministic fetch planning, chunk merge, duplicate handling, ranking-input exclusions, eligibility, and slate persistence.

## Blocked by

- [[tb-04-q1-cuisine-mapping-and-contrast-pool|TB-04: Q1 Cuisine Mapping And Contrast Pool]] - GH [#348](https://github.com/samfarls55/gettoit/issues/348)
- [[tb-05-price-cap-and-quality-metadata-eligibility|TB-05: Price Cap And Quality Metadata Eligibility]] - GH [#349](https://github.com/samfarls55/gettoit/issues/349)
- [[tb-06-locked-room-parameters-and-search-area-eligibility|TB-06: Locked Room Parameters And Search Area Eligibility]] - GH [#350](https://github.com/samfarls55/gettoit/issues/350)
- [[tb-07-meal-timing-and-dine-in-takeout-eligibility|TB-07: Meal Timing And Dine-In/Takeout Eligibility]] - GH [#351](https://github.com/samfarls55/gettoit/issues/351)
- [[tb-08-hard-safety-vetoes-and-active-member-set|TB-08: Hard Safety Vetoes And Active Member Set]] - GH [#352](https://github.com/samfarls55/gettoit/issues/352)
