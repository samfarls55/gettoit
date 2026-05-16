---
issue: tb-12
title: Profile vetoes — per-account allergy/dietary/NEVERS storage + EBA consumption
status: ready-for-agent
type: AFK
github_issue: 73
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-12 — Profile vetoes

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (I). Covers the *profile* bucket of the three-bucket input model.

## What to build

New per-account storage for a member's allergies, dietary restrictions (vegan, halal, kosher, gluten-free, etc.), and cuisine NEVERS. The data is sticky — it persists across every session so a member configures it once. The verdict engine's EBA prune ([[tb-11-verdict-engine-rewrite|tb-11]]) consumes these as hard vetoes, so no session ever surfaces a venue that violates them.

This slice ships **storage + engine consumption only**. The profile-edit UI surface is explicitly deferred to the pre-public-launch milestone (see the v1.1 → pre-public-launch handoff). For now, document how profile values are seeded on the account record in the interim.

## Acceptance criteria

- [ ] Per-account storage exists for allergies, dietary restrictions, and cuisine NEVERS; it persists across sessions.
- [ ] The EBA prune drops any venue that violates a member's profile vetoes.
- [ ] Verdict-engine tests cover profile-veto pruning.
- [ ] No profile-edit UI in this slice (deferred to pre-public-launch); the interim seeding path is documented.

## Blocked by

- [[tb-11-verdict-engine-rewrite|tb-11]] — the EBA prune is the consumer of the profile vetoes.
