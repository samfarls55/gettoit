# Motion — Sunset Pop

Motion is part of the system, not garnish. Three motion behaviors carry product weight:

1. **Gradient tween between surfaces** — the sense of time passing through the quiz.
2. **Choreographed verdict reveal** — gives the verdict its weight and finality.
3. **Mechanical hard-close** — converts agreement into commitment.

Everything else is utility motion (button press, chip select, sheet open).

---

## Easing curves

| Token | Bezier | Use |
|---|---|---|
| `ease-out` | `cubic-bezier(.22, .61, .36, 1)` | Button press, chip select, top bar progress |
| `ease-out-soft` | `cubic-bezier(.16, 1, .3, 1)` | Display text rise, sheet open, time-badge pop, cuts drawer fade-up |
| `ease-in-out` | `cubic-bezier(.65, 0, .35, 1)` | Gradient color interpolation (only). Symmetric ease so the surface change reads as continuous. |

**SwiftUI:** `Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.7)` etc.

---

## Gradient surface tween

Between any two surfaces, all 4 stops (`g1`, `g2`, `g3`, `g4`) interpolate simultaneously:

```
duration: 1100ms
easing:   ease-in-out
property: --g1, --g2, --g3, --g4 (registered <color> custom properties)
```

The tween is **continuous** — no crossfade, no opacity, no second layer. The single gradient just shifts its colors.

This is what reads as "the sun is going down through the quiz" — the brain accepts gradual color drift as time-of-day movement.

**Reduced motion:** drop to 300ms linear color swap. Don't go to zero — the surface continuity is part of how the next surface lands.

---

## Verdict reveal — full choreography

The verdict screen has 5 second of loser attention. The choreography is paced so the **rule** and the **receipts** arrive while the user is still looking — not after they've already scrolled.

```
0ms      Gradient finishes settling from Q5 (carries in)
80ms     Eyebrow fades up           — "TONIGHT, THE VERDICT IS"        (500ms)
280ms    Hero rises                  — "PICO'S / TAQUERIA"              (800ms, ease-out-soft)
700ms    Meta line fades up          — "MEXICAN · $$ · 8 MIN WALK"     (500ms)
820ms    Time badge POPs             — "7:00 PM / ALL FOUR OF YOU"      (520ms, scale 0.6→1.08→1)
1020ms   Rule sentence fades up      — "Budget cap cut Ren Soba..."     (500ms)
1140ms   Receipt 1 staggers in       — "you wanted lively"              (480ms)
1220ms   Receipt 2                                                       (...)
1300ms   Receipt 3
1380ms   Receipt 4                   — last receipt lands
1380ms   "I'm in" CTA fades up                                          (500ms)
```

Total time to interactive: ~1.88s. **The hero, time, and rule all land before 1.1s** — that's the load-bearing budget. After that, the receipts and CTA arrive while the user reads.

**Variants** (tweak `verdictReveal`):

| Variant | Behavior |
|---|---|
| `choreo` (canon) | The sequence above. |
| `quick` | All elements arrive between 0–320ms with 60ms staggers. Same visual order, no rest beats. Use case: returning to the verdict after a reroll — don't make people watch the full reveal twice. |
| `off` | No animation. Use case: reduced-motion users; testing; printouts. |

**SwiftUI implementation:**
```swift
// One `@State var revealStep: Int = 0` advanced by .task on appear
withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.5).delay(0.08))    { showEyebrow  = true }
withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.8).delay(0.28))    { showHero     = true }
withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.52).delay(0.82))   { showTime     = true }
withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.5).delay(1.02))    { showRule     = true }
// ...
```

For text "rise", use `.transition(.move(edge: .bottom).combined(with: .opacity))` on the inserted view.

---

## Hard-close shutter

The verdict closes visibly. This is load-bearing — it's the mechanic that converts agreement into follow-through. Without it, the group says "sounds good" and nobody goes.

```
0ms      Veil layer fades in 0 → 0.62 black                  (200ms ease)
100ms    Top shutter slides DOWN from -100% → 0              (700ms ease-out-soft)
100ms    Bottom shutter slides UP from +100% → 0             (700ms ease-out-soft)
200ms    "VERDICT LOCKED" stamp pops                          (480ms scale 0.6→1.08→1)
1000ms   Headline fades up                                    (600ms)
1200ms   Body copy fades up                                   (600ms)
1400ms   Timestamp footer fades up                            (600ms)
```

The shutters are **dark blue-black** (`#0A0A0F`) with **sun-yellow hairline edges**. The hairline is what stops it from reading as "error" or "punishment" — it reads as "the system did what you asked, on time."

**Variants** (tweak `closeMotion`):

| Variant | Behavior |
|---|---|
| `shutter` (canon) | The sequence above. |
| `fade` | Veil only; verdict darkens, lock plate fades in over 600ms. Use case: respectful low-stakes contexts (e.g. the user already committed and the close is procedural). |
| `stamp` | No veil shift, no shutter — the LOCKED stamp simply pops on top of the verdict in place. Use case: dense surface where shutter would feel theatrical. |

**Reduced motion:** force `fade`, no scale on the stamp.

---

## Utility motion

| Component | Property | Duration | Easing |
|---|---|---|---|
| Chip select/deselect | bg, color, transform | 180ms | ease-out |
| Chip pressed | scale 1 → 0.98 | 140ms | ease-out |
| Pill CTA pressed | scale 1 → 0.98 | 140ms | ease-out |
| Top bar progress fill | background | 300ms | ease-out |
| Top bar progress current segment | width | (n/a — discrete steps; current segment fills 100% of its bay) |
| Sheet open (reroll) | translateY + opacity | 380ms | ease-out-soft |
| Sheet dismiss | reverse of open | 280ms | ease-out |
| Cuts drawer open | height + fade-up children with 60ms stagger | 360ms / 340ms | ease-out-soft |
| Avatar dot answered | all (color, ring, opacity) | 320ms | ease-out |
| Receipt stagger | per-chip delay | 80ms | n/a |
| Receipt entry | translateY 8 + scale 0.96 → 1 + opacity 0→1 | 480ms | ease-out-soft |
| Vibe word change | rise + blur 4→0 | 480ms | ease-out-soft |

---

## Reduced motion fallback

When `prefers-reduced-motion: reduce`:

1. **Gradient surface tween:** keep, shortened to 300ms linear. (Continuity is informational, not decorative.)
2. **Verdict reveal:** force `verdictReveal = 'off'` — everything appears at once.
3. **Hard-close:** force `closeMotion = 'fade'`, drop the stamp pop animation.
4. **Receipt stagger:** flatten to simultaneous.
5. **Cuts drawer:** instant open/close, no fade-up.
6. **Sheet open:** drop the translateY rise; opacity fade only.
7. **Chip / CTA press scale:** keep (it's a press-feedback, not parallax).

SwiftUI: read `@Environment(\.accessibilityReduceMotion)` and gate the `withAnimation` wrappers.

---

## What we deliberately do *not* animate

- **No "winner" celebration motifs.** No confetti, no rotating burst, no scale-up beyond 1.08 (which is for emphasis, not joy).
- **No spinners or pulsing dots** on the waiting screen. Honest copy carries the wait. The screen is allowed to be calm.
- **No slot-machine rolls** on reroll. The reroll dialog uses opacity + position — no spinning, no flickering — to defend against paralysis-as-game.
- **No flash on selection.** Chip select is a smooth state change, not a strobe.
