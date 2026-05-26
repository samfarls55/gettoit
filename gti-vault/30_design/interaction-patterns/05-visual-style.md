---
title: Visual style heuristics
source_chapter: 5 — Visual Style and Aesthetics
purpose: Visual-design audit lenses (no named patterns in this chapter; principles only)
---

# Visual Style — Heuristics

Ch.5 of the source has no named patterns. It is a set of visual-design heuristics. Most of the visual-token concerns (color palette, typography ramp, spacing scale) belong in the repo-root `design-system/` package; this doc captures the **audit lenses** for an agent reviewing whether visual choices support — or fight — the interaction patterns.

Source: Ch.5, *Designing Interfaces* 3rd ed.

## Why visual style is a workflow concern

The 2002 Stanford Web Credibility Project found that the #1 driver of user trust in software is *appearance*. Visual quality is not decoration; it gates whether users engage with the workflow at all. An interaction pattern correctly chosen but visually amateurish still loses users.

## The six visual-design dimensions

For each surface, apply these as audit lenses:

### V-01. Visual hierarchy

- **Audit lens**: Does the most important action / piece of information on the screen also *look* the most important (size, weight, color, position)?
- **Sub-checks**: Clarity (does the design communicate intent?), Actionability (does the user know what to do?), Affordance (do clickable things look clickable?), Composition (arrangement + proportion), Consistency (same components everywhere?), Alignment (elements don't shift between screens).
- **Red flag**: A primary CTA rendered with the same emphasis as tertiary links; multiple competing "primary" actions; emphasis-by-blink-or-animation.

### V-02. Color

- **Audit lens**: Does color usage survive the desaturation test (grayscale = still legible)? Are color-only signals also reinforced with shape or text (color-blindness safety)?
- **Sub-checks**: Dark fg / light bg contrast (or vice versa); warm vs cool intent matches mood; complementary color clashes avoided (e.g., bright blue on bright red); long-use designs are toned down (reduced saturation).
- **Red flag**: Critical state (error vs success) conveyed only by red/green; insufficient contrast for WCAG AA; full-saturation surfaces in an app meant for long sessions.

### V-03. Typography

- **Audit lens**: Is body text >=10pt (12pt is the standard for body)? Is leading (line spacing) generous enough that ascenders/descenders don't collide? Is the type ramp consistent across screens?
- **Sub-checks**: One main body face; secondary faces only in small areas (nav, captions); kerning sane for headlines.
- **Red flag**: Multiple body faces; sub-9pt copy; tight leading on long-form text; jumbled type ramp where similar elements have different sizes.

### V-04. Readability

- **Audit lens**: Can the typical user read it under typical conditions (mobile in sun, small screen, bifocals)? Is line length 45-75 characters?
- **Red flag**: Overlong measure (>75ch lines); low-contrast gray-on-white body copy; text inside dense imagery.

### V-05. Evoking a feeling

- **Audit lens**: Does the visual register (warm/cool, spacious/dense, classical/modern) match the brand and the user's emotional state when they reach the screen?
- **Sub-checks**: Spaciousness (calm, airy) vs crowding (urgent, dense); angles vs curves; cultural references appropriate to audience; repeated visual motifs unify the design.
- **Red flag**: Playful illustration on a control panel for safety-critical operations; dense industrial layout on a leisure app; cultural references the audience won't get.

### V-06. Images

- **Audit lens**: Do images carry meaning beyond decoration? Is there a sensible empty/placeholder state?
- **Red flag**: Stock photography that contradicts the product's voice; images that block content load; missing alt text.

## Accessibility (cross-cutting)

The chapter calls this out specifically, but it cuts across all six dimensions.

- **Audit**: Does the design work with OS high-contrast themes? With OS large-text setting? With screen readers?
- **Required**: WCAG 4.5:1 contrast on body text; focus indicators on every focusable control; semantic markup (not div-soup); alt text on images that convey meaning.
- **Red flag**: Color-only state signals; text rendered as images; focus indicators removed by CSS reset.

## Range of visual styles (when to choose which)

The chapter catalogs five visual styles. Pick one consciously per product:

| Style | When to choose | Audit signal |
| --- | --- | --- |
| **Skeuomorphic** | Onboarding a novel interaction; metaphor accelerates learning (e.g., early iPad). | UI mimics real-world object surfaces. |
| **Illustrated** | Brand wants warmth, approachability; tone matters more than data density. | Bespoke illustration is core to onboarding/empty states. |
| **Flat** | Clarity-first; multi-platform consistency; emphasis on content over chrome. | Solid fills, minimal shadow, clear iconography. |
| **Minimalistic** | Task-based app where doing is more important than browsing; viewing > input. | Few UI cues; relies on gesture + position. |
| **Adaptive / Parametric** | Camera/AR/data-driven UI that emerges with the object. | UI is invisible until the right context, then appears around the target. |

Mixing styles across one product is the strongest red flag in this section.

## How this chapter ties back to interaction patterns

- Bad visual hierarchy defeats [[01-foundations-cognition#P-03. Satisficing]] (users scan and pick wrong).
- Inconsistent placement defeats [[01-foundations-cognition#P-09. Spatial Memory]].
- Inaccessible color defeats keyboard-only and screen-reader users — see [[01-foundations-cognition#P-12. Keyboard Only]].
- Excessive crowding fights [[04-layout#Visual Framework]] and [[04-layout#Center Stage]].

Treat this chapter as the *visual scaffold* under which the interaction patterns operate. For codebase audit: confirm there is ONE design-system surface (tokens + ramp) and every screen consumes it.
