---
issue: tb-WF-9
title: iOS Plan list â€” Three-dot menu + delete + leave (destructive actions)
status: done
type: AFK
feature: 0.1.0
github_issue: 178
created: 2026-05-20
merged: 2026-05-20
pr: 188
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-WF-9 â€” iOS Plan list: Three-dot menu + destructive actions

## Parent


Builds on [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] and [[tb-wf-8-plan-list-decided-history|tb-WF-8]]. Adds destructive actions across all sections + roles.

## What to build

End-to-end vertical slice that adds the destructive action affordances to every owned Plan card, fully respecting the "no red" Sunset Pop constraint and the Created-vs-Joined role split.

**Journey demoed (initiator):** Initiator taps the `â‹¯` glyph on a Created Plan card â†’ small popover menu opens with context-appropriate items (`Edit plan` on Pending; `Delete plan` on all owned states) â†’ taps `Delete plan` â†’ C-16-pattern bottom sheet rises with section-appropriate copy (Pending vs Decided vs History) + primary pill `Delete plan` / `Remove` + eyebrow dismiss `KEEP` â†’ confirms â†’ Plan disappears from list, any active room is killed, joiners receive a "session ended" notice.

**Journey demoed (joiner):** Joiner taps the `â‹¯` glyph on a Joined Plan card â†’ menu opens with only `Leave plan` â†’ taps Leave â†’ confirm sheet with `STAY` dismiss â†’ confirms â†’ joiner is dropped from the room, Plan disappears from joiner's list, room continues for other members.

### iOS changes

- **Add:** C-25 Action Dot Menu component. New SwiftUI primitive per the sg-WF-4 component spec. Trailing `â‹¯` glyph (`white 0.7` opacity, eyebrow weight), 44pt minimum tap target, popover menu we own entirely. No system context menu â€” full visual control to keep destructive items legible without red.
- **Update:** `PlanListScreen.swift` â€” render `â‹¯` on every owned card (trailing edge, vertically centered with the card content). Menu contents by role + status:

  | Card | Menu items (in order) |
  |---|---|
  | Created Pending | `Edit plan`, `Delete plan` |
  | Created Decided | `Delete plan` |
  | Created History | `Delete plan` |
  | Joined (any status) | `Leave plan` |

- **Add:** destructive confirm bottom sheet â€” new SwiftUI sheet using existing C-16 bottom-sheet primitive (glass, radius 18, scrim). Section-appropriate copy:

  | Section | Title | Body | Primary pill | Dismiss |
  |---|---|---|---|---|
  | Pending | `Delete this plan?` | `Nothing's been decided yet â€” no one's been notified.` | `Delete plan` | `KEEP` |
  | Decided-active | `Delete this plan?` | `The active room will end. Joiners will see a session-ended notice.` | `Delete plan` | `KEEP` |
  | Decided-expired | `Remove from history?` | `The verdict will be deleted permanently.` | `Remove` | `KEEP` |
  | Joined (Leave) | `Leave this plan?` | `Your answers will be removed. The room continues for everyone else.` | `Leave plan` | `STAY` |

  **No red.** Destructive weight is carried by copy + primary-pill prominence, NOT color. Primary pill uses the existing C-05 primary-pill treatment (white pill with dark text per Sunset Pop).
- **Wire:** `Edit plan` menu item routes to `SetupScreen.edit(plan:)` â€” same destination as the tap-card shortcut (gives the discoverable verb).

### Backend changes

- **Add:** Plan delete endpoint (or edge function). Behavior:
  - Removes the Plan and any linked Room from the database.
  - For Plans in Decided-active state, broadcasts a "session ended" message to active joiners via the existing realtime channel.
  - Restricted to Plan creator (per `Plan delete` in CONTEXT.md). RLS enforced.
- **Add or reuse:** Plan leave endpoint. Should drop the joiner from the room, discard their answers, and keep the room alive for the remaining members. This is the same semantic as `Plan exit` (already wired by [[tb-wf-2-quiz-back-exit-wire|tb-WF-2]] for the in-quiz Exit chrome) â€” reuse that path if possible; only add a new entry point if the existing Exit is exclusively in-quiz.

### Notification surface

