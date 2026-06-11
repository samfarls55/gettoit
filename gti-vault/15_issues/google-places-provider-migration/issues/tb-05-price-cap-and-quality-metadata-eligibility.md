---
status: ready-for-agent
type: AFK
github_issue: 349
---

# TB-05: Price Cap And Quality Metadata Eligibility

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Apply platform and group eligibility rules that depend on Google price and public quality metadata. Q2 price is a cap, not an exclusive bucket. The group effective cap is the strictest submitted, non-exited member cap. Missing Google price disqualifies. Public quality floor is platform-owned: rating >= 3.7 and userRatingCount >= 15. Missing rating or count disqualifies. Above the floor, stronger combined rating/count evidence remains a positive ranking signal, while exact scoring math remains deferred to the scoring engine.

This slice should make these constraints work for both Q5 candidate generation and final verdict candidate eligibility without persisting Google provider facts.

## Acceptance criteria

- [ ] Price cap semantics use the strictest submitted, non-exited member cap for group eligibility.
- [ ] Missing Google price disqualifies a candidate in Q5 and verdict flows.
- [ ] Rating below 3.7 or userRatingCount below 15 disqualifies a candidate in Q5 and verdict flows.
- [ ] Missing rating or missing userRatingCount disqualifies a candidate in Q5 and verdict flows.
- [ ] Higher combined rating/count evidence is available as a transient ranking input above the floor.
- [ ] Price, rating, and count are not persisted in durable app records, logs, analytics, receipts, or slate records.
- [ ] Tests cover cap semantics, missing metadata, floor failures, and above-floor preference.

## Blocked by

- [[tb-01-google-provider-contract-q5-name-only-cards|TB-01: Google Provider Contract To Q5 Name-Only Cards]] - GH [#345](https://github.com/samfarls55/gettoit/issues/345)
- [[tb-02-google-only-durable-storage-baseline|TB-02: Google-Only Durable Storage Baseline]] - GH [#346](https://github.com/samfarls55/gettoit/issues/346)
