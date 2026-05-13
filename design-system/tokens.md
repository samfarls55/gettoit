# Tokens — Sunset Pop

The single source of truth for color, type, spacing, radii, shadow, motion.

**Source of truth:** [`tokens.json`](./tokens.json). [`code/tokens.css`](./code/tokens.css) is generated from it via `scripts/gen-css.mjs`. When porting to SwiftUI, generate `GTITokens.swift` from the same `tokens.json` — never duplicate values by hand. The tables below are the human-readable reference; `tokens.json` is what consumers read.

---

## 1 · Color

### 1.1 Fixed palette

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0E1011` | All body type on white/yellow surfaces; primary CTA text. |
| `--ink-2` | `#1A1C1F` | Reroll sheet / lockscreen surfaces. |
| `--paper` | `#FFFFFF` | Primary CTA fill, all type on gradient. |
| `--sun` | `#FFD23F` | THE accent. Time badge, selected chip, primary CTA on regret/verdict. |
| `--sun-deep` | `#F5B800` | Sun pressed state, sun-on-sun separation. |

**Sun is the one fixed signal in the system.** When users see sun-yellow, they should mean: *the system has registered your input*. Don't dilute it with secondary accents.

### 1.2 Gradient family — `sunset` (default, canonical)

The gradient is the system's primary canvas. Each surface owns a 4-stop gradient that interpolates from the previous surface using registered CSS custom properties (`@property` + transition) — true color tween, ~1.1s ease-in-out.

| Surface | g1 (top) | g2 | g3 | g4 (bottom) |
|---|---|---|---|---|
| `initiator` | `#FF8868` | `#FF9F6B` | `#FFB855` | `#FFD23F` |
| `q1` | `#FF6B5E` | `#FF8A5F` | `#FFB256` | `#FFD23F` |
| `q2` | `#FF5878` | `#FF7A66` | `#FFA15A` | `#FFC75A` |
| `q3` | `#E04F8B` | `#B855B0` | `#8A5BD0` | `#6E63E0` |
| `q4` | `#2F3380` | `#3F47A6` | `#5E59C9` | `#7C68E4` |
| `q5` | `#0E1450` | `#181B5E` | `#252A6E` | `#363B82` |
| `waiting` | `#1B1F66` | `#2A2A7C` | `#4A3F9F` | `#7256C4` |
| `verdict` | `#FFC548` | `#FF8A5A` | `#C24F7E` | `#2A2068` |
| `checkin` | `#FFDB6B` | `#FFA86D` | `#FF7F88` | `#9F4C9F` |
| `midnight` | `#0A0B1A` | `#10112A` | `#161836` | `#1F2244` |

Stop positions: `0% / 32% / 66% / 100%`.

The narrative arc — coral → magenta → indigo → midnight — IS the experience. Don't break the order. Q5 lands in midnight specifically so the verdict's golden top is a literal sunrise back out of it.

**Alt families** (live in `GTI_PALETTES`, switchable via tweak): `citrus` (more yellow-forward, blue midnight), `noir` (purple-shifted, almost black bottoms). Treat these as exploration variants — `sunset` is canon.

### 1.3 Semantic roles

| Role | On gradient | On white/yellow |
|---|---|---|
| Primary text | `#FFFFFF` | `#0E1011` |
| Secondary text | `rgba(255,255,255,0.78)` | `rgba(14,16,17,0.7)` |
| Tertiary text | `rgba(255,255,255,0.6)` | `rgba(14,16,17,0.5)` |
| Glass fill | `rgba(255,255,255,0.18)` | n/a |
| Glass fill (strong) | `rgba(255,255,255,0.28)` | n/a |
| Glass stroke | `rgba(255,255,255,0.42)` | n/a |
| Destructive | `var(--sun)` framed in `var(--ink)` | same |
| Success (check, ratified) | `var(--sun)` | same |

No red. No green. Sun-yellow is the only state signal. If you reach for red, you're designing the wrong screen.