- **In scope:** the realtime "session ended" broadcast to joiners when a Decided-active Plan is deleted. Joiners currently in the room get punted with a toast.
- **Out of scope:** push notifications for joiners who are not currently in the room. Push semantics are flagged on the parent doc as a separate decision-needed item.

### Tests

- Snapshot tests for the action-dot menu in all 4 variants (Created Pending / Created Decided / Created History / Joined).
- Snapshot tests for each of the 4 confirm sheets (copy + primary pill + dismiss).
- Unit tests for backend authorization: only Plan creator can delete; joiners can only leave their own membership.
- Unit tests for the "session ended" broadcast: deleting a Decided-active Plan fires the event to all active joiners.
- E2E (Created delete): create Plan â†’ drop invite link â†’ on a second device, accept invite + start quiz â†’ on the first device, tap `â‹¯` â†’ Delete plan â†’ confirm â†’ first device sees the Plan vanish from the list AND the second device sees the session-ended toast.
- E2E (Joined leave): on the second device, tap `â‹¯` on the JOINED card â†’ Leave plan â†’ confirm â†’ second device sees the Plan vanish from their list AND the first device sees the joiner count update.

### Out of scope

- **Secondary swipe-to-delete with sun-yellow desaturated reveal.** Deferred per the grill doc â€” keep one-affordance for 0.1.0; revisit only if testing surfaces real complaint about gesture-discovery.
- **Push notifications.** See above.

## Acceptance criteria

- [ ] C-25 Action Dot Menu component exists as a reusable SwiftUI primitive matching the sg-WF-4 spec.
- [ ] `â‹¯` glyph renders on every owned card; tap-target clears 44pt iOS minimum.
- [ ] Menu contents match the role + status table above. Joined cards never show `Delete plan`. Pending cards include `Edit plan`.
- [ ] All 4 confirm sheets render per the copy table; no red anywhere; primary pill uses C-05 treatment.
- [ ] Plan delete backend kills room (if any), broadcasts "session ended" to active joiners, removes the Plan. Restricted to creator via RLS.
- [ ] Plan leave backend drops joiner from room without ending the room. Reuses or matches the `Plan exit` semantic from tb-WF-2.
- [ ] `Edit plan` menu item is functionally equivalent to tap-pending-card.
- [ ] iOS CI lane is green; `supabase-db` lane is green (for any migration); `supabase-functions` lane is green (for any new edge function).

## Blocked by

- [[tb-wf-5-plan-list-solo-cycle|tb-WF-5]] â€” foundation Plan list shell with cards to add `â‹¯` to.
- [[tb-wf-8-plan-list-decided-history|tb-WF-8]] â€” Decided + History cards must exist to support the menu items targeting them.

## Comments

### 2026-05-20 â€” Closed (PR #188 merged)

Landed end-to-end. Visual layer is a custom C-25 popover primitive (`ActionDotMenu.Trigger` + `ActionDotMenu.Popover`) rather than SwiftUI's native `Menu`, because the native one paints `.destructive` rows red and Sunset Pop forbids red (`tokens.md Â§1.3`). The destructive flag on items is informational only; `ActionDotMenu.itemForegroundColor(destructive:)` returns the same `.white` for both branches, and a unit test pins that contract so a future regression that paints a red destructive row fails CI.

The four confirm-sheet variants live in `PlanDestructiveConfirmSheet`. The copy table from Â§"Confirm sheet copy (LOCKED)" is encoded as a pure `copyFor(_:)` helper, with a parallel `variantFor(role:status:verb:)` resolver tests pin verbatim. Primary pill is `PillCTA fill="white"` for every variant.

Backend journey: `PlanDeleteCoordinator` looks up the linked room first, flips it to `status='expired'` (the existing session-ended signal joiners observe via `WaitingStore.RoomStatus.expired` from TB-07), then deletes the Plan. Order matters â€” if the Plan were deleted first, the `rooms.plan_id` FK would go NULL via `on delete set null` and a joiner who hadn't yet received the realtime status flip would see a live room. Joiner leave reuses `MemberLeaveStore.leave(...)` from tb-WF-2 â€” same `Plan exit` semantic (drop the membership, room continues for everyone else). No new migration was needed; existing RLS (`plans_delete_creator` from tb-WF-1, `rooms_update_creator` from TB-05, `members_delete_self` from tb-WF-2) covers authorization.

