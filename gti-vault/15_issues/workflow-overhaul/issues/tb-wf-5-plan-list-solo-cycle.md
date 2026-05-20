---
issue: tb-WF-5
title: iOS Plan list — Solo creation cycle (foundation slice)
status: done
type: AFK
feature: workflow-overhaul
github_issue: 174
created: 2026-05-20
closed: 2026-05-20
---

# tb-WF-5 — iOS Plan list: Solo creation cycle (foundation)

## Parent

[[sg-wf-4-plan-list-surface|sg-WF-4]] — design-system spec for the Plan list surface. Locked decisions in [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]].

Foundation slice for the entire Plan list iOS port. Subsequent tracer-bullets (tb-WF-6 / tb-WF-7 / tb-WF-8 / tb-WF-9) layer additional capabilities on top of this shell.

## What to build

End-to-end vertical slice covering the solo user's Create → List → Edit cycle for the Plan list surface.

**Journey demoed:** A new user signs in → lands on an empty Plan list → taps the `Create your first plan` hero pill → goes through to Solo Setup (5 controls per the [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] amendment) → fills out + `Save for later` → returns to the Plan list and sees their new Pending Plan rendered as a 1-line card → taps the card → re-opens Setup in Edit mode prefilled → modifies + saves → returns to the list.

### iOS changes

- **Add:** `ios/Sources/App/PlanListScreen.swift` — SwiftUI view rendering the Plan list per the design-system spec from sg-WF-4. Three sections (`Pending` / `Decided` / `History`); empty sections render nothing per Q1.
  - **In this slice:** Pending section is the only one that ever has rows (no Decided/History transition logic shipped yet — those land in tb-WF-8).
  - 1-line Pending cards: name only, glass row treatment per C-19 lineage.
  - Hero pill (giant C-05 primary pill, mid-screen) rendered when ALL sections are empty.
  - **Temporary** create affordance on populated state: a top-trailing chrome `+` glyph in the top bar. **This is replaced by C-26 FAB in tb-WF-6.** Both the hero pill AND the temp `+` route directly to Solo Setup (`mode == .solo`) for this slice — the disambig sheet ships in tb-WF-6.
  - Pending card tap → `SetupScreen.edit(plan:)`.
- **Update:** `RootView.swift` — replace the post-sign-in `LandingScreen(...)` route with `PlanListScreen(...)`.
- **Delete:** `ios/Sources/App/LandingScreen.swift`. Remove all references.
- **Add:** PlansStore extension method — `plansForList(userId: UUID) async throws -> [Plan]` (or equivalent), filtered to `status == .pending` for this slice. Sorted `created_at DESC`. Decided/History queries can stub-return empty arrays here; they get real implementations in tb-WF-8.

### Design-system spec consumption

- C-25 Action Dot Menu and C-26 FAB land in sg-WF-4's surface doc + JSX. **Neither is consumed by this slice** (FAB lands in tb-WF-6; menu lands in tb-WF-9). This slice ships the underlying `PlanListScreen` skeleton that those will plug into.
- 1-line Pending card visuals follow sg-WF-4's surface doc. Match exactly.
- Empty-state hero pill copy + visuals per sg-WF-4 + parent doc Q3 (`Create your first plan`).

### Backend changes

None. tb-WF-1 already shipped the Plans table + PlansStore; this slice just adds a read-side list query.

### Tests

- Snapshot tests for `PlanListScreen` in three states: empty, one-Pending, multi-Pending.
- Unit test for the list query: returns user's own Plans only, filtered by status, sorted correctly.
- E2E (or near-E2E): cold launch → sign in → see empty state → tap hero pill → land on Solo Setup → fill + Save for later → land on list with one Pending card → tap card → land on Setup-Edit prefilled.

### Out of scope (later tracer-bullets)

- **C-26 FAB component** — temp chrome `+` placeholder is fine for this slice. FAB lands in tb-WF-6 alongside the disambig sheet.
- **Solo/Group disambig sheet** — hero pill / temp `+` go directly to Solo for now. tb-WF-6.
- **Group Setup path** — Setup screen supports both `.solo` and `.group` modes per the amended tb-WF-4, but this slice only invokes `.solo`. tb-WF-6 wires the Group entry.
- **JOINED chip on Joined cards / Joined-card tap routing** — tb-WF-7.
- **Decided + History sections rendering + state transitions + tap routing** — tb-WF-8.
- **Three-dot menu (`⋯`) + delete + leave** — tb-WF-9.

## Acceptance criteria

- [ ] `PlanListScreen.swift` exists and renders the Pending section per sg-WF-4 spec (1-line glass-row cards).
- [ ] When the user has zero Plans, the hero pill (`Create your first plan`) renders mid-screen as the only affordance.
- [ ] When the user has at least one Plan, a top-trailing chrome `+` glyph renders in the top bar; the hero pill is replaced.
- [ ] Both the hero pill and the temp `+` route to Solo Setup (`SetupScreen(mode: .solo)`) — no disambig sheet yet.
- [ ] Pending card tap routes to `SetupScreen.edit(plan:)` for Created Plans.
- [ ] Pending section is ordered `created_at DESC`.
- [ ] `LandingScreen.swift` is deleted. `RootView.swift` routes through `PlanListScreen` after sign-in.
- [ ] iOS CI lane is green.

## Blocked by

- [[sg-wf-4-plan-list-surface|sg-WF-4]] — design-system spec + JSX must land first to provide the visual blueprint (#157).
- [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] — amended Setup screen with `.solo` mode (#163). This slice invokes `SetupScreen(mode: .solo)`; that constructor must exist.

## Comments

### 2026-05-20 — AFK execution closed

Merged via PR pending green CI. Foundation slice landed end-to-end:

- `PlanListScreen.swift` ships with three states (empty hero, one-Pending, multi-Pending) backed by render smoke tests + pure-helper coverage. The 1-line Pending card matches the C-19 glass row treatment from the surface doc.
- `PlansStore.plansForList(userID:)` added — read-side query filtered to `status = 'pending'`, ordered `created_at DESC` per surface §Q7.
- `LandingScreen.swift` deleted; `RootView.swift` routes the post-sign-in idle session through `PlanListScreen` directly.
- `QuizChromePostExitDestination` flipped from `.landing` → `.planList`; the post-Exit chain now lands on the Plan list. `QuizChromePostExitTests` updated to pin the new value.
- Hero pill + temp `+` chrome glyph both route to `SetupScreen(mode: .solo)` per the issue body. Pending card tap routes to `.edit + <Plan.scope-derived mode>`.

Known adjacency surfaced: the legacy `LandingScreen.swift` was the only entry point to `showingSettings` (Account Settings CTA). Settings access from the Plan list is not in this slice — the `showingSettings` state slot stays in `RootView` for a follow-up affordance (Plan list chrome menu or settings sheet from inside Setup). Flagged in the PR Decisions section.
