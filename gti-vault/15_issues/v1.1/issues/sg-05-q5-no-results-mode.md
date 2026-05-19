---
issue: sg-05
title: Q5 no-results mode — design-system surface spec
status: done
type: AFK
github_issue: 136
prd: v1.1-quiz-redesign-prd
created: 2026-05-19
---

# sg-05 — Q5 no-results mode

## Context

The iOS app currently papers over an empty Q5 candidate pool with three
hardcoded fictitious restaurants (`QuizDummyCandidates`). A 2026-05-19 design
session decided to remove all fictitious venues — the app must never surface a
made-up place to a user. Q5 therefore needs a real specced state for "the
per-member venue fetch produced nothing rateable."

This issue specs that state in `design-system/`. The iOS consumption is the
paired tracer bullet (tb-26), which is blocked on this spec — mirroring the
existing `sg-02`→`tb-01` / `sg-04`→`tb-03` pairing.

## What to build

Add a **`no-results` mode** to the Q5 quiz surface. Today Q5
(`design-system/surfaces/03-quiz.md` §Q5, `design-system/code/screens/ScreenQ5Regret.jsx`)
renders exactly one layout: three factorial candidate cards with 1–5 excitement
raters. The new mode is the second layout — structured the same way the Verdict
surface documents its `no-survivor` mode (`design-system/surfaces/05-verdict.md`),
which is the canonical precedent to follow.

The mode composes entirely from existing primitives — **no new component, no new
token**:

- C-01 gradient surface (the Q5 gradient stops, unchanged).
- C-02 top bar (× + 5-segment progress, segment 5 active).
- A headline + body block (the C-03 question-header family, or the centered
  block treatment used by the verdict `no-survivor` mode — match that precedent).
- C-05 primary pill CTA, **sun fill**.

The three rater cards and the `"Drop the verdict"` CTA are suppressed in this
mode.

### Locked copy

The copy below is locked — reproduce it exactly.

- **Headline:** `No spots to rate near you.`
- **Body:** `Couldn't line up rateable spots in your radius tonight. Your other answers still count — the verdict lands without this step.`
- **CTA:** `Head to the verdict` (C-05, sun fill — action-shaped, per the
  design system's ban on generic `Next` / `Continue` / `OK` CTAs).

## Acceptance criteria

- [ ] `surfaces/03-quiz.md` §Q5 documents the `no-results` mode: the trigger
      condition (the per-member fetch produced no factorial-usable pool), the
      rendered elements, the suppressed elements (the three rater cards, the
      `"Drop the verdict"` CTA), and the locked copy.
- [ ] `code/screens/ScreenQ5Regret.jsx` renders the `no-results` mode via a
      `mode` prop / variant, mirroring `ScreenVerdict.jsx`'s mode handling.
- [ ] The mode uses only existing components (C-01 / C-02 / C-03 / C-05) and
      existing tokens — no new component, no new token, no inline hex / px /
      easing literals.
- [ ] The locked copy is reproduced exactly (headline, body, CTA label).
- [ ] `design-system/CHANGELOG.md` has an entry for the new mode.
- [ ] `node design-system/scripts/verify.mjs` passes — all gates green.

## Out of scope

- Any iOS / Swift code — the Swift consumption of this mode is tb-26.
- The verdict-side `no-survivor` mode — already specced; unchanged. This is its
  Q5-flow analogue, a distinct surface.
- New components or tokens. If the mode appears to need one, that is a genuine
  spec gap — stop and flag it, do not invent.

## Blocked by

- None — can start immediately.

## Comments

- **2026-05-19 — done (AFK, PR #138).** Added the `no-results`
  mode to the Q5 surface. `code/screens/ScreenQ5Regret.jsx` now takes a
  `mode` prop (`default` | `no-results`), mirroring `ScreenVerdict.jsx`'s
  mode handling. The `no-results` branch renders the C-02 TopBar (segment 5
  active), a centered C-03 headline + body block, and a sun-fill C-05 CTA
  `"Head to the verdict"`; the three factorial rater cards and the
  `"Drop the verdict"` CTA are suppressed. `surfaces/03-quiz.md` §Q5 gained
  a Modes table + a `no-results` section documenting the trigger, rendered
  / suppressed elements, and the locked copy. No new component, no new
  token — composes from existing C-01 / C-02 / C-03 / C-05 and existing
  tokens. `node design-system/scripts/verify.mjs` passes all gates. tb-26
  is now unblocked.
