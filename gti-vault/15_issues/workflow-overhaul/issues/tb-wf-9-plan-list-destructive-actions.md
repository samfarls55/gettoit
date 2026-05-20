---
issue: tb-WF-9
title: iOS Plan list — Three-dot menu + delete + leave (destructive actions)
status: done
type: AFK
feature: workflow-overhaul
github_issue: 178
created: 2026-05-20
merged: 2026-05-20
pr: 188
---

# tb-WF-9 — iOS Plan list: Three-dot menu + destructive actions

## Parent

[[sg-wf-4-plan-list-surface|sg-WF-4]] — design-system spec for the Plan list surface. Locked decisions in [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]] §Q4 (delete affordance + confirm sheet copy).

Builds on [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] and [[tb-wf-8-plan-list-decided-history|tb-WF-8]]. Adds destructive actions across all sections + roles.

## What to build

End-to-end vertical slice that adds the destructive action affordances to every owned Plan card, fully respecting the "no red" Sunset Pop constraint and the Created-vs-Joined role split.

**Journey demoed (initiator):** Initiator taps the `⋯` glyph on a Created Plan card → small popover menu opens with context-appropriate items (`Edit plan` on Pending; `Delete plan` on all owned states) → taps `Delete plan` → C-16-pattern bottom sheet rises with section-appropriate copy (Pending vs Decided vs History) + primary pill `Delete plan` / `Remove` + eyebrow dismiss `KEEP` → confirms → Plan disappears from list, any active room is killed, joiners receive a "session ended" notice.

**Journey demoed (joiner):** Joiner taps the `⋯` glyph on a Joined Plan card → menu opens with only `Leave plan` → taps Leave → confirm sheet with `STAY` dismiss → confirms → joiner is dropped from the room, Plan disappears from joiner's list, room continues for other members.

### iOS changes

- **Add:** C-25 Action Dot Menu component. New SwiftUI primitive per the sg-WF-4 component spec. Trailing `⋯` glyph (`white 0.7` opacity, eyebrow weight), 44pt minimum tap target, popover menu we own entirely. No system context menu — full visual control to keep destructive items legible without red.
- **Update:** `PlanListScreen.swift` — render `⋯` on every owned card (trailing edge, vertically centered with the card content). Menu contents by role + status:

  | Card | Menu items (in order) |
  |---|---|
  | Created Pending | `Edit plan`, `Delete plan` |
  | Created Decided | `Delete plan` |
  | Created History | `Delete plan` |
  | Joined (any status) | `Leave plan` |

- **Add:** destructive confirm bottom sheet — new SwiftUI sheet using existing C-16 bottom-sheet primitive (glass, radius 18, scrim). Section-appropriate copy:

  | Section | Title | Body | Primary pill | Dismiss |
  |---|---|---|---|---|
  | Pending | `Delete this plan?` | `Nothing's been decided yet — no one's been notified.` | `Delete plan` | `KEEP` |
  | Decided-active | `Delete this plan?` | `The active room will end. Joiners will see a session-ended notice.` | `Delete plan` | `KEEP` |
  | Decided-expired | `Remove from history?` | `The verdict will be deleted permanently.` | `Remove` | `KEEP` |
  | Joined (Leave) | `Leave this plan?` | `Your answers will be removed. The room continues for everyone else.` | `Leave plan` | `STAY` |

  **No red.** Destructive weight is carried by copy + primary-pill prominence, NOT color. Primary pill uses the existing C-05 primary-pill treatment (white pill with dark text per Sunset Pop).
- **Wire:** `Edit plan` menu item routes to `SetupScreen.edit(plan:)` — same destination as the tap-card shortcut (gives the discoverable verb).

### Backend changes

- **Add:** Plan delete endpoint (or edge function). Behavior:
  - Removes the Plan and any linked Room from the database.
  - For Plans in Decided-active state, broadcasts a "session ended" message to active joiners via the existing realtime channel.
  - Restricted to Plan creator (per `Plan delete` in CONTEXT.md). RLS enforced.
- **Add or reuse:** Plan leave endpoint. Should drop the joiner from the room, discard their answers, and keep the room alive for the remaining members. This is the same semantic as `Plan exit` (already wired by [[tb-wf-2-quiz-back-exit-wire|tb-WF-2]] for the in-quiz Exit chrome) — reuse that path if possible; only add a new entry point if the existing Exit is exclusively in-quiz.

