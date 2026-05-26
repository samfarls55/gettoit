---
issue: bug-36
title: PlanList History — threshold-gated Jump to Item search at 10 rows
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26 grill #4
created: 2026-05-26
github_issue: 279
---

# bug-36 — PlanList History — threshold-gated Jump to Item search at 10 rows

## Workflow design

**Nav model anchor.** GetToIt is Hub-and-Spoke ([[../../30_design/interaction-patterns/surfaces#GetToIt app shell — Hub-and-Spoke]]). History stays a section under `PlanListScreen` (the hub), not a Multilevel destination. Re-affirmed by grill #4.

**Pattern.** [[../../30_design/interaction-patterns/patterns#Jump to Item]] — inline search that filters the visible list as the user types. Threshold-gated per [[../../30_design/interaction-patterns/surfaces#Threshold-gated affordances]] addendum: only render the search input when `history.count >= 10`.

**Foundations.**
- [[../../30_design/interaction-patterns/principles#P-03. Satisficing]] — don't show affordances the user can't yet use. Below 10 rows, scroll-and-tap works; a search field is dead weight.
- [[../../30_design/interaction-patterns/principles#P-08. Microbreaks]] — at 10+ rows, returning users want to find a past plan fast without scroll-hunting.
- [[../../30_design/interaction-patterns/principles#P-09. Spatial Memory]] — search input lives at the top of the History section (between section header and first row), consistent position when visible.

**Considered + rejected.**
- Page-level search bar at top of PlanList — overweights tiny sections (Pending Created / Joined / Decided are bounded < 5 rows naturally).
- History-as-separate-destination (`HistoryScreen` push) — contradicts Hub-and-Spoke lock from grill #3.
- Dynamic Queries (filter chips, sort by date / place) — deferred until post-launch usage data justifies specific facets.

## What to build

Add a threshold-gated search input to the History section in `PlanListScreen.swift` (section starts line 926).

- Render a `TextField` below the section header **only when** `history.count >= 10` and `historyState.isOpen == true`.
- Search filter is case-insensitive substring match against `Plan name` AND `verdict place name` (the two strings already shown on each row).
- Filter is purely client-side — `history` array is already in memory.
- Clear button (`xmark.circle.fill`) appears inside the field when text is non-empty; tap clears and re-shows full list.
- Empty filter result state: "No matching plans" centered placeholder in the section content area.
- Search input field uses existing `GTI` tokens (no new design primitives needed; reuse SignInScreen / SetupScreen input styling).

## Acceptance criteria

- [x] Search input is **absent** when `history.count < 10`.
- [x] Search input is **present** when `history.count >= 10` AND `historyState.isOpen == true`.
- [x] Search input is **hidden** when History section is collapsed (even if count >= 10).
- [x] Typing filters History rows in real-time (case-insensitive, matches Plan name OR place name).
- [x] Clear button appears when text is non-empty; tap empties the field and restores full list.
- [x] Empty result state shows "No matching plans".
- [x] Snapshot tests: (a) History section under threshold (no search); (b) History section at/over threshold expanded with empty search; (c) History section with active filter (1+ matching, 0 matching).
- [x] No regression on existing History section behaviour below 10 rows.

## Comments

- 2026-05-26 — merged via PR [#296](https://github.com/samfarls55/gettoit/pull/296) (squash `a19849e`). All CI lanes green (ios xcodebuild test 3m51s). Threshold pinned at 10 via `PlanListScreen.historySearchThreshold`; search state held in a small `@Observable HistorySearchState` mirroring the existing `HistoryCollapseState` pattern so the unit-test path can mutate the query without a `UIHostingController` mount. Copy locked: `"Search plans"` (placeholder), `"No matching plans"` (empty-result).

## Blocked by

None — can start immediately.

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. Grill #4 outcome — see run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] grill bucket progress section.
