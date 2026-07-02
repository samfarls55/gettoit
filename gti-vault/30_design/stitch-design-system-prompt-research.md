---
title: Google Stitch prompt research for GetToIt redesign
status: draft
date: 2026-07-01
type: research-note
---

# Google Stitch prompt research for GetToIt redesign

## Findings

- Stitch works best as an iterative design partner, not a one-shot app generator: start with a clear high-level direction, then refine screen by screen with one or two specific changes per prompt. Source: https://discuss.ai.google.dev/t/stitch-prompt-guide/83844
- For complex apps, Stitch staff recommend plain language, not XML/JSON prompt structures; start simple, then add detail screen by screen. Source: https://discuss.ai.google.dev/t/stitch-prompt-guide/83844
- Multi-screen consistency has been a known pain point. Current best practice is to use Stitch's DESIGN.md / design system feature as the source of truth, with explicit hex codes, radii, typography, nav rules, and component rules. Source: https://discuss.ai.google.dev/t/support-project-level-component-extraction-and-reuse-in-stitch-to-improve-ui-consistency-across-generated-screens/138485
- Google says DESIGN.md lets Stitch import/export design rules so it understands the reasoning behind the design system, can match the brand, and can validate choices against WCAG accessibility rules. Source: https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/
- Stitch accepts natural-language prompts, image/wireframe inputs, multiple variants, Figma handoff, and front-end code export. Source: https://developers.googleblog.com/stitch-a-new-way-to-design-uis/

## Recommended Stitch workflow

1. Use one seed prompt to create the design system and 4-6 anchor screens.
2. Ask Stitch to generate or update DESIGN.md from the best variant.
3. Refine one screen at a time, always telling Stitch to preserve DESIGN.md tokens and components.
4. For drift, select all screens and ask Stitch to standardize shared chrome/components against the best screen.

## Copy-ready seed prompt

```text
Design a mobile-first design system and app redesign direction for GetToIt.

GetToIt is a React Native / Expo iOS app that ends group "where should we eat?" indecision. A user creates a Plan, shares it with friends, everyone answers a short quiz, and the app returns one restaurant verdict the group can live with. The product goal is follow-through: the group actually goes.

Create the system as if it will become a reusable Stitch DESIGN.md source of truth plus anchor screens. Prioritize consistency, not one-off spectacle.

Platform:
- Mobile-first iOS app, React Native / Expo implementation later.
- Design for one-handed phone use, tired end-of-workday users, and <60 second sessions.
- Use native-feeling controls and states that can be implemented with React Native primitives.

Core personality:
- Warm friend, not court formal.
- Decisive and calm: the app ends the conversation.
- Honest mechanics: the rule + member inputs are the decider, not "the algorithm."
- Social but not celebratory. No confetti, trophies, winner language, or "your turn" equity framing.

Current token anchors to preserve and expand:
- Ink / off-black: #0E1011 for dark app background and primary text on light accents.
- Paper: #FFFFFF for primary text and white pill buttons.
- Sun accent: #FFD23F for selected states, important badges, and high-salience actions.
- Glass stroke: rgba(255,255,255,0.42) for borders on dark/gradient surfaces.
- Text on gradient: rgba(255,255,255,0.78) secondary, rgba(255,255,255,0.60) tertiary.
- Typography should be bold, clean sans-serif, with strong display weight for verdict/place names, compact uppercase eyebrow labels, and readable 16px-ish body text.
- Spacing should be simple and reusable: 4, 8, 12, 16, 24, 32, 48, 64.

Design system deliverables:
1. A DESIGN.md-style design system with:
   - Visual theme and atmosphere.
   - Color palette with exact hex/rgba values and functional roles.
   - Typography ramp with display, heading, body, eyebrow, button, mono/meta styles.
   - Spacing, radius, elevation/glass, and motion rules.
   - Accessibility rules: 44pt+ tap targets, WCAG contrast, reduced motion.
   - Anti-patterns/bans.
2. Component set:
   - App shell / top bar.
   - Section header.
   - Plan list row/card.
   - Joined badge.
   - Overflow/action-dot menu.
   - Floating create button.
   - Primary pill button.
   - Secondary/ghost pill button.
   - Text/eyebrow action.
   - Single-select chips.
   - Multi-select chips.
   - Text input.
   - Search area chip and map picker chrome.
   - Progress indicator for quiz.
   - Question header.
   - Rating card for Q5.
   - Waiting participant dots.
   - Verdict hero.
   - Rule chip.
   - Member receipt chip.
   - Reroll-with-reason sheet.
   - Check-in card.
   - Empty, loading, error, disabled, selected, pressed states.
3. Anchor screens:
   - Plan List: empty state and populated state with Pending, Decided, History sections.
   - Create Plan / Setup screen: name, solo/group, search area, meal time, service mode, launch/save CTAs.
   - Quiz screen: one question per screen, progress, chips/rating states.
   - Waiting screen: calm coordination state with member progress.
   - Verdict screen: one restaurant, implementation intention, rule proof, member receipts, "I'm in" ratification, reroll path.
   - Reroll reason sheet and next-day check-in card.

Product rules the design must respect:
- Never show ranked lists or "top 3" choices.
- Never show per-member vote tallies or "Alice won" framing.
- Use aggregate-rule copy: "Budget cap cut Sushi Ren", not "Alex said no."
- Use commitment copy: "I'm in", not "Confirm" or "Accept."
- The verdict screen must pass this 5-second test: the user sees the verdict, the rule that produced it, proof their voice counted, the ratification action, and a friction-bearing correctability path.
- Reroll is capped and reason-based; make it feel intentional, not slot-machine-like.

Visual direction:
- Use the current ink / paper / sun / glass foundation, but make it feel more polished, durable, and systemized.
- Avoid generic AI-app purple/blue gradients, neon glows, beige wellness palettes, cartoon mascots, and stock-looking food imagery.
- The interface should feel social, fast, and decisive, with enough warmth that the losing voter still trusts the process.
- Prefer real UI density over marketing-page drama. This is an app, not a landing page.

Output format:
- First show the DESIGN.md-style design system.
- Then show the component inventory with states.
- Then generate the anchor mobile screens using the same tokens and components.
- Keep shared chrome, typography, radii, icon style, and button treatments identical across screens.
- Do not redesign the style independently per screen.
```

## Follow-up prompts after the seed

```text
Generate the DESIGN.md from this selected variant. Include exact colors, typography, spacing, radii, component rules, motion, accessibility, and anti-patterns. This DESIGN.md is the source of truth for future GetToIt screens.
```

```text
Refine only the Verdict screen. Preserve the DESIGN.md exactly. Improve the 5-second read: verdict, rule proof, member receipt, I'm in action, and reroll path. Do not change colors, typography, radii, or shared components.
```

```text
Select all screens and standardize shared chrome, buttons, chips, cards, typography, spacing, and icon style to match the DESIGN.md and the Verdict screen. Do not alter screen-specific content.
```
