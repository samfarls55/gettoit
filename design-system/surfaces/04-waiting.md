---
surface: 04-waiting
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenWaiting.jsx
---

# S04 · Waiting / Coordination

> **Code:** [`../code/screens/ScreenWaiting.jsx`](../code/screens/ScreenWaiting.jsx)

The user has finished the quiz; not everyone has. Honest, calm, no anxiety.

## What this surface defends against

- **Anxiety motion.** No spinners. No pulsing dots. No "waiting…" with animated ellipsis. The avatar row + headline are the entire signal.
- **Coercion of late answerers.** Nudge is opt-in (user must tap) and rate-limited (1 per 2min per session). The surface does NOT say "Sam is holding up the group."
- **Algorithm framing.** Verdict is described as "what surfaces when everyone's in" — never "what we compute / recommend."

## Components used

`GradientSurface` (waiting) · `GTIMark` · `Eyebrow` · display headline (`N of M` / `ARE IN`) · `AvatarDot` × N · `PillCTA` ghost (Nudge).

## Copy register

- **`"3 of 4 are in"`** — N-of-M ratio. Never percentages. "75%" frames as an algorithm output.
- **`"Sam is still answering"`** — present continuous. Not "Sam hasn't answered" (accusatory).
- **`"no spinners, promise."`** — a meta-commitment. End-of-workday users are fatigued; this surface promises not to perform urgency.

## Behavior

- Live updates: when `answered` flips, animate `all 320ms ease-out` (color, ring, check appears).
- Nudge → push to Sam's device: `"Maya, Alex + 2 are waiting on you."` Cap: 1 per 2min.

## Edge cases

- **Quorum < 100%.** If a 5-person session has 4 answered after a 10-min timeout, verdict drops without the 5th. Their avatar appears in `pending` style on the verdict screen as a non-shaming "didn't answer" tag.
- **Initiator force-verdict** is reserved for v2 (not in canonical screens).
