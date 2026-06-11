---
status: ready-for-agent
type: AFK
github_issue: 355
---

# TB-11: Verdict Display Refetch, Slate, And Rerolls

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Render the Google-backed live verdict from the persisted slate while refetching current display data by Google Place ID. v0.1.0 verdict display shows place name, Google Maps link, optional formatted address, and Google attribution. It does not show ratings, hours, photos, summaries, atmosphere fields, or fit score. Rerolls advance through the stored top-four slate without a new fetch-and-score cycle; unavailable slate entries are skipped without consuming a reroll burn, and a burn is consumed only when a viable replacement is presented. Slate exhaustion stops with a new-decision path rather than widening parameters or auto-fetching.

## Acceptance criteria

- [ ] Live verdict display refetches current Google display data by Place ID before rendering a recommendation.
- [ ] Verdict UI shows only place name, Google Maps link, optional formatted address, and Google attribution.
- [ ] Verdict UI does not show ratings, hours, photos, summaries, atmosphere fields, raw reviews, editorial summary, or fit score.
- [ ] Failed live winner refetch forces reroll or recompute rather than showing stale Google display content.
- [ ] Rerolls advance through the stored top-four slate without a new fetch-and-score cycle.
- [ ] Unavailable slate entries are skipped without consuming a reroll burn.
- [ ] Reroll burn is consumed only when a viable replacement is presented.
- [ ] Slate exhaustion offers a new-decision path and does not widen parameters or fetch a new slate automatically.
- [ ] Tests cover display refetch, UI field limits, attribution, failed refetch, reroll advancement, skip/no-burn, burn-on-presented, and slate exhaustion.

## Blocked by

- [[tb-10-deterministic-verdict-fetch-and-scoring-inputs|TB-10: Deterministic Verdict Fetch And Scoring Inputs]] - GH [#354](https://github.com/samfarls55/gettoit/issues/354)
