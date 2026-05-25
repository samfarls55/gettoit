---

issue: sg-WF-2
title: Quiz Back + Exit chrome — S03 surface additions
status: done
type: AFK
feature: 0.1.0
github_issue: 155
created: 2026-05-19
---

# sg-WF-2 — Quiz Back + Exit chrome

## Parent

[[../../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] §Q5 — the three nav verbs (`Back`, `Exit`, `Delete`). This issue lands the design-system spec for the two in-quiz verbs (`Back` and `Exit`); `Delete` lives on the Plan list surface, which is a separate spec-gap.

## What to build

A design-system update to `design-system/surfaces/03-quiz.md` and `design-system/code/screens/ScreenQuiz.jsx` that adds two chrome affordances to every quiz screen (Q1 through Q5):

- **`Back`** — top-leading chrome on Q2 through Q5 only. Tapping it steps one question backward with the prior answer preserved and re-editable. Per-member; never affects room state. Q1 must not render a Back affordance (no prior question to return to).
- **`Exit`** — top-trailing chrome on **all** of Q1 through Q5. Tapping it opens a small confirmation sheet/alert, then on confirm drops the member from the active room (discards their in-flight answers), and returns them to the Plan list surface. The room remains alive for the remaining participants. For a solo session, exit == abandon the room; the Plan returns to `pending` on the user's list.

The label of the `Exit` affordance differs by role:
- **Initiator** sees `Exit` (their Plan stays as `pending` if quorum is lost; advances to `decided-active` if the remaining members reach verdict without them).
- **Joiner** sees `Leave` (same mechanic; different verb honors "this isn't your Plan to kill").

The canonical definitions for both verbs live in [[../../../CONTEXT|CONTEXT.md]] → `Plan back` and `Plan exit`. Match those semantics exactly.

### Chrome treatment

- **Position:** top of the surface, above the quiz question header. `Back` top-leading, `Exit` / `Leave` top-trailing.
- **Visual weight:** low. Existing `eyebrow` token treatment (Inter 700 / 11 / tracking 0.18 / UPPERCASE) so neither affordance competes with the primary chip-or-input area below.
- **Tap target:** 44pt min, per HIG.
- **No icons** — pure text labels. Matches the existing `SETTINGS` footer link convention.

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

- **Update:** `design-system/surfaces/03-quiz.md` — add a `Quiz chrome (Back + Exit)` section documenting placement, treatment, role-conditional labels, and the confirmation copy. Per-question rules (Q1 omits Back).
- **Update:** `design-system/code/screens/ScreenQuiz.jsx` — render both affordances per the rules; preserve the prior answer when `Back` is tapped.
- **Update:** `design-system/CHANGELOG.md` with a one-line entry.
- **Run:** `node design-system/scripts/verify.mjs` and confirm green.

## Acceptance criteria

- [ ] `surfaces/03-quiz.md` documents the Back + Exit chrome, including: per-question render rules (Back omitted on Q1), role-conditional labels (`Exit` vs `Leave`), placement, treatment, tap target, and the confirmation copy variants.
- [ ] `code/screens/ScreenQuiz.jsx` renders both affordances per the spec. Back preserves and re-editable the prior answer. Exit/Leave opens the confirmation sheet, then dispatches the member-drop action (no room mutation in the JSX — that's an iOS-wiring concern).
- [ ] Q1 does **not** render a Back affordance.
- [ ] The confirmation copy reads as specified in the doc — not paraphrased.
- [ ] `CHANGELOG.md` carries a one-line entry.
- [ ] `verify.mjs` is green.

## Blocked by

None — the verb definitions are locked in CONTEXT.md and the decisions doc.

## Comments

- **2026-05-19** — AFK agent closed on `afk/sg-wf-2`. Added `QuizChrome` to `code/components.jsx` (Back top-leading on Q2–Q5, Exit/Leave top-trailing on Q1–Q5, with confirmation alert + locked copy variants). Rendered on all five `code/screens/ScreenQ*.jsx` files; Q1 passes `canBack={false}`. C-02 TopBar's `×` made conditional and suppressed on quiz surfaces (chrome above owns Exit). Surface doc `surfaces/03-quiz.md` gained the §"Quiz chrome (Back + Exit)" section and the legacy "no back arrow / friction is the feature" cross-quiz invariant was retired in line with the workflow-overhaul plan §Q5. Accessibility doc updated (tap-target table + quiz focus order). CONTEXT.md "Plan exit" amended — the spec said "Q2 onward" which contradicted the parent decision doc + the Plan-back entry; harmonised to "Q1–Q5". Structural test landed at `design-system/scripts/test-quiz-chrome.mjs` (43 assertions, all green). `verify.mjs` green.
