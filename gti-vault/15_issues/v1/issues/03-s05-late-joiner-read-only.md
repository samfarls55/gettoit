---
issue: 03
title: S05 — add read-only mode for late-joiner Verdict
github_issue: 21
status: done
completed: 2026-05-12
created: 2026-05-12
surface: 05-verdict
prd: v1-prd
---

# 03 — S05: read-only mode for late-joiner Verdict

## Why

The v1 PRD ([[../../../10_prds/v1-prd|v1-prd.md]]) locks the late-joiner behavior: a user who taps the invite link AFTER the verdict ships sees the verdict on a read-only surface with a re-invite CTA below. They cannot retroactively influence the closed decision.

The current `design-system/surfaces/05-verdict.md` has three modes (`default`, `cuts`, `committed`) — none of them is the read-only mode for late-joiners.

## Scope

- **Edit `design-system/surfaces/05-verdict.md`** to:
  - Add a fourth mode: `read-only`. Visible state — verdict hero + meta + time badge + rule chip + voice receipts (with the late-joiner not in the receipts). Suppressed: ratification CTA, reroll affordance, "Start over" secondary.
  - Replace the primary CTA with a re-invite CTA reading `"Start a new decision"` (white pill, `C-05` canonical variant).
  - Add an eyebrow modifier — `"Tonight's verdict"` (past-tense-implicit) instead of `"Tonight, the verdict is"`.
  - Document the behavior: tapping the re-invite CTA returns to the Initiator Landing surface (S01) with the user as the new initiator.
- **Edit `design-system/code/screens/ScreenVerdict.jsx`** to support `mode === 'read-only'` via the existing `mode` prop. Render the suppressed elements as `null` rather than as disabled-styled placeholders.
- **Voice-receipt row** in read-only mode shows only the members who actually answered. The late-joiner's chip does not appear. This is honest — they didn't contribute.

## Acceptance criteria

- [ ] `design-system/surfaces/05-verdict.md` describes the `read-only` mode with all suppressed and substituted elements.
- [ ] `design-system/code/screens/ScreenVerdict.jsx` accepts `mode='read-only'` and renders accordingly.
- [ ] The five-second test from the surface doc still applies to the read-only mode in the limited form (verdict + rule + voice-receipts; ratification path is N/A).
- [ ] Choreography in read-only mode: same reveal sequence except the CTA fade-up at 1380ms now lands on the re-invite CTA. Document in `motion.md`.
- [ ] `design-system/accessibility.md` notes the VO order change for read-only mode.
- [ ] `node design-system/scripts/verify.mjs` passes.
- [ ] `design-system/CHANGELOG.md` updated.

## Open questions

- Whether the late-joiner sees the cuts drawer ("See what got cut →") affordance. Recommended: yes — informational, not actionable. Reading the elimination chain is part of understanding what they missed.
- Whether the re-invite CTA pre-populates the new room with the prior room's `timer_minutes` and `radius_meters` values. Recommended: yes — the late-joiner is likely planning a similar outing, defaults from the prior room save a tap.

## Comments
