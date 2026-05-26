---
surface: 06-hard-close
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenLocked.jsx
---

# S06 · Hard-Close (Verdict Locks)

> **Code:** [`../code/screens/ScreenLocked.jsx`](../code/screens/ScreenLocked.jsx)

The verdict closes visibly after the correctability window (30–90s) expires. This converts agreement into commitment.

## Why this surface exists

> Without the visible close, the group says "sounds good" and nobody goes. The hard-close converts ratification into follow-through — it's the load-bearing mechanic of the entire product.

It's also the surface most at risk of feeling **punitive**. Design defenses:

- **Sun-yellow edges** on the shutters — system color, NOT red.
- **Mono receipt** at the bottom — system speaking matter-of-factly, not warning.
- **Carries information forward** — rerolls remaining, lock timestamp. The user is told their next move.

## Motion (canon)

The shutter animation is baked into the JSX. Timing:

```
0ms     Veil layer fades in 0 → 0.62 black (200ms)
100ms   Top shutter slides DOWN -100% → 0 (700ms ease-out-soft)
100ms   Bottom shutter slides UP +100% → 0 (700ms ease-out-soft)
800ms   "VERDICT LOCKED" stamp fades up (600ms)
1000ms  Headline ("Pico's / at 7:00") fades up
1200ms  Body copy fades up
1400ms  Timestamp footer fades up
```

For reduced-motion: omit the shutter slides; the veil + stamp still appear. See `motion.md` §"Hard-close" for the full table.

## Copy register

- **`"Verdict locked"`** — state, not error.
- **`"The correctability window closed 12 seconds ago."`** — specific time. The system is honest about what happened.
- **`"Re-opening takes a reroll — and reroll needs a reason the group reads."`** — telegraphs the cost AND the social contract. Reasons are read by the group; this isn't a private undo.
- **Timestamp footer is monospace.** Mono is the system speaking — terse, factual, non-emotional. It's the receipt.
- **`"2 of 3 rerolls remain"`** — N-of-M. Tells the user what's still possible.

## What this surface defends against

- **Re-litigation.** The shutters make re-opening impossible without a reason.
- **Punitive feeling.** Sun-yellow edge (not red), mono receipt (not bold warning), language pointing to a path forward.
- **Confusion.** Lock plate states what happened, when, and how to re-open. The verdict itself is restated so the commitment is intact.

## Locked chrome (Home)

The surface carries a single top-leading `Home` text-verb in the eyebrow-token chrome row, mirroring `surfaces/05-verdict.md` §"Verdict chrome (Home)" and the QuizChrome `Back` slot. Pure navigation — the tap pops the locked screen and returns the user to S00 Plan list via the RootView precedence-chain fallback. No session teardown, no membership mutation: the verdict is sealed by design (`CONTEXT.md` → *Plan / Room lifecycle*), but the user is not trapped on the surface.

The top-trailing slot is intentionally empty — the locked verdict has no `Exit` counterpart because there is nothing to exit (the session already ended). The 44pt-square reserved frame preserves vertical rhythm.

Foundation: P-01 *Safe Exploration*. Pattern: *Escape Hatch* (`patterns#Escape Hatch`).

## Edge cases

- **All rerolls used.** Footer becomes `"No rerolls left. Tonight is locked."` — flat statement. No re-opening path.
- **User backgrounds the app before locking.** When they return after expiry, they land here. "Locked X seconds/minutes ago" copy adjusts.