### 1.4 SwiftUI

```swift
enum GTIColor {
  static let ink = Color(hex: 0x0E1011)
  static let sun = Color(hex: 0xFFD23F)
  // ...
}

enum GTIGradient {
  static func stops(for surface: GTISurface) -> [Color] { /* table above */ }
  static func linear(_ surface: GTISurface) -> LinearGradient {
    LinearGradient(stops: zip(stops(for: surface), [0, 0.32, 0.66, 1.0])
                          .map { .init(color: $0.0, location: $0.1) },
                   startPoint: .top, endPoint: .bottom)
  }
}
```

For the tween: hold `@State var g1, g2, g3, g4: Color` and animate them on surface transition. SwiftUI interpolates `Color` natively inside `withAnimation`.

---

## 2 · Typography

Single typeface: **Inter**. Weights used: 500, 600, 700, 800, 900.

| Token | Family / weight | Size | Tracking | Line height | Use |
|---|---|---|---|---|---|
| `display-xl` | Inter 900 | 88px | -0.025em | 0.9 | Largest verdict / vibe word |
| `display-l` | Inter 900 | 64px | -0.025em | 0.9 | Verdict hero, waiting count |
| `display-m` | Inter 900 | 44px | -0.025em | 0.92 | Initiator headline, checkin "Did you go?" |
| `display-s` | Inter 900 | 32px | -0.02em | 0.95 | Reroll headline, secondary display |
| `heading` | Inter 800 | 28px | -0.015em | 1.05 | Section heads, Q3 number |
| `title` | Inter 700 | 18px | -0.01em | 1.2 | Picker row title (initiator verticals) |
| `body` | Inter 600 | 16px | 0 | 1.4 | Question prompt sub, body copy |
| `sm` | Inter 600 | 14px | 0 | 1.4 | Meta lines |
| `eyebrow` | Inter 700 | 11px | **0.18em** | 1 | UPPERCASE. "Q1 OF 5", "Tonight's session" |
| `cta` | Inter 800 | 14px | **0.14em** | 1 | UPPERCASE. Primary CTA. |
| `mono-tag` | IBM Plex Mono 500 | 10–12px | 0.18em | 1 | Timestamps, "Locked 6:48 PM" |

**The display weight (Inter 900) is non-negotiable.** It's how the verdict reads as final at a glance. If a screen feels timid, you used Inter 800 by mistake.

**Stacked uppercase rule.** Display strings ≥7 chars per line (e.g. "PICO'S", "TAQUERIA") wrap **one word per line** — never let the renderer break a word.

### SwiftUI

```swift
extension Font {
  static let gtiDisplayXL = Font.custom("Inter", size: 88).weight(.black)
  static let gtiDisplayL  = Font.custom("Inter", size: 64).weight(.black)
  // ...
  static let gtiEyebrow   = Font.custom("Inter", size: 11).weight(.bold)
}

// Tracking via `.tracking()`.
Text("Q1 OF 5").font(.gtiEyebrow).tracking(2.0).textCase(.uppercase)
```

---

## 3 · Spacing

```
4   8   12   16   20   24   32   40   48   64
```

Named tokens: `sp-1` through `sp-16` in `tokens.css`. SwiftUI: just literals (`EdgeInsets(top: 16, …)`).

**Common spacing patterns:**
- Top bar to question header: 40
- Question header to content: 24
- Content to CTA dock: auto (`margin-top: auto`)
- CTA dock bottom padding: 18 (above the home indicator)
- Chip-to-chip gap: 10
- Receipt-to-receipt gap: 6
- Section gap inside reroll sheet: 14

---

## 4 · Radii

