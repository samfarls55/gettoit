---
issue: research-01
title: Foursquare Places API filter-surface + venue-metadata research
status: done
type: AFK
github_issue: 64
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

# research-01 — Foursquare filter-surface research

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] — prerequisite research task (PRD "Out of Scope"). Unblocks the reputation and vibe axis scorers and the per-member fetch planner.

## What to build

A research spike — **no code ships**. Investigate the Foursquare Places API request surface and venue-response payload, and produce a vault document that fixes two things the rest of 0.1.0 depends on:

1. **Fetch-time filters** — which request parameters can legitimately strict-filter a fetch (category, price, hours / open-at, radius, location) and how each PRD input (Q2 spend cap, parameter geo / meal-time / transport radius, profile dietary) maps onto them.
2. **Client-side-scored metadata** — which venue-response fields are available to score the reputation axis (Popular / Hidden gem / Classic / New) and the vibe axis (Quiet → Chill → Social → Lively → Rowdy) *after* the fetch, since neither can strict-filter (the Q5 factorial needs reputation and vibe variety in every pool).

The output doc fixes the metadata mapping that PRD module (E) axis scorers consume and the filter surface that module (D) fetch planner consumes.

## Acceptance criteria

- [ ] Vault doc enumerates the Foursquare Places API request parameters usable as fetch-time filters, with each PRD input mapped to a parameter (or flagged as not filterable).
- [ ] Doc enumerates venue-response metadata fields and proposes a concrete mapping for the reputation axis (Popular / Hidden gem / Classic / New / No preference) and the vibe axis (5-point energy scale).
- [ ] Doc confirms reputation and cuisine cannot be strict fetch filters and records what signal each axis scorer must instead derive from.
- [ ] Doc addresses the graded-axis open question — vibe is cardinal but the factorial treats axes as binary keep/drop — with a recommendation for what "drop the vibe axis" means.
- [ ] Doc is filed in the vault (`60_engineering/` or `50_product/`), linked from the PRD and this issue index. No application code changed.

## Blocked by

None — can start immediately. This is the top-priority issue: tb-07, tb-08, and tb-09 all block on it.

## Comments

- 2026-05-16 — Done via PR #75 (squash-merged as `c253430`). Research bundle filed at `60_engineering/research/foursquare-filter-surface-2026-05/` (`report.md` + `_index.md`). GitHub #64 closed. Status flipped to `done` by the AFK run orchestrator — the subagent's worktree predated this file on `main` so it could not set the frontmatter itself. Run log: [[../../_runs/2026-05-16-0424-afk-execution-log]].