### Notification surface

- **In scope:** the realtime "session ended" broadcast to joiners when a Decided-active Plan is deleted. Joiners currently in the room get punted with a toast.
- **Out of scope:** push notifications for joiners who are not currently in the room. Push semantics are flagged on the parent doc as a separate decision-needed item.

### Tests

- Snapshot tests for the action-dot menu in all 4 variants (Created Pending / Created Decided / Created History / Joined).
- Snapshot tests for each of the 4 confirm sheets (copy + primary pill + dismiss).
- Unit tests for backend authorization: only Plan creator can delete; joiners can only leave their own membership.
- Unit tests for the "session ended" broadcast: deleting a Decided-active Plan fires the event to all active joiners.
- E2E (Created delete): create Plan → drop invite link → on a second device, accept invite + start quiz → on the first device, tap `⋯` → Delete plan → confirm → first device sees the Plan vanish from the list AND the second device sees the session-ended toast.
- E2E (Joined leave): on the second device, tap `⋯` on the JOINED card → Leave plan → confirm → second device sees the Plan vanish from their list AND the first device sees the joiner count update.

### Out of scope

- **Secondary swipe-to-delete with sun-yellow desaturated reveal.** Deferred per the grill doc — keep one-affordance for v1; revisit only if testing surfaces real complaint about gesture-discovery.
- **Push notifications.** See above.

## Acceptance criteria

- [ ] C-25 Action Dot Menu component exists as a reusable SwiftUI primitive matching the sg-WF-4 spec.
- [ ] `⋯` glyph renders on every owned card; tap-target clears 44pt iOS minimum.
- [ ] Menu contents match the role + status table above. Joined cards never show `Delete plan`. Pending cards include `Edit plan`.
- [ ] All 4 confirm sheets render per the copy table; no red anywhere; primary pill uses C-05 treatment.
- [ ] Plan delete backend kills room (if any), broadcasts "session ended" to active joiners, removes the Plan. Restricted to creator via RLS.
- [ ] Plan leave backend drops joiner from room without ending the room. Reuses or matches the `Plan exit` semantic from tb-WF-2.
- [ ] `Edit plan` menu item is functionally equivalent to tap-pending-card.
- [ ] iOS CI lane is green; `supabase-db` lane is green (for any migration); `supabase-functions` lane is green (for any new edge function).

## Blocked by

- [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] — foundation Plan list shell with cards to add `⋯` to.
- [[tb-wf-8-plan-list-decided-history|tb-WF-8]] — Decided + History cards must exist to support the menu items targeting them.

## Comments

### 2026-05-20 — Closed (PR #188 merged)

Landed end-to-end. Visual layer is a custom C-25 popover primitive (`ActionDotMenu.Trigger` + `ActionDotMenu.Popover`) rather than SwiftUI's native `Menu`, because the native one paints `.destructive` rows red and Sunset Pop forbids red (`tokens.md §1.3`). The destructive flag on items is informational only; `ActionDotMenu.itemForegroundColor(destructive:)` returns the same `.white` for both branches, and a unit test pins that contract so a future regression that paints a red destructive row fails CI.

The four confirm-sheet variants live in `PlanDestructiveConfirmSheet`. The copy table from §"Confirm sheet copy (LOCKED)" is encoded as a pure `copyFor(_:)` helper, with a parallel `variantFor(role:status:verb:)` resolver tests pin verbatim. Primary pill is `PillCTA fill="white"` for every variant.

Backend journey: `PlanDeleteCoordinator` looks up the linked room first, flips it to `status='expired'` (the existing session-ended signal joiners observe via `WaitingStore.RoomStatus.expired` from TB-07), then deletes the Plan. Order matters — if the Plan were deleted first, the `rooms.plan_id` FK would go NULL via `on delete set null` and a joiner who hadn't yet received the realtime status flip would see a live room. Joiner leave reuses `MemberLeaveStore.leave(...)` from tb-WF-2 — same `Plan exit` semantic (drop the membership, room continues for everyone else). No new migration was needed; existing RLS (`plans_delete_creator` from tb-WF-1, `rooms_update_creator` from TB-05, `members_delete_self` from tb-WF-2) covers authorization.

iOS test lane green (3m53s); design-system verify green; supabase-db + functions lanes green. With this merge the workflow-overhaul phase tracer-bullet sequence (tb-WF-1..9) is fully landed.
