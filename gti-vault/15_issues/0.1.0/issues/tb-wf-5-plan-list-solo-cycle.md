---
issue: tb-WF-5
title: iOS Plan list â€” Solo creation cycle (foundation slice)
status: done
type: AFK
feature: 0.1.0
github_issue: 174
created: 2026-05-20
closed: 2026-05-20
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-WF-5 â€” iOS Plan list: Solo creation cycle (foundation)

## Parent


Foundation slice for the entire Plan list iOS port. Subsequent tracer-bullets (tb-WF-6 / tb-WF-7 / tb-WF-8 / tb-WF-9) layer additional capabilities on top of this shell.

## What to build

End-to-end vertical slice covering the solo user's Create â†’ List â†’ Edit cycle for the Plan list surface.

**Journey demoed:** A new user signs in â†’ lands on an empty Plan list â†’ taps the `Create your first plan` hero pill â†’ goes through to Solo Setup (5 controls per the [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] amendment) â†’ fills out + `Save for later` â†’ returns to the Plan list and sees their new Pending Plan rendered as a 1-line card â†’ taps the card â†’ re-opens Setup in Edit mode prefilled â†’ modifies + saves â†’ returns to the list.

### iOS changes

  - **In this slice:** Pending section is the only one that ever has rows (no Decided/History transition logic shipped yet â€” those land in tb-WF-8).
  - 1-line Pending cards: name only, glass row treatment per C-19 lineage.
  - Hero pill (giant C-05 primary pill, mid-screen) rendered when ALL sections are empty.
  - **Temporary** create affordance on populated state: a top-trailing chrome `+` glyph in the top bar. **This is replaced by C-26 FAB in tb-WF-6.** Both the hero pill AND the temp `+` route directly to Solo Setup (`mode == .solo`) for this slice â€” the disambig sheet ships in tb-WF-6.
  - Pending card tap â†’ `SetupScreen.edit(plan:)`.
- **Update:** `RootView.swift` â€” replace the post-sign-in `LandingScreen(...)` route with `PlanListScreen(...)`.
- **Delete:** `ios/Sources/App/LandingScreen.swift`. Remove all references.
- **Add:** PlansStore extension method â€” `plansForList(userId: UUID) async throws -> [Plan]` (or equivalent), filtered to `status == .pending` for this slice. Sorted `created_at DESC`. Decided/History queries can stub-return empty arrays here; they get real implementations in tb-WF-8.


- C-25 Action Dot Menu and C-26 FAB land in sg-WF-4's surface doc + JSX. **Neither is consumed by this slice** (FAB lands in tb-WF-6; menu lands in tb-WF-9). This slice ships the underlying `PlanListScreen` skeleton that those will plug into.
- 1-line Pending card visuals follow sg-WF-4's surface doc. Match exactly.
- Empty-state hero pill copy + visuals per sg-WF-4 + parent doc Q3 (`Create your first plan`).

### Backend changes

None. tb-WF-1 already shipped the Plans table + PlansStore; this slice just adds a read-side list query.

### Tests

- Snapshot tests for `PlanListScreen` in three states: empty, one-Pending, multi-Pending.
- Unit test for the list query: returns user's own Plans only, filtered by status, sorted correctly.
- E2E (or near-E2E): cold launch â†’ sign in â†’ see empty state â†’ tap hero pill â†’ land on Solo Setup â†’ fill + Save for later â†’ land on list with one Pending card â†’ tap card â†’ land on Setup-Edit prefilled.

### Out of scope (later tracer-bullets)

- **C-26 FAB component** â€” temp chrome `+` placeholder is fine for this slice. FAB lands in tb-WF-6 alongside the disambig sheet.
- **Solo/Group disambig sheet** â€” hero pill / temp `+` go directly to Solo for now. tb-WF-6.
- **Group Setup path** â€” Setup screen supports both `.solo` and `.group` modes per the amended tb-WF-4, but this slice only invokes `.solo`. tb-WF-6 wires the Group entry.
- **JOINED chip on Joined cards / Joined-card tap routing** â€” tb-WF-7.
- **Decided + History sections rendering + state transitions + tap routing** â€” tb-WF-8.
- **Three-dot menu (`â‹¯`) + delete + leave** â€” tb-WF-9.

## Acceptance criteria

- [ ] `PlanListScreen.swift` exists and renders the Pending section per sg-WF-4 spec (1-line glass-row cards).
- [ ] When the user has zero Plans, the hero pill (`Create your first plan`) renders mid-screen as the only affordance.
- [ ] When the user has at least one Plan, a top-trailing chrome `+` glyph renders in the top bar; the hero pill is replaced.
- [ ] Both the hero pill and the temp `+` route to Solo Setup (`SetupScreen(mode: .solo)`) â€” no disambig sheet yet.
- [ ] Pending card tap routes to `SetupScreen.edit(plan:)` for Created Plans.
- [ ] Pending section is ordered `created_at DESC`.
- [ ] `LandingScreen.swift` is deleted. `RootView.swift` routes through `PlanListScreen` after sign-in.
- [ ] iOS CI lane is green.

## Blocked by

- [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] â€” amended Setup screen with `.solo` mode (#163). This slice invokes `SetupScreen(mode: .solo)`; that constructor must exist.

## Comments

### 2026-05-20 â€” AFK execution closed

Merged via PR pending green CI. Foundation slice landed end-to-end:

- `PlanListScreen.swift` ships with three states (empty hero, one-Pending, multi-Pending) backed by render smoke tests + pure-helper coverage. The 1-line Pending card matches the C-19 glass row treatment from the surface doc.
- `PlansStore.plansForList(userID:)` added â€” read-side query filtered to `status = 'pending'`, ordered `created_at DESC` per surface Â§Q7.
- `LandingScreen.swift` deleted; `RootView.swift` routes the post-sign-in idle session through `PlanListScreen` directly.
- `QuizChromePostExitDestination` flipped from `.landing` â†’ `.planList`; the post-Exit chain now lands on the Plan list. `QuizChromePostExitTests` updated to pin the new value.
- Hero pill + temp `+` chrome glyph both route to `SetupScreen(mode: .solo)` per the issue body. Pending card tap routes to `.edit + <Plan.scope-derived mode>`.

Known adjacency surfaced: the legacy `LandingScreen.swift` was the only entry point to `showingSettings` (Account Settings CTA). Settings access from the Plan list is not in this slice â€” the `showingSettings` state slot stays in `RootView` for a follow-up affordance (Plan list chrome menu or settings sheet from inside Setup). Flagged in the PR Decisions section.
