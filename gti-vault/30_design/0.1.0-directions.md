---
title: 0.1.0 Design Directions — Three Aesthetics
description: Three aesthetic directions for the 0.1.0 food vertical, all using the same locked quiz + verdict mechanic. Built as a Next.js prototype at design-prototype/.
type: design-exploration
status: superseded
created: 2026-05-12
related:
  - "[[frontend-design-brief]]"
  - "[[refero-pattern-extract]]"
  - "[[0.1.0-design-locks]]"
  - "[[60_engineering/adr/0001-ios-tech-stack-supabase]]"
---

# 0.1.0 Design Directions — Three Aesthetics

> **Superseded — design exploration archived.** Direction C (Sunset Pop) was chosen and built out as the full design system at `design-system/` (repo root). The `design-prototype/` Next.js app the "How to view" steps below describe no longer exists. Kept as a historical record of the three-direction exploration.

Same flow (5-question quiz → verdict), three visual personalities. Each draws from a distinct Refero pattern family (see [[refero-pattern-extract]]).

## How to view

```
cd design-prototype
npm install   # if not already
npm run dev   # localhost:3033
```

Routes:

- `/` — direction picker with swatches.
- `/a` — Warm Receipt.
- `/b` — Quiet Serif.
- `/c` — Sunset Pop.

The prototype renders inside an iPhone 14-sized frame on a dark stage so the design reads at the right scale.

> **Prototype only.** 0.1.0 ships native iOS in Swift + SwiftUI per [[60_engineering/adr/0001-ios-tech-stack-supabase|ADR 0001]]. Web prototype is for design exploration; component decisions translate to SwiftUI in implementation.

## Direction A — Warm Receipt

**Voice.** Diner counter at golden hour. Tactile. The verdict feels like something printed on receipt paper that you can fold and put in your wallet.

- **Palette.** Cream `#F5EFE3` · ink `#0E1011` · clay `#C4593F` · ember `#E07A3D`.
- **Type.** Roboto Slab for headlines and place names, Inter for body, JetBrains Mono for the voice-receipt row.
- **Quiz chassis.** Clay-bordered option cards on cream, ink-pill primary CTA, segmented progress bars.
- **Verdict treatment.** Scalloped-edge "receipt" panel, place name in heavy slab serif, voices set in monospace right-aligned columns, clay "I'm in" pill.
- **Refero references.** LEGO Builder cream bottom sheet (`d8b7eb12`), Foodvisor peach selection (`d35736ad`), Brilliant ink CTA (`6f14cce9`).

**Best for.** Warm, lateral, group-of-friends register. Reads as "we made this together." Most distinctive verdict format of the three.

**Risk.** Receipt motif is a one-trick if it doesn't translate to non-food verticals (activities, bars). Re-evaluate when v2 verticals get scoped.

## Direction B — Quiet Serif

**Voice.** Editorial. End-of-workday calm. The verdict is a single elegant statement, not a dashboard.

- **Palette.** Off-white `#FAFAF7` · ink `#0E1011` · moss `#5C6B4F` (single accent).
- **Type.** Instrument Serif for display, Cormorant Garamond for body, Inter for system text.
- **Quiz chassis.** Divide-line option rows (no cards), hairline progress dashes, voluntary "next →" in bottom-right serif.
- **Verdict treatment.** Centered serif name, hairline divider, italic rule sentence, italic voice receipts. "i'm in" is a tappable serif word, not a button.
- **Refero references.** 222 "curation refined" (`da202faa`), 222 group choice (`e66c8eef`), Stardust serif statement (`5fadaafc`).

**Best for.** Friend-group register without the cuteness — closer to "we're adults choosing a restaurant" than "we just won a prize." Tones down equity-tracking risk because the verdict is just a statement, not a celebration.

**Risk.** May read as too quiet for end-of-workday decision-fatigued users who want the app to *push* the verdict. Watch follow-through metric closely if this wins.

## Direction C — Sunset Pop

**Voice.** Party-mode wrapper for the seriousness underneath. Loud finality — the conversation is over.

- **Palette.** Per-screen gradient (coral → magenta → indigo → midnight) · ink `#0E1011` · sun `#FFD23F` accent.
- **Type.** Inter Black for all display, regular Inter for body. No serif.
- **Quiz chassis.** Pill option chips on gradient, white pill CTA, thick progress bars.
- **Verdict treatment.** Full-bleed gradient hero, ALL-CAPS stacked place name at 64px, sun-yellow time block, glass receipt chips, "DROP THE VERDICT" / "I'M IN" all-caps CTAs.
- **Refero references.** LEGO Builder hero (`d8b7eb12`), Drops onboarding (`d8261984`), Stardust gradient (`4cef636f`).

**Best for.** Closing the conversation hard. The display-size verdict is unambiguous — no negotiation room.

**Risk.** Verdict copy framework warns against "the algorithm picked" framing — this direction's confidence could *read* as the app deciding rather than the rule + inputs. Need careful copy work on the rule chip to keep aggregate-rule attribution intact. Also pushes "celebration" mood which can tip into equity-by-tracking if not careful.

## Comparison

| | A — Warm Receipt | B — Quiet Serif | C — Sunset Pop |
|---|---|---|---|
| Energy | Warm, tactile | Quiet, editorial | Loud, definitive |
| Finality device | Receipt artifact | Single serif statement | Display-size wordmark |
| Risk on locks | Receipt vertical-lock | Too-quiet for fatigue | Algorithm-as-decider drift |
| Translates to SwiftUI | Easy (custom shapes) | Easiest (text + dividers) | Medium (gradient + layout) |
| First-touch wow | Medium | Low | High |
| Read-it-twice depth | High | High | Low |

## Open decisions

- **Direction lock.** No commitment yet. Walk all three end-to-end before locking.
- **Tone copy.** Verdict-screen strings need final pass — owned by `40_marketing_branding/` per `[[0.1.0-design-locks]]` Lock 4 "Open".
- **Q4 axis label.** Currently "low-key ↔ lively". `[[0.1.0-design-locks]]` flags cuisine/vibe/energy as open — locked here as vibe.
- **Reroll + check-in surfaces.** Out of scope for this exploration. Frontend brief lists 7 surfaces; this prototype covers 2 (quiz, verdict).

## Next session

1. Lock direction (or hybrid).
2. Translate locked direction to SwiftUI tokens (colors, typography, spacing scale).
3. Design the 5 remaining surfaces (initiator, invite, waiting, reroll, check-in) in the locked direction.
