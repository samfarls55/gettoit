---
status: done
type: AFK
github_issue: 351
---

# TB-07: Meal Timing And Dine-In/Takeout Eligibility

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Apply meal timing and service-mode eligibility through Google Places. Meal timing is one shared Room Parameter, not a member-specific preference. Immediate/current flows may use openNow; future flows evaluate current/regular hours. Missing hours disqualifies. Dine-in Plans require explicit dineIn support. Takeout Plans disqualify only explicit takeout false; missing takeout support does not eliminate a candidate.

This slice keeps meal timing and service mode hard where the product risk is high and softer where missing data is less costly.

## Acceptance criteria

- [ ] Meal timing is read from the single locked Room Parameter and applied consistently to Q5 and verdict candidate eligibility.
- [ ] Immediate/current timing uses the appropriate Google current/open signal; future timing uses the appropriate hours evaluation.
- [ ] Missing hours disqualifies a candidate in Q5 and verdict flows.
- [ ] Dine-in Plans require explicit dineIn true.
- [ ] Takeout Plans disqualify explicit takeout false, but do not disqualify when takeout support is missing.
- [ ] Hours and service-mode provider facts remain transient and are not persisted in durable records, logs, analytics, or receipts.
- [ ] Tests cover current/openNow, future hours, missing hours, dine-in, explicit no-takeout, and missing takeout cases.

## Blocked by

- [[tb-01-google-provider-contract-q5-name-only-cards|TB-01: Google Provider Contract To Q5 Name-Only Cards]] - GH [#345](https://github.com/samfarls55/gettoit/issues/345)
- [[tb-02-google-only-durable-storage-baseline|TB-02: Google-Only Durable Storage Baseline]] - GH [#346](https://github.com/samfarls55/gettoit/issues/346)