| Token | Value | Use |
|---|---|---|
| `r-chip` | 999 | Veto chip, single-select chip, receipt chip, reroll reason chip |
| `r-tag` | 8 | Time badge inner, "2 LEFT" stamp, locked badge |
| `r-card` | 18 | Glass regret card, vertical picker row, check-in tap |
| `r-card-lg` | 22 | Reroll reason tile, cut row |
| `r-hero` | 28 | (Reserved for future hero surfaces — currently unused; iOS frame's own corner radius is 48.) |
| `r-pill` | 999 | Primary CTA — always full radius |
| `r-sheet` | 26 | Reroll bottom sheet |

---

## 5 · Shadow / Elevation

Gradients resist drop shadows. Use elevation **only on white or sun-yellow surfaces**, and use it sparingly.

| Token | Recipe |
|---|---|
| `shadow-cta-white` | `0 12px 32px rgba(0,0,0,0.18)` |
| `shadow-cta-sun` | `0 12px 32px rgba(255,210,63,0.4), inset 0 1px 0 rgba(255,255,255,0.45)` |
| `shadow-time-badge` | `0 18px 38px rgba(255,210,63,0.36), inset 0 1px 0 rgba(255,255,255,0.5)` |
| `shadow-chip-selected` | `0 8px 22px rgba(255,210,63,0.35), 0 0 0 4px rgba(255,210,63,0.18), inset 0 1px 0 rgba(255,255,255,0.5)` |
| `shadow-receipt-glass` | `inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px rgba(0,0,0,0.08)` |
| `shadow-sheet` | `0 -20px 60px rgba(0,0,0,0.5)` |

**Glass uses inset highlights, not drop shadows.** That's how iOS does material and it reads correctly on gradients.

---

## 6 · Motion

Full per-component spec is in [`motion.md`](./motion.md). Token-level summary:

| Token | Duration | Easing | Use |
|---|---|---|---|
| `tween-grad` | 1100ms | `cubic-bezier(.65, 0, .35, 1)` | Per-surface gradient color interpolation |
| `tween-chip` | 180ms | `cubic-bezier(.22, .61, .36, 1)` | Chip select/deselect, button press |
| `tween-rise` | 700ms | `cubic-bezier(.16, 1, .3, 1)` | Display text rise-from-below |
| `tween-pop` | 520ms | `cubic-bezier(.16, 1, .3, 1)` | Time badge pop, lock stamp |
| `tween-shutter` | 700ms | `cubic-bezier(.16, 1, .3, 1)` | Hard-close shutter |
| `stagger-receipt` | 80ms | n/a | Delay between sequential receipt-chip entries |
| `delay-choreo-name` | 280ms | — | When verdict place name enters |
| `delay-choreo-time` | 820ms | — | When time badge pops |
| `delay-choreo-rule` | 1020ms | — | When rule sentence enters |

---

## 7 · Texture

Sunset Pop has one signature texture: **film grain on every gradient surface.**

- 280×280 PNG of `feTurbulence` noise (the prototype generates inline; ship as a single asset).
- `mix-blend-mode: overlay`, `opacity: 0.35` (token: `--grain-opacity`).
- Applied to gradient layer; **not** to white or yellow surfaces (it muddies type).

This is the texture defense against "algorithm-flat." Don't ship without it.

### SwiftUI

```swift
ZStack {
  GTIGradient.linear(surface)
  Image("grain")
    .resizable(resizingMode: .tile)
    .blendMode(.overlay)
    .opacity(0.35)
    .allowsHitTesting(false)
}
```

---

## 8 · Tweakable knobs (kept around for design iteration)

Listed for completeness — these are the live tweaks in the prototype. SwiftUI port doesn't need to expose them; they're for design exploration.

- `palette`: `sunset` (canon) | `citrus` | `noir`
- `grain`: 0 – 0.7 (default 0.35)
- `hue`: -60° – +60° global hue-rotate (default 0)
- `displayWeight`: 800 | 900 (default 900)
- `vibeVocab`: `mood` (canon) | `slang` | `neutral`
- `verdictReveal`: `choreo` (canon) | `quick` | `off`
- `closeMotion`: `shutter` (canon) | `fade` | `stamp`
- `inviteMode`: `imessage` (canon primary) | `web` (fallback)
