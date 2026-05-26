---
issue: bug-36
title: PlanList History — threshold-gated Jump to Item search at 10 rows
status: ready
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

- [ ] Search input is **absent** when `history.count < 10`.
- [ ] Search input is **present** when `history.count >= 10` AND `historyState.isOpen == true`.
- [ ] Search input is **hidden** when History section is collapsed (even if count >= 10).
- [ ] Typing filters History rows in real-time (case-insensitive, matches Plan name OR place name).
- [ ] Clear button appears when text is non-empty; tap empties the field and restores full list.
- [ ] Empty result state shows "No matching plans".
- [ ] Snapshot tests: (a) History section under threshold (no search); (b) History section at/over threshold expanded with empty search; (c) History section with active filter (1+ matching, 0 matching).
- [ ] No regression on existing History section behaviour below 10 rows.

## Blocked by

None — can start immediately.

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. Grill #4 outcome — see run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] grill bucket progress section.
