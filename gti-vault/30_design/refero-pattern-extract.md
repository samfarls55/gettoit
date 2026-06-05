---
title: Refero Pattern Extract â€” Quiz + Verdict Loop
description: Common UI/UX patterns observed in Refero across iOS quiz, verdict-reveal, group-lobby, and result-card flows. Feeds the 0.1.0 prototype directions.
type: research-extract
status: superseded
created: 2026-05-12
related:
  - "[[frontend-design-brief]]"
  - "[[0.1.0-design-locks]]"
  - "[[0.1.0-directions]]"
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Refero Pattern Extract â€” Quiz + Verdict Loop


Patterns harvested from Refero screen + flow search for the surfaces GetToIt 0.1.0 needs: quiz (5 questions, one-decision-per-screen) and verdict reveal (single recommendation, copy-framework-locked). Apps cited are reference points, not models to copy.

## Quiz screen â€” common chassis

Across Brilliant, Foodvisor, Vocabulary, Plantum, Stardust, LinkedIn assessment, Microsoft Copilot quiz, NYT survey:

- **Top bar**: close `Ã—` left, horizontal progress bar (filled segment + step dots) center, optional accessory icon right (hint / lightning).
- **Question text**: 1â€“2 lines, generous size (â‰ˆ22â€“28px), left-aligned or centered, sans-serif or serif depending on register.
- **Options**: full-width rounded rectangles stacked vertically (3â€“5 options), or pill-shaped (Vocabulary). Selected state = colored border + filled radio/checkmark on right or left.
- **Bottom CTA**: single primary button â€” black ("Check" in Brilliant), brand-colored, or pill-shaped. Disabled until selection.

Selected-state treatments seen:

- Brilliant: green border + green text + right-side checkmark on light-green tint.
- Plantum: green border + left-side circular check, white interior.
- Foodvisor: peach background fill, bold text, no checkmark needed.
- Vocabulary (Lingvist): thicker black border on pill + filled radio dot on right.

Reference screens: `e0d7c92f` (Brilliant), `d8dd8b0e` (Plantum), `d35736ad` (Foodvisor), `3c88e3d4` (Vocabulary), `4cef636f` (Stardust).

## Verdict / reveal screen â€” three families

Refero results cluster into three distinct reveal aesthetics. Each maps to a candidate direction.

### Family 1 â€” Premium calm (serif on dark or cream)

Apps: **222** (dark green + cream serif), **Blackbird Club** (textured deep purple + monospace badges), **Stardust** (starry gradient + serif statements).

Common moves:

- Single statement, large serif, generous vertical centering.
- "Tap to continue" prompt â€” voluntary register, no coercive Confirm/Accept.
- Decorative-but-quiet motif (stars, concentric rings, grain texture).
- Information chips (badges, pill labels) for the rule that produced the recommendation.

Reference screens: `da202faa` (222 curation refined), `ca7f78b2` (Blackbird), `e66c8eef` (222 invite cards).

### Family 2 â€” Party / playful (saturated hero + cream sheet)

Apps: **LEGO Builder** (red hero + cream bottom sheet + heavy numeric code), **ten ten** (black + chunky white circle CTA + PIN pill).

Common moves:

- Hero zone (top 60%) carries product/avatars, bottom sheet carries the data.
- Display-size numeric or wordmark â€” the verdict *is* the typography.
- Avatar bubbles with name-tag chips â€” group identity surfaced fast.
- Bold rounded primary buttons.

Reference screens: `d8b7eb12` (LEGO party number), `1f1b65e8` (ten ten waiting + PIN).

### Family 3 â€” Editorial minimal (white + ink + single accent)

Apps: **Brilliant** results, **Google Maps** review post, **NYT** survey, **Klarna** filter modal.

Common moves:

- Off-white background, near-black ink, one accent color used sparingly.
- Result is a card or panel â€” clear borders, no decoration.
- Aggregate rule shown as a tag/chip row, tappable.
- Black pill CTA at bottom â€” Brilliant style.

Reference screens: `19f177d8` (Brilliant correct), `6545e404` (Brilliant chart), `f84748af` (NYT survey).

## Group lobby / waiting

Apps: **LEGO Builder**, **ten ten**, **222** "invite friends to..." cards.

Common moves:

- Large shareable code (LEGO: "192 935", ten ten: "PIN: 035ofz2") with copy affordance.
- "Waiting for X" honest copy â€” no anxiety-inducing spinners.
- Avatar ring around the hero â€” who's here vs. who's pending.
- Disabled primary CTA labeled with the blocker ("Waiting to start") flips to active when ready.

Reference screens: `d8b7eb12` (LEGO), `1f1b65e8` (ten ten), `e66c8eef` (222 group choice).

## Anti-patterns Refero shows that GetToIt's locks already reject

- Ranked-list result reveals (most quiz apps with leaderboards) â€” re-imports the choice problem.
- Per-member vote tallies on result screen (Telegram poll, `10ddcc78`) â€” equity-by-tracking.
- Confirm/Accept primary copy (Google Maps suggestion modal, `7fa8812b`) â€” coercive register.
- Rate-each-option Likert (Stardust archetype, `5fadaafc`) â€” Maximizer scaffolding.

These confirm the brief's locks rather than challenge them.

## Three directions this extract feeds

| Direction | Quiz chassis | Verdict family | Reference |
|---|---|---|---|
| **A â€” Warm Receipt** | Foodvisor-style peach selection + Brilliant progress | Family 2 reworked: cream sheet over warm hero, slab-serif verdict as "receipt" | LEGO bottom sheet, Foodvisor |
| **B â€” Quiet Serif** | Pill options (Vocabulary) on off-white | Family 1: serif statement, single accent, tap-to-continue ratification | 222, Stardust serif treatment |
| **C â€” Sunset Pop** | Per-question gradient backgrounds, bold sans options | Family 2 amped: gradient hero + large numeric/wordmark verdict | LEGO, Drops onboarding, Stardust gradient |

Direction docs in [[0.1.0-directions]]; live prototype in `design-prototype/`.
