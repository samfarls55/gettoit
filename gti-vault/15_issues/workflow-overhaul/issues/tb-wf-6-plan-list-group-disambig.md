---
issue: tb-WF-6
title: iOS Plan list — Group creation path + FAB + disambig sheet
status: done
type: AFK
feature: workflow-overhaul
github_issue: 175
created: 2026-05-20
closed: 2026-05-20
---

# tb-WF-6 — iOS Plan list: Group creation + FAB + disambig sheet

## Parent

[[sg-wf-4-plan-list-surface|sg-WF-4]] — design-system spec for the Plan list surface. Locked decisions in [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]].

Builds on the [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] foundation. This slice adds the Group creation path and replaces the temporary chrome `+` with the C-26 FAB.

## What to build

End-to-end vertical slice that enables the user to choose between Solo and Group Plan creation, via the design-spec'd disambig sheet, anchored to a real FAB on populated state.

**Journey demoed:** A returning user on a populated Plan list → taps the bottom-right C-26 FAB → a C-16-pattern bottom sheet rises with two stacked ghost pills (`Solo` / `Group`) → taps `Group` → lands on Setup with 6 controls and the `Who's coming` chips showing `Two of us / A group` (no `Just me`) → fills out + `Drop the invite link` → existing room-mint / invite path fires → new Pending Plan appears on the list when the user returns. Same disambig also fires from the empty-state hero pill — a first-launch user can pick Group on their first Plan.

### iOS changes

- **Add:** C-26 FAB iOS port. New SwiftUI component `ios/Sources/App/Components/FloatingActionButton.swift` (or matched naming) per the sg-WF-4 component spec. Sits bottom-right, ~56pt circular, glass background, sun-yellow glyph, light shadow, 18pt off bottom + trailing edges.
- **Update:** `PlanListScreen.swift` — replace the temp top-trailing chrome `+` (from tb-WF-5) with the FAB on populated state. Hero pill remains as-is for empty state.
- **Add:** disambig sheet — new SwiftUI sheet using existing C-16 bottom-sheet primitive (glass, radius 18, scrim). Two C-05 ghost pills stacked: `Solo` (top) / `Group` (below). No Cancel button — relies on swipe-down + tap-scrim dismissal.
- **Wire:** both the hero pill AND the FAB now route to the disambig sheet (unified entry per Q6). Hero pill is no longer a direct-to-Solo shortcut — it goes through disambig like the FAB does.
- **Wire:** sheet selection routes to `SetupScreen(mode: .solo)` or `SetupScreen(mode: .group)` per [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]]'s amendment.

### Backend changes

None.

### Tests

- Snapshot tests for the disambig sheet (open state with both pills visible).
- Snapshot tests for `PlanListScreen` populated state with FAB visible (replacing the temp chrome `+`).
- Unit / interaction test: tap FAB → sheet appears → tap Solo → Setup `.solo` is presented. Same chain for Group.
- Unit / interaction test: tap empty-state hero pill → sheet appears (same as FAB). Confirms unified entry path.
- E2E: from a populated list, tap FAB → Group → fill 6-control Setup → Drop the invite link → return to list → see new Pending Plan.

### Out of scope (later tracer-bullets)

- **JOINED chip + Joined-card tap routing** — tb-WF-7.
- **Decided + History rendering + transitions + tap** — tb-WF-8.
- **Three-dot menu + delete + leave** — tb-WF-9.

## Acceptance criteria

- [ ] C-26 FAB component exists as a reusable SwiftUI primitive matching the sg-WF-4 spec (~56pt circular, glass + sun glyph, 18pt off bottom + trailing).
- [ ] `PlanListScreen` populated state shows the FAB; the temp chrome `+` from tb-WF-5 is removed.
- [ ] Disambig sheet renders per the spec: C-16 visual, two stacked C-05 ghost pills (`Solo` / `Group`), no Cancel button, dismissible via swipe-down or scrim tap.
- [ ] Both empty-state hero pill AND FAB route to the disambig sheet (unified entry).
- [ ] Sheet selection routes to `SetupScreen(mode: .solo)` or `SetupScreen(mode: .group)`; Setup renders the correct control set per the tb-WF-4 amendment.
- [ ] iOS CI lane is green.

## Blocked by

- [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] — foundation Plan list shell. Provides `PlanListScreen` to add the FAB to.
- [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] — amended Setup must support both `.solo` and `.group` modes.

## Comments

### 2026-05-20 — closed (PR #182)

Merged via [PR #182](https://github.com/samfarls55/gettoit/pull/182).

Landed three new iOS files + edits to two existing:

- **`ios/Sources/App/FloatingActionButton.swift`** — the reusable C-26 primitive. 56pt circular, glass body + sun-yellow `+` glyph, white 0.32 hairline stroke, light shadow. Locked diameter / insets / glyph / accessibility label as static constants so tests can pin the contract.
- **`ios/Sources/App/PlanDisambigSheet.swift`** — single-surface sheet composed from the C-16 dark-glass language. Eyebrow `"Start a plan"` + headline `"Who's coming?"` + two stacked C-05 ghost pills `Solo` / `Group`. No Cancel button; swipe-down + tap-scrim dismiss only. `Choice` enum maps 1:1 to `SetupScreen.GroupMode`.
- **`ios/Sources/App/PlanListScreen.swift`** — temp top-trailing `+` chrome glyph removed (the `tempCreateGlyph` constant from tb-WF-5 is retired with a comment breadcrumb). Populated state now hosts the C-26 FAB at the bottom-right; both the FAB and the empty-state hero pill route through the same disambig sheet (unified entry per Q6 of the parent grill). Initializer now takes `onRequestDisambig` (side-effect hook) and `onPickGroupMode` (load-bearing route) in place of `onCreatePlan`.
- **`ios/Sources/App/RootView.swift`** — the disambig pick now branches the location pre-prime carrying the chosen mode in a new `pendingDisambigGroupMode` slot, so a first-launch user lands in `.group` Setup after S00b if they picked Group. The legacy `openSoloSetup()` thin wrapper survives for the TB-11 read-only verdict re-invite path.

Tests cover locked copy, group-mode mapping, callback emission, both entry points routing through disambig, render smoke for all states.

Autonomous decisions (full list on the PR):

- File location: flat under `ios/Sources/App/` (matches existing convention; the issue suggested `Components/` but no other source file uses that subdirectory).
- `Choice` enum kept local to the sheet (doesn't leak Setup internals).
- Sheet detent pinned at 260pt + `.medium` fallback (sheet content is bounded; prevents SwiftUI from snapping to a half-empty `.medium` on first open).
- Location pre-prime triggered on pick, not on disambig open (preserves the unified-entry contract and carries the user's choice through the detour).
- FAB pressed-state via a dedicated `ButtonStyle` (driving `scale(0.96)` over 140ms ease-out per the spec).
- Test simulation hooks (`simulateTap`, `simulatePick`, `simulateFABTap`) for SwiftUI test-target ergonomics (no synchronous "press the button" API).

iOS CI lane green; `node design-system/scripts/verify.mjs` green (no spec changes — purely consumed the existing spec).
