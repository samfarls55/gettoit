---
surface: 01-initiator
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenInitiator.jsx
---

# S01 · Initiator Landing

> **Code:** [`../code/screens/ScreenInitiator.jsx`](../code/screens/ScreenInitiator.jsx)

The user picks a vertical and generates a share link for the group. One choice → invite.

## What this surface defends against

- **Pre-commitment paralysis.** No "configure your session." No "name your night." No optional fields.
- **Algorithm framing.** No mention of AI, suggestions, smart anything. The app is plumbing.
- **Group-size friction.** Size is inferred from who accepts the invite, not set up front.

## Components used

`GradientSurface` (initiator) · `GTIMark` · `Eyebrow` · display headline · vertical picker rows (inline) · `PillCTA` white.

## Copy register

- **`"Figure it out together"`** — warm, present-tense, plural pronoun. Not "Decide where to eat" (procedural) or "Group decision time" (formal).
- **`"Five quick taps each. One verdict. Sixty seconds."`** — three short declarative sentences. The 60-second promise is load-bearing.
- **`"Drop the invite link"`** — voluntary verb, casual register, conveys finality.

## v1 scope

Only `food` is selectable. Drinks/Movie render visibly as future plans (opacity 0.55, disabled) so users know more is coming, but aren't interactive.

## Behavior

CTA → generate session ID → copy link to clipboard → open the iOS share sheet. After share, the initiator transitions to their own Q1 (surface 03).
