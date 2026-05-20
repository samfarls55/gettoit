---

issue: tb-WF-4
title: Wire Plan setup surface — replaces S01 + S01b
status: needs-info
type: AFK
feature: workflow-overhaul
github_issue: 163
created: 2026-05-19
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

`Save for later` requires a destination — the Plan list surface. Until [[sg-wf-4-plan-list-surface|sg-WF-4]] is grilled and the Plan list wire lands, this issue cannot ship cleanly. **This is why the status is `needs-info`** — the spec is locked but the entry point and post-save destination are not.

Two paths for unblocking:

- **(a) Wait for sg-WF-4** to be grilled + the Plan list wire to land, then re-triage this to `ready-for-agent`.
- **(b) Ship Setup in Create mode only**, with `Save for later` initially disabled and the post-launch destination remaining S00 Landing. Add `Save for later` + the Edit mode later when the list lands. This is a tactical de-scope; the spec doesn't explicitly support a single-CTA Create mode, so the agent must coordinate with the founder on the spec deviation.

Recommend (a). The agent should not ship a degraded version of the spec; wait for the list grill.

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

- [ ] `SetupScreen` exists with both Create and Edit modes, rendering all six controls per sg-WF-1.
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

- [[sg-wf-1-plan-setup-surface|sg-WF-1]] — the design-system spec.
- [[tb-wf-1-plans-table-schema|tb-WF-1]] — the `plans` table + PlansStore.
- [[sg-wf-4-plan-list-surface|sg-WF-4]] — the Plan list surface, because `Save for later` needs the list as a destination.

Status is `needs-info` until sg-WF-4 grills.
