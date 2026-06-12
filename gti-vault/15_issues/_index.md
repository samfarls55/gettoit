---
folder: 15_issues
purpose: Issue tracker â€” features, PRDs, and implementation tickets
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 15_issues â€” Index

Vault-based issue tracker. One subdirectory per version cycle; each holds the PRD plus numbered implementation issues.

## Conventions

- `<version-cycle>/issues/<NN>-<slug>.md` â€” implementation tickets, numbered from `01`
- Triage state in YAML frontmatter: `status: needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix`
- Cross-reference with `[[wikilinks]]`. Append discussion under `## Comments` at the bottom of each note.

See `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` for the full agent contract.

## Cycles

- [[vibe-embeddings-scoring/_index|vibe-embeddings-scoring]] - Transient backend embeddings for Vibe fit signal generation, governed by [[../60_engineering/adr/0023-transient-vibe-embeddings-in-scoring|ADR 0023]] and ADR 0022's Google Places retention boundary.

- [[google-places-provider-migration/_index|google-places-provider-migration]] - Google Places API replacement for Foursquare / MapKit provider behavior, governed by [[../60_engineering/adr/0022-google-places-primary-provider|ADR 0022]].

- [[expo-mobile-rewrite/_index|expo-mobile-rewrite]] - full pre-launch migration of the mobile iOS client to Expo managed React Native + TypeScript.

- [[0.1.0/_index|0.1.0]] â€” pre-launch development cycle. Collapses the former `v1`, `v1.1`, and `workflow-overhaul` batches into a single named cycle (since `v1` is reserved for the first public-launch release). Three organizational phases:
    - [[0.1.0/dogfood-phase|Dogfood phase]] â€” first-install TestFlight feedback (2026-05-14 onward), quiz redesign ([[../10_prds/0.1.0-quiz-redesign-prd|0.1.0-quiz-redesign-prd.md]]), Q5-wiring fix, premium-data follow-ups, post-Q5 router fix, verdict-pipeline integration, candidate-pool floor, verdict-spinner diagnosis, solo-session post-mortem, AFK-run follow-ups, UI dogfood batch.
    - [[0.1.0/workflow-overhaul-phase|Workflow-overhaul phase]] â€” Plans as persistent named items, list-as-landing, collapsed Setup screen, three nav verbs (Back/Exit/Delete), web invitee shell + account-claim bridge ([[../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]], [[../60_engineering/adr/0014-web-consumes-shared-votes-wire|ADR 0014]], [[../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]], [[../60_engineering/adr/0016-plan-reroll-window-enforcement|ADR 0016]]).
    - [[0.1.0/search-area-picker-prd|Search area picker PRD]] â€” C-28 SearchAreaPicker replacement for active Setup geography controls (GH [#316](https://github.com/samfarls55/gettoit/issues/316)).

All `tb-NN-*` / `bug-NN-*` / `sg-NN-*` / `tb-wf-N-*` / `sg-wf-N-*` files live flat in [[0.1.0/issues|0.1.0/issues/]].

## Runs

- [[_runs/_index|_runs/]] â€” AFK execution run logs from `/execute-issues`. One file per run, named `<YYYY-MM-DD-HHmm>-afk-execution-log.md`.
