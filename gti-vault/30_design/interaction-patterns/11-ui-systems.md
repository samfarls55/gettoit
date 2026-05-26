---
title: UI systems, atomic design, frameworks, and emerging interfaces
source_chapter: 11+12 — User Interface Systems and Atomic Design; Beyond and Behind the Screen
purpose: Audit lenses for whether the codebase treats UI as a system, not as one-off screens
---

# UI Systems — Audit lenses

Ch.11 and Ch.12 of the source are not pattern chapters. They argue that modern interaction design *is* designing a system of reusable components, and they catalog the most common JS/CSS UI frameworks. This doc translates that argument into audit lenses for a codebase review.

Source: Ch.11, Ch.12, *Designing Interfaces* 3rd ed.

## Why this matters for workflow design

If the codebase is built one screen at a time without a component system, every fix is local and "UX debt" accumulates: similar controls drift apart in look, feel, and behavior. Users hit [[01-foundations-cognition#P-07. Habituation]] failures and [[01-foundations-cognition#P-09. Spatial Memory]] failures across the app. A systems approach is prerequisite to consistent execution of any pattern in this catalog.

## S-01. UI design system exists and is enforced

- **Audit lens**: Is there a single source of truth for visual tokens + component primitives? Do screens consume it rather than redefine elements?
- **Signals present**: A `design-system/` (or equivalent) package; tokens file (color, type, space, motion); shared component library imported by every screen; lint rules or PR review that block raw-style screen code.
- **Signals missing / red flag**: Inline styles diverging across screens; copies of the same control with different padding/colors; per-screen CSS bundles redefining primitives.

## S-02. Atomic-design hierarchy is visible in the code

Atomic design defines five layers; the codebase should reflect them:

| Layer | Definition | Example |
| --- | --- | --- |
| **Atoms** | Smallest functional units — can't be broken further. | Text input, label, color token, typeface. |
| **Molecules** | 2+ atoms forming a working component. | Form field = input + label + hint + prompt. |
| **Organisms** | Complex objects assembling molecules. | Header = logo + global nav (Fat Menus) + search + Sign-In Tools + avatar + notifications. |
| **Templates** | Layout recipes — page-level scaffolds without content. | Report-with-chart template, list-with-detail template. |
| **Pages** | Templates filled with real content. | Specific dashboard / specific article. |

- **Audit lens**: Can you point to where each layer lives in the codebase? Are templates explicit (not just hand-built one-off layouts)?
- **Red flag**: No template layer — every screen handcrafted. Or: atomic component edited inline in one screen, forking it from the rest of the system.

## S-03. UI framework choice and discipline

The book catalogs Bootstrap, Foundation, Semantic UI, Materialize, Blueprint, UIkit, plus platform systems (Microsoft Fluent, Apple HIG, Google Material). The point is not which one — it's that you've picked one and use it consistently.

- **Audit lens**: Which UI framework / design system underlies the app? Are framework-shipped components used, or hand-rolled equivalents? Where overrides exist, are they isolated and documented?
- **Signals present**: One framework / design system; theming layer for brand customization; almost no per-screen forks of framework components.
- **Signals missing / red flag**: Two or more frameworks coexisting; framework imported but overridden so aggressively the framework no longer carries semantics; custom component reinventing a framework primitive.

## S-04. Style inheritance + propagation

Atomic design's promise is that changing a token cascades everywhere. Audit this is real.

- **Audit lens**: If you change one color/spacing token, does every consumer pick it up automatically?
- **Signals present**: CSS variables / theme tokens consumed by every component; design tokens shared between design tools and code (Style Dictionary / Tokens Studio / equivalent).
- **Red flag**: Hardcoded hex values scattered through screen code; theme switch breaks visuals; token change requires touching N screens.

## S-05. Responsive and cross-platform consistency

- **Audit lens**: Does the same user task look and behave consistently across the browsers, devices, and screen sizes the app targets? Are platform-specific component variants (e.g., date picker on iOS vs Android vs web) handled by the framework, not the screen?
- **Red flag**: Per-platform divergent screens forked at the page level; mobile + desktop builds drift; one platform missing components the other has.

## S-06. Framework as floor, not ceiling

The chapter explicitly warns: UI frameworks are a starting point. They are a *floor* (saving time, ensuring baseline consistency), not a *ceiling* (limiting design innovation).

- **Audit lens**: Has the team customized + extended the framework where it serves the product, while still consuming framework primitives for the common cases? Or has the team accepted defaults uncritically and shipped a vanilla-looking product?
- **Red flag (over-customization)**: Every primitive is custom; framework no longer recognizable; no benefit from upgrades.
- **Red flag (under-customization)**: Product looks identical to every other Bootstrap/Material default; no brand voice in visuals; "designed by template".

## Beyond-the-screen (Ch.12) audit lenses

Ch.12 sketches systems that interact without screens. Most of these aren't in scope for a screen-app codebase audit, but flag them when they appear:

### B-01. Connected devices

- **Audit lens**: Does the app interact with non-app devices (smart speakers, IoT, wearables)? Is the screen UI consistent with the off-screen experience?

### B-02. Anticipatory systems

- **Audit lens**: Does the app act on the user's behalf (auto-suggest, auto-order, auto-trigger)? If yes: is there clear consent, clear undo, clear explanation of *why* the system acted?
- **Red flag**: Silent automation; no audit trail; no undo for system-initiated actions. Violates [[01-foundations-cognition#P-01. Safe Exploration]].

### B-03. Assistive systems

- **Audit lens**: For users with augmented inputs (voice, switch, eye tracking), do the primary tasks reach completion? See [[01-foundations-cognition#P-12. Keyboard Only]] for the related foundation check.

### B-04. Natural user interfaces

- **Audit lens**: For touch / gesture / voice inputs, are the affordances discoverable? Does the system offer fallbacks for users who can't or won't use the natural channel?

## How this chapter ties back to the rest of the catalog

- Every pattern in this catalog assumes a component system. If S-01 fails, fixing individual patterns is whack-a-mole.
- Atomic-design naming overlaps with the catalog's specific patterns: e.g., a header organism includes [[03-navigation#Fat Menus]], [[03-navigation#Sign-In Tools]]; a form molecule includes [[10-forms#Input Hints]], [[10-forms#Input Prompt]], [[10-forms#Good Defaults and Smart Prefills]].
- The "templates" layer maps directly to the four screen-type intents in [[02-information-architecture]] (Overview, Focus, Make, Do).
