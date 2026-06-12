---
status: done
type: AFK
github_issue: 350
---

# TB-06: Locked Room Parameters And Search Area Eligibility

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Treat Search area as one initiator-set Room Parameter that becomes immutable once the Room is minted. Candidates outside the committed Search area cannot be used. Distance inside the committed Search area is never a score, ranking input, or tie-breaker. The provider layer may overfetch by committed radius plus `min(radius * 0.15, 0.5 mi / 805 m)`, but must trim back to the committed Search area before Q5 or verdict use and store only aggregate overfetch telemetry.

This slice turns location into a hard eligibility boundary rather than a ranking signal.

## Acceptance criteria

- [ ] Search area is locked after Room creation; attempts to mutate active Room parameters fail or require starting a new decision.
- [ ] Candidates outside the committed Search area are trimmed before Q5 display or verdict scoring.
- [ ] Distance inside the Search area is not used for score, ranking, tie-breaking, receipt wording, or UI ordering.
- [ ] Allowed overfetch is capped at `min(radius * 0.15, 0.5 mi / 805 m)` beyond the committed radius.
- [ ] Overfetch telemetry stores only aggregate radii and counts, with no Place IDs or per-place identifiers.
- [ ] Tests cover immutability, boundary trimming, overfetch cap, and distance-not-scoring behavior.

## Blocked by

- [[tb-01-google-provider-contract-q5-name-only-cards|TB-01: Google Provider Contract To Q5 Name-Only Cards]] - GH [#345](https://github.com/samfarls55/gettoit/issues/345)
- [[tb-02-google-only-durable-storage-baseline|TB-02: Google-Only Durable Storage Baseline]] - GH [#346](https://github.com/samfarls55/gettoit/issues/346)
