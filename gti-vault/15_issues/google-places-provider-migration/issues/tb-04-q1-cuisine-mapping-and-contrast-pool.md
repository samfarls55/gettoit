---
status: done
type: AFK
github_issue: 348
---

# TB-04: Q1 Cuisine Mapping And Contrast Pool

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Update Q1 and provider fetch planning so product-facing one-word cuisine chips map server-side to Google primary types while preserving the Q5 contrast-pool behavior. The visible Q1 list is American, Mexican, Italian, Japanese, Chinese, Thai, Indian, Mediterranean, Middle Eastern, Korean, Vietnamese, Seafood, and Comfort Food. Vegan is handled as dietary/profile data, not a cuisine chip. Breakfast is handled as meal timing, not a cuisine chip.

This slice should keep provider taxonomy out of the UI while making the backend query plan useful for Google Nearby Search (New).

## Acceptance criteria

- [ ] Q1 UI exposes exactly the approved chips and removes Vegan and Breakfast from cuisine selection.
- [ ] Each chip maps server-side to one or more approved Google meal-venue primary types.
- [ ] No Preference maps to the union of Q1-selectable meal-venue mappings, not all Google Food and Drink types.
- [ ] Explicit Q1 choices narrow fetch planning without acting as a hard member lock inside only those cuisines.
- [ ] Group positive cuisine support combines by union and score strength, not intersection.
- [ ] A member with one selected cuisine gets two Q5 cards from that cuisine and one contrast card when enough candidates exist.
- [ ] Mapping and contrast-pool behavior are covered by tests for one cuisine, multiple cuisines, and No Preference.

## Blocked by

- [[tb-01-google-provider-contract-q5-name-only-cards|TB-01: Google Provider Contract To Q5 Name-Only Cards]] - GH [#345](https://github.com/samfarls55/gettoit/issues/345)
