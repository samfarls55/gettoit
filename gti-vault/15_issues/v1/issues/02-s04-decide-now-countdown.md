---
issue: 02
title: S04 — add Decide-now button + timer countdown to Waiting
github_issue: 20
status: ready-for-agent
created: 2026-05-12
surface: 04-waiting
prd: v1-prd
---

# 02 — S04: Decide-now button + timer countdown on Waiting

## Why

The v1 PRD ([[../../../10_prds/v1-prd|v1-prd.md]]) locks the verdict fire to **initiator-set timer OR initiator tap on the Waiting surface**, with a minimum quorum of 2 answers. The current `design-system/surfaces/04-waiting.md` explicitly reserves the "initiator force-verdict" affordance for v2 (line 39). This issue brings it into v1.

The Waiting surface also needs to display the timer countdown so the group knows how long auto-fire will take, and so the initiator can see how much margin remains before tapping "Decide now."

## Scope

- **Edit `design-system/surfaces/04-waiting.md`** to:
  - Add a section describing the initiator-only "Decide now" CTA. Disabled until at least 2 members have answered (initiator + 1). On tap, fires the verdict computation for whoever has answered.
  - Add a section describing the timer countdown — visible to all members, mono-tagged, rendered low-emphasis (white 0.7 or 0.6) near the bottom of the surface. Format: `"7:42 left"` or `"Auto-fires in 7:42"`.
  - Remove or rewrite the line "Initiator force-verdict is reserved for v2 (not in canonical screens)."
  - Add an edge case for: timer expires with only the initiator answered → room enters `expired` status, surface flips to a "Couldn't reach quorum tonight" terminal state. (Define copy alongside the implementation.)
- **Edit `design-system/code/screens/ScreenWaiting.jsx`** to render:
  - The "Decide now" CTA as a secondary `ghost` pill below the avatar row, visible only to the initiator. Disabled state (opacity 0.45) when `answered.length < 2`.
  - The countdown timer as mono-tag (`C-11 · Eyebrow` variant with mono family token) at the bottom of the surface.
- **Component reuse:** the `C-05 · Pill CTA` already has a `ghost` variant — that's the right primitive for "Decide now." The countdown reuses `mono-tag` typography.

## Acceptance criteria

- [ ] `design-system/surfaces/04-waiting.md` describes the Decide-now CTA + countdown + initiator-only visibility + min-quorum disabled state.
- [ ] `design-system/surfaces/04-waiting.md` no longer reserves force-verdict for v2.
- [ ] `design-system/code/screens/ScreenWaiting.jsx` renders both elements with correct states (initiator vs. invitee, quorum-met vs. quorum-not-met).
- [ ] Expired-quorum edge case is described with copy.
- [ ] `design-system/motion.md` updated if the CTA animates between disabled and enabled states.
- [ ] `node design-system/scripts/verify.mjs` passes.
- [ ] `design-system/CHANGELOG.md` updated.

## Open questions

- Whether the countdown should be live-ticking (every second) or coarse (every minute). Recommended: live every second, since the initiator is watching it to decide when to tap.
- Whether tapping "Decide now" requires a confirmation step. Recommended: no — the cost of the tap is on the initiator, and adding a confirmation undermines the speed promise. The button label can read `"Decide now · 3 of 5 in"` to make the partial-quorum cost explicit.

## Comments
