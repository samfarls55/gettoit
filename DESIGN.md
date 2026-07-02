---
name: Luxe Midnight
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#ffb77b'
  on-secondary: '#4d2700'
  secondary-container: '#7a4100'
  on-secondary-container: '#ffb270'
  tertiary: '#d0cdcd'
  on-tertiary: '#313030'
  tertiary-container: '#b4b2b2'
  on-tertiary-container: '#454544'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#ffdcc2'
  secondary-fixed-dim: '#ffb77b'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#6d3a00'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  title-lg:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style

The design system is anchored in an atmosphere of exclusivity and quiet confidence. It targets a high-discerning audience that values precision, speed, and a premium "concierge" experience. The aesthetic merges **Minimalism** with subtle **Glassmorphism** to create a UI that feels like a physical luxury object—structured, polished, and expensive.

The emotional response is one of total reliability and effortless sophistication. Surfaces should feel weighty and substantial, using deep obsidian tones to provide a focused environment where content and actions are treated with high importance. High-contrast typography and metallic accents ensure that the interface remains legible and striking without being loud.

## Colors

The palette is rooted in a "Midnight" dark mode, utilizing a range of achromatic blacks and deep charcoals to establish depth. 

- **Primary (Champagne Gold):** Used sparingly for key calls to action, active states, and premium highlights. It represents value and success.
- **Secondary (Soft Copper):** Used for interactive secondary elements or to provide warmth within data visualizations and status indicators.
- **Surfaces:** The background uses a pure obsidian (#0F0F0F), while containers use a slightly lighter charcoal (#1A1A1A) to create a tiered visual hierarchy.
- **Accents:** Use subtle linear gradients (from Primary to a slightly desaturated version) to simulate a metallic sheen on buttons and headers.

## Typography

This design system employs a high-contrast typographic pairing to evoke a sense of editorial luxury. 

- **Headlines:** Uses **Playfair Display**. This serif typeface brings a classic, authoritative, and sophisticated feel to the interface. It should be used for large titles and section headers.
- **Body:** Uses **Manrope**. This modern sans-serif is highly legible and provides a clean, professional contrast to the ornate headlines. It handles the functional aspects of the UI with precision.
- **Labels:** Uses **JetBrains Mono**. For small metadata, tags, and status labels, a monospaced font adds a "technical concierge" or "ticketed" feel, suggesting accuracy and bespoke service.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to maintain a controlled, gallery-like presentation. 

- **Grid:** A 12-column grid with generous 24px gutters. Content is often centered with wide margins to emphasize exclusivity (avoiding "edge-to-edge" clutter).
- **Rhythm:** Spacing follows an 8px base unit. Use larger vertical gaps (64px+) between major sections to allow the design to breathe.
- **Mobile:** Transition to a single-column fluid layout with 20px side margins. Typography scales down slightly, but maintains the high-contrast ratio between display and body text.

## Elevation & Depth

Depth is achieved through a combination of **Tonal Layers** and **Crisp Borders**, rather than heavy shadows.

- **Surface Tiers:** Level 0 is the deep background (#0F0F0F). Level 1 containers use #1A1A1A. Level 2 (modals/popovers) uses #252525.
- **Borders:** Every container should have a 1px solid border. Use a low-opacity white (White 10%) for standard borders, and a Soft Copper or Gold gradient for featured elements.
- **Glassmorphism:** Use backdrop filters (blur: 12px) on navigation bars and floating headers to give a sense of polished glass over the dark void.
- **Shadows:** Use a single, highly diffused "Ambient Glow" for active elements, using a faint tint of the primary color (#D4AF37 at 15% opacity) to suggest a subtle light source.

## Shapes

The shape language is sharp and architectural. 

- **Corner Radii:** Use a "Soft" (0.25rem) radius for most components. This creates a precision-engineered look that feels more modern than sharp 90-degree angles, but more serious than highly rounded "bubbly" designs.
- **Interactive Elements:** Buttons and input fields should strictly adhere to the `rounded-sm` or `rounded-md` hierarchy to maintain a consistent, structured silhouette across the platform.

## Components

- **Buttons:** Primary buttons use a subtle vertical gradient of Champagne Gold with dark text (Obsidian). Secondary buttons are "Ghost" style: 1px Copper border with Copper text.
- **Inputs:** Dark backgrounds (#121212) with a 1px border that illuminates (Gold) upon focus. Labels should use the Monospaced font in uppercase.
- **Cards:** Use a "Glass" effect with a 1px top-border highlight to simulate light catching the edge of a glass pane.
- **Lists:** High-density lists with JetBrains Mono metadata. Use thin separators (White 5% opacity) and generous padding to ensure an "expensive" feel.
- **Chips/Tags:** Small, monospaced text within a pill-shaped container with a subtle Copper stroke. No fill.
- **Concierge Indicator:** A specialized component (unique to this system) featuring a pulsing gold dot next to high-priority status updates or actions.