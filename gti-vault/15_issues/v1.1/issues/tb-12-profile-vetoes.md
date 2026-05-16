---
issue: tb-12
title: Profile vetoes — per-account allergy/dietary/NEVERS storage + EBA consumption
status: done
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

## Comments

**2026-05-16 — done (AFK, PR closes #73).** Storage + verdict-engine consumption shipped; no profile-edit UI (deferred to pre-public-launch).

- **Storage** — new `user_preferences.profile_vetoes` jsonb column (migration `20260515020000000_user_profile_vetoes.sql`). It is a jsonb array of `{ kind, token }` `HardVeto` objects (`kind` ∈ `dietary | cuisine_never | tag`). Lives on `user_preferences` rather than a new table — that migration explicitly declares the table the wide-open home for sticky per-user state. A DB `CHECK` enforces "is a jsonb array"; per-element validation is in the Edge reader. Persists across every session (one row per `auth.users.id`).
- **Engine consumption** — `compute-verdict` gained a `fetchProfileVetoes(user_ids)` data-adapter method. The handler reads each voting member's stored profile vetoes and unions them into that member's `hard_vetoes` channel (via `mergeHardVetoes`, deduped on `(kind, token)`) before calling the engine. No new engine path — it feeds the generic `hard_vetoes` channel tb-11 added. The `votes-schema.ts` `profile_veto` question kind is the symmetric per-session mapping; both routes land in the same channel.
- **Interim seeding** — documented in the migration header: a direct `INSERT … ON CONFLICT … DO UPDATE` UPSERT on `user_preferences.profile_vetoes` (service-role or SQL editor). The existing `user_preferences` RLS already lets the owning user write their own row, so the future profile-edit screen UPSERTs the same column with the user's JWT — no schema change when the UI lands.
- **Tests** — verdict-engine fixture tests for `dietary` / `tag` / `cuisine_never` profile-veto pruning + room-wide veto fan-out; `compute-verdict` handler tests for stored-profile pruning, session∪profile union, and the no-profile-row path; `mergeHardVetoes` unit tests. Full `deno test` suite green (165 passed).
