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
| `ease-out-soft` | `cubic-bezier(.16, 1, .3, 1)` | Display text rise, sheet open, time-badge pop |
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

## Question card cross-fade

The foreground question card swaps in lockstep with the gradient between adjacent quiz surfaces. Same duration, same easing — the card and the sunset sweep move as one piece. Without the pairing the card advances instantly while the gradient is still mid-interpolation, which reads as a full second of motion lag on every question transition (bug-04).

```
duration: 1100ms  (alias of --grad-tween — never specified independently)
easing:   ease-in-out
property: opacity (0 ↔ 1) on the routed question content
```

**Why pair, not stagger:** the gradient is the load-bearing "time-of-day" signal. Anchoring the card to it preserves the read of "the surface changed because the sun moved" rather than "two unrelated transitions fired one-after-the-other."

**SwiftUI:** the routed view is re-keyed by step and decorated with `.transition(.opacity).animation(.timingCurve(0.65, 0, 0.35, 1, duration: 1.1), value: step)` — see `ios/Sources/App/QuizScreen.swift`.

**Reduced motion:** drop to 300ms linear, same fallback as the gradient — keeps the two layers paired even when shortened.

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

**Mode-specific reveal:**

- **`read-only`** — same sequence as `choreo`. CTA fade-up at 1380ms lands on the re-invite CTA (`"Start a new decision"`) instead of `"I'm in"`.
- **`no-survivor`** — compressed reveal. There's no time badge or receipt row to choreograph, so the sequence collapses to: eyebrow (80ms · 500ms) → hero (280ms · 800ms) → meta (700ms · 500ms) → rule chip (1020ms · 500ms) → CTA (1380ms · 500ms). The rule chip carries the load-bearing message and lands before the CTA on purpose; the user reads the why before being offered the widen action. The inline `"Widen radius"` slider, when opened, fades up in 320ms (`gti-fade-up`).

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
| Avatar dot answered | all (color, ring, opacity) | 320ms | ease-out |
| Receipt stagger | per-chip delay | 80ms | n/a |
| Receipt entry | translateY 8 + scale 0.96 → 1 + opacity 0→1 | 480ms | ease-out-soft |
| Vibe word change | rise + blur 4→0 | 480ms | ease-out-soft |
| LocationPicker sheet open (C-23) | translateY + opacity | 380ms | ease-out-soft |
| LocationPicker sheet dismiss (C-23) | reverse of open | 280ms | ease-out |
| LocationPicker chip press (C-23) | background-color | 140ms | ease-out |
| LocationPicker suggestion row press (C-23) | background-color | 140ms | ease-out |
| LocationPicker typeahead focus (C-23) | border 1px → 1.5px sun | 180ms | ease-out |
| LocationPicker chip `loading` shimmer (C-23) | opacity 0.5 ↔ 1.0 pulse | 1400ms | ease-in-out |
| SearchAreaPicker chip press (C-28) | background-color | 140ms | ease-out |
| SearchAreaPicker editor present (C-28) | native full-screen push / opacity settle | system / 280ms | ease-out |
| SearchAreaPicker selected circle update (C-28) | MapKit camera + overlay redraw | system-native | system-native |
| SearchAreaPicker dirty prompt (C-28) | opacity + slight scale | 180ms | ease-out |

---

## Reduced motion fallback

When `prefers-reduced-motion: reduce`:

1. **Gradient surface tween:** keep, shortened to 300ms linear. (Continuity is informational, not decorative.)
2. **Verdict reveal:** force `verdictReveal = 'off'` — everything appears at once.
3. **Hard-close:** force `closeMotion = 'fade'`, drop the stamp pop animation.
4. **Receipt stagger:** flatten to simultaneous.
6. **Sheet / editor open:** drop translateY or scale flourish; opacity fade only for custom chrome. Map camera movement stays system-native.
7. **Chip / CTA press scale:** keep (it's a press-feedback, not parallax).

SwiftUI: read `@Environment(\.accessibilityReduceMotion)` and gate the `withAnimation` wrappers.

---

## What we deliberately do *not* animate

- **No "winner" celebration motifs.** No confetti, no rotating burst, no scale-up beyond 1.08 (which is for emphasis, not joy).
- **No spinners or pulsing dots** on the waiting screen. Honest copy carries the wait. The screen is allowed to be calm.
- **No slot-machine rolls** on reroll. The reroll dialog uses opacity + position — no spinning, no flickering — to defend against paralysis-as-game.
- **No flash on selection.** Chip select is a smooth state change, not a strobe.
