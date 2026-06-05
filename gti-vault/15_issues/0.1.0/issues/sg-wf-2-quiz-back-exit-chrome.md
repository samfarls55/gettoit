---

issue: sg-WF-2
title: Quiz Back + Exit chrome â€” S03 surface additions
status: done
type: AFK
feature: 0.1.0
github_issue: 155
created: 2026-05-19
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# sg-WF-2 â€” Quiz Back + Exit chrome

## Parent


## What to build


- **`Back`** â€” top-leading chrome on Q2 through Q5 only. Tapping it steps one question backward with the prior answer preserved and re-editable. Per-member; never affects room state. Q1 must not render a Back affordance (no prior question to return to).
- **`Exit`** â€” top-trailing chrome on **all** of Q1 through Q5. Tapping it opens a small confirmation sheet/alert, then on confirm drops the member from the active room (discards their in-flight answers), and returns them to the Plan list surface. The room remains alive for the remaining participants. For a solo session, exit == abandon the room; the Plan returns to `pending` on the user's list.

The label of the `Exit` affordance differs by role:
- **Initiator** sees `Exit` (their Plan stays as `pending` if quorum is lost; advances to `decided-active` if the remaining members reach verdict without them).
- **Joiner** sees `Leave` (same mechanic; different verb honors "this isn't your Plan to kill").

The canonical definitions for both verbs live in [[../../../CONTEXT|CONTEXT.md]] â†’ `Plan back` and `Plan exit`. Match those semantics exactly.

### Chrome treatment

- **Position:** top of the surface, above the quiz question header. `Back` top-leading, `Exit` / `Leave` top-trailing.
- **Visual weight:** low. Existing `eyebrow` token treatment (Inter 700 / 11 / tracking 0.18 / UPPERCASE) so neither affordance competes with the primary chip-or-input area below.
- **Tap target:** 44pt min, per HIG.
- **No icons** â€” pure text labels. Matches the existing `SETTINGS` footer link convention.

### Confirmation copy

`Exit` (initiator):
- Title: `Exit this plan?`
- Body: `Your answers will be discarded. Others can still finish without you.`
- Confirm button: `Exit`
- Cancel button: `Keep going`

`Leave` (joiner):
- Title: `Leave this plan?`
- Body: `Your answers will be discarded. The host and others can still finish.`
- Confirm button: `Leave`
- Cancel button: `Keep going`

Solo session (no joiners, never shared the invite):
- Title: `Exit this plan?`
- Body: `Your answers will be discarded. Your plan will stay saved so you can start over.`
- Confirm button: `Exit`
- Cancel button: `Keep going`

### Files to write / edit


## Acceptance criteria

- [ ] `surfaces/03-quiz.md` documents the Back + Exit chrome, including: per-question render rules (Back omitted on Q1), role-conditional labels (`Exit` vs `Leave`), placement, treatment, tap target, and the confirmation copy variants.
- [ ] `code/screens/ScreenQuiz.jsx` renders both affordances per the spec. Back preserves and re-editable the prior answer. Exit/Leave opens the confirmation sheet, then dispatches the member-drop action (no room mutation in the JSX â€” that's an iOS-wiring concern).
- [ ] Q1 does **not** render a Back affordance.
- [ ] The confirmation copy reads as specified in the doc â€” not paraphrased.
- [ ] `CHANGELOG.md` carries a one-line entry.
- [ ] `verify.mjs` is green.

## Blocked by

None â€” the verb definitions are locked in CONTEXT.md and the decisions doc.

## Comments

