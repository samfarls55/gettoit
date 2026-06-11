---
status: ready-for-agent
type: AFK
github_issue: 352
---

# TB-08: Hard Safety Vetoes And Active Member Set

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Enforce active-member hard constraints for the Google provider flow. Hard dietary safety constraints, allergies, and Cuisine NEVERs combine by union across submitted, non-exited members and must veto candidates when not confidently satisfied. Exited members stop contributing answers, Q5 ratings, profile constraints, hard dietary constraints, price caps, Cuisine NEVERs, and vibe signals. Manual close includes only submitted, non-exited members; not-yet-submitted members impose no constraints or preferences.

This slice keeps the active decision set stable and policy-safe without inferring safety from summaries, reviews, or future embeddings.

## Acceptance criteria

- [ ] Hard dietary constraints, allergies, and Cuisine NEVERs combine by union across submitted, non-exited members.
- [ ] Candidates that violate or cannot confidently satisfy hard safety constraints are disqualified.
- [ ] Cuisine NEVERs act as hard vetoes separate from positive cuisine cravings.
- [ ] Exited members no longer contribute constraints, ratings, profile vetoes, price caps, Cuisine NEVERs, or vibe signals to the active decision.
- [ ] Manual close excludes not-yet-submitted members from constraints and preferences.
- [ ] v0.1.0 does not infer hard safety or Cuisine NEVER decisions from summaries, raw reviews, embeddings, or free text.
- [ ] Tests cover union vetoes, exited members, manual close, and no summary/embedding inference.

## Blocked by

- [[tb-02-google-only-durable-storage-baseline|TB-02: Google-Only Durable Storage Baseline]] - GH [#346](https://github.com/samfarls55/gettoit/issues/346)
