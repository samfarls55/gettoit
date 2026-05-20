---

issue: tb-WF-4
title: Wire Plan setup surface — replaces S01 + S01b
status: ready-for-agent
type: AFK
feature: workflow-overhaul
github_issue: 163
created: 2026-05-19
amended: 2026-05-20
---

# tb-WF-4 — Wire Plan setup surface

## Parent

[[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] — the headline iOS port. Lands the iOS Setup screen that consumes [[sg-wf-1-plan-setup-surface|sg-WF-1]]'s design-system spec and [[tb-wf-1-plans-table-schema|tb-WF-1]]'s `plans` table + PlansStore. End-to-end: a user can create a named Plan via the new Setup screen, save it for later or drop the invite link immediately, and (once edits are in scope) tap a pending Plan from the list to re-open the Setup screen in Edit mode.

## What to build

End-to-end behavior delivered:

1. **Create mode.** The user opens the Setup screen (entry point: `+` button on the Plan list — but the Plan list itself is sg-WF-4 territory; this issue ships Setup, the entry point may be a temporary debug-only path until the Plan list lands).
2. **Six controls.** Name, scope, location, meal time, service shape, distance — matching sg-WF-1 exactly. Name required, 40-char cap, both dock CTAs gated on it.
3. **Drop the invite link.** Mints a Plan as `pending`, mints a Room linked to it (`rooms.plan_id = plan.id`), copies the Plan's params into the room as today's flow does, drops the invite link / starts the quiz.
4. **Save for later.** Mints a Plan as `pending`, lands the user back on the Plan list (or, if the list doesn't yet exist, on S00 Landing). No room is minted.
5. **Auto-save-on-back.** Top-bar back with name non-empty mints a `pending` Plan and returns. Empty name discards.
6. **Edit mode.** Tap a `pending` Plan from the list → opens Setup prefilled with that Plan's existing values. Dock CTAs relabeled (`SAVE CHANGES` / `Drop the invite link`). Top-bar back auto-saves changes.

### iOS changes

- **Add:** `ios/Sources/App/SetupScreen.swift` — SwiftUI view consuming `tokens` + existing `LocationPickerChip` + `C-04` chip primitives. Two modes: `.create(initialDefaults)` and `.edit(plan: Plan)`. Same controls; mode drives headline + secondary CTA label.
- **Add:** validation logic — disabled CTAs when name is empty.
- **Add:** distance slider with the new range / step / tick semantics. Replaces the existing radius-slider primitive if the existing `C-21 RangeSlider` SwiftUI port doesn't cover the non-uniform step + tick variant.
- **Update:** `RootView.swift` — when the user taps a `pending` Plan from the list (entry point handled in the future Plan list wire issue, but stub here), open `SetupScreen` in `.edit` mode. When the user taps `+`, open in `.create` mode.
- **Delete or stub:** the existing `InitiatorScreen.swift` and `ParametersScreen.swift` entry points. Pure deletion is OK once SetupScreen is the canonical creation flow; if there's a transition window where both can coexist (gated on a feature flag), document that. Per the AFK-full-autonomy rule, the agent has discretion on the cutover mechanism.
- **Update:** all post-launch flows (S03 Quiz, S04 Waiting, S05 Verdict) so the `room.plan_id` is read and the Plan transitions to `decided-active` when the verdict fires (the server-side hook for this is in tb-WF-1; this issue just confirms the iOS path triggers it correctly).

### Plan list landing requirement

`Save for later` requires a destination — the Plan list surface. As of the 2026-05-20 sg-WF-4 grill, the Plan list spec is locked and the iOS wire is being delivered by [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] (foundation slice). **This issue is no longer `needs-info`.** Ship Setup per the amendment below; tb-WF-5 lands the list as the `Save for later` destination.

### Amendment 2026-05-20: Q7 lifted-out chip

The Plan list grill ([[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]] §Q5) lifted the `Who's coming` choice out of Setup into a pre-Setup disambig sheet attached to the create-Plan affordance. Setup screen now renders **conditionally on a `mode: .solo | .group` parameter** passed in at construction:

- **Solo path** (`mode == .solo`) — render **5 controls**. The `Who's coming` row is **omitted entirely**.
- **Group path** (`mode == .group`) — render **6 controls**. The `Who's coming` chips become **`Two of us / A group`** only (the `Just me` option is removed because the user already disambig'd upstream).

Headlines + body + dock CTA copy from the original spec (parent doc Q4 + Q7) are unchanged. Primary CTA: `Start the quiz` (solo) / `Drop the invite link` (group), same as locked.

**Edit mode entry path:** the existing Plan's persisted `scope` value (`solo / duo / group` per CONTEXT.md → `Plan`) determines the rendered mode on re-open. A `solo` Plan re-opens in Solo Setup (5 controls); a `duo` or `group` Plan re-opens in Group Setup (6 controls). The chip pre-selection on Edit is whatever the user picked originally — `Two of us` for duo, `A group` for group.

**Why amended in place rather than as a separate slice:** the amendment can't ship in a half-done state. If this issue lands first with the original 6-chip-flat layout and a later slice amends it, there's an intermediate window where Setup is wrong. Folding into this issue's scope avoids that window.

The disambig sheet itself + FAB wire + hero pill routing are NOT in this issue's scope — they are delivered by [[tb-wf-6-plan-list-group-disambig|tb-WF-6]]. This issue ships Setup with the amended mode-conditional rendering; tb-WF-5 / tb-WF-6 wire the entry paths that pass the mode in.

### Tests

- Snapshot tests for both modes (Create empty / Create populated / Edit populated).
- Unit tests for validation (name empty → CTAs disabled; name non-empty → enabled).
- Unit tests for `Drop the invite link` (mints Plan + Room, links them, fires invite/quiz path).
- Unit tests for `Save for later` (mints Plan only, lands on list).
- Unit tests for auto-save-on-back with name empty / non-empty.
- E2E (or near-E2E with fake clients) that the existing post-launch verdict flow correctly transitions the linked Plan to `decided-active`.

### Out of scope

- The Plan list surface itself — sg-WF-4.
- The Delete affordance — sg-WF-4 / future tb.
- Web invitee flow — sg-WF-5 / future tb.

## Acceptance criteria

- [ ] `SetupScreen` exists with both Create and Edit modes, taking a `mode: .solo | .group` parameter; solo renders 5 controls (no `Who's coming` row); group renders 6 controls with the `Just me` chip option removed.
- [ ] Distance slider behavior matches the spec exactly (range 0.25–10.0 mi, non-uniform step, default 1.0, tick at 1.0).
- [ ] Name validation: both dock CTAs disabled while name is empty; enabled when non-empty.
- [ ] `Drop the invite link` mints a Plan in `pending` AND a Room linked to it; fires the existing invite/quiz path.
- [ ] `Save for later` mints a Plan in `pending` and returns to the Plan list (or to S00 Landing if the list isn't yet wired).
- [ ] Auto-save-on-back behavior matches the spec (name non-empty saves; empty discards).
- [ ] Edit mode prefills from the existing Plan; top-bar back auto-saves changes.
- [ ] Post-verdict, the linked Plan transitions to `decided-active` (consumes the tb-WF-1 server-side function).
- [ ] Existing `InitiatorScreen` and `ParametersScreen` are deleted or feature-flagged off; no user can reach them via the production flow.
- [ ] `ios` CI lane is green.

## Blocked by

- [[sg-wf-1-plan-setup-surface|sg-WF-1]] — the design-system spec (done).
- [[tb-wf-1-plans-table-schema|tb-WF-1]] — the `plans` table + PlansStore (done).
- [[sg-wf-4-plan-list-surface|sg-WF-4]] — the Plan list surface spec (done — grilled 2026-05-20).

Status promoted to `ready-for-agent` on 2026-05-20. The `Save for later` destination (Plan list) is concurrently delivered by [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]]; both can ship in parallel since tb-WF-5 stubs Setup-Edit reachability and this issue stubs the entry point from the list.

## Comments

### 2026-05-20 — amended in place after sg-WF-4 grill

Promoted from `needs-info` → `ready-for-agent`. Scope amended to include the Q7-amendment (mode-conditional 5/6 control rendering); see "Amendment" subsection in What to build.
