# Sunset Pop — Design System

Production design system for **GetToIt**, the iOS app that kills group decision paralysis in 60 seconds.

This is the handoff package for Claude Code → SwiftUI implementation. Tokens, components, motion, surfaces, and accessibility are speccated against the locked Sunset Pop direction. Every screen ships with **real JSX source** alongside the markdown spec — drop the JSX into your iframe/preview environment to see the canonical state, lift the values into SwiftUI.

---

## Contents

| Path | What's in it |
|---|---|
| [`tokens.json`](./tokens.json) | **Canonical source of truth** for all tokens. `code/tokens.css` is generated from this. Future `GTITokens.swift` will be too. |
| [`tokens.md`](./tokens.md) | Human-readable tokens reference: color, gradient, type, spacing, radii, shadow, motion. SwiftUI primitive map. |
| [`components.md`](./components.md) | Every component (C-01…C-23) — states, sizes, tap targets, SwiftUI primitives. |
| [`motion.md`](./motion.md) | Per-component motion timings, verdict-reveal choreography, reduced-motion. |
| [`accessibility.md`](./accessibility.md) | Contrast tables on every gradient, tap-target audit, focus order, VO, Dynamic Type. |
| [`surfaces/`](./surfaces/) | 8 surface docs — purpose, defenses, copy register, edge cases. Each links to its JSX. |
| [`code/`](./code/) | **Clean React/JSX source for every screen.** No tweak machinery. This is what to port. |
| [`scripts/`](./scripts/) | `gen-css.mjs` (tokens.json → tokens.css), `gen-swift.mjs` (tokens.json → `ios/Sources/GTITokens.swift`), `verify.mjs` (drift gate + orphan-hex sweep — covers both generated outputs). |
| [`CLAUDE.md`](./CLAUDE.md) | Editing rules for agents working in this directory. Read before changing anything here. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Append-only log of spec changes. Every user-visible change adds a line. |

---

## Code map

Every surface has a corresponding JSX file. The markdown is the **why**, the JSX is the **what**.

| # | Surface | Doc | JSX |
|---|---|---|---|
| 00 | Landing | [`surfaces/00-landing.md`](./surfaces/00-landing.md) | [`code/screens/ScreenLanding.jsx`](./code/screens/ScreenLanding.jsx) |
| 00a | Forced sign-in gate (iOS, first launch) | [`surfaces/00a-signin.md`](./surfaces/00a-signin.md) | [`code/screens/ScreenSignIn.jsx`](./code/screens/ScreenSignIn.jsx) |
| 00b | Location permission pre-prime | [`surfaces/00b-location-permission.md`](./surfaces/00b-location-permission.md) | [`code/screens/ScreenLocationPermission.jsx`](./code/screens/ScreenLocationPermission.jsx) |
| 01 | **Plan setup (Create + Edit)** — canonical replacement for S01 + S01b | [`surfaces/01-setup.md`](./surfaces/01-setup.md) | [`code/screens/ScreenSetup.jsx`](./code/screens/ScreenSetup.jsx) |
| 01 | ~~Initiator landing~~ — superseded 2026-05-19 by `01-setup`; remains in tree until tb-WF-4 retires the iOS code | [`surfaces/01-initiator.md`](./surfaces/01-initiator.md) | [`code/screens/ScreenInitiator.jsx`](./code/screens/ScreenInitiator.jsx) |
| 01b | ~~Pre-quiz parameters setup (initiator)~~ — superseded 2026-05-19 by `01-setup`; remains in tree until tb-WF-4 retires the iOS code | [`surfaces/01b-parameters.md`](./surfaces/01b-parameters.md) | [`code/screens/ScreenParameters.jsx`](./code/screens/ScreenParameters.jsx) |
| 02a | Invite (iMessage unfurl) | [`surfaces/02-invite.md`](./surfaces/02-invite.md) | [`code/screens/ScreenInviteUnfurl.jsx`](./code/screens/ScreenInviteUnfurl.jsx) |
| 02b | Invite (web fallback) | ↑ | [`code/screens/ScreenInviteWeb.jsx`](./code/screens/ScreenInviteWeb.jsx) |
| 03 | Quiz Q1 · Vetoes | [`surfaces/03-quiz.md`](./surfaces/03-quiz.md) | [`code/screens/ScreenQ1Vetoes.jsx`](./code/screens/ScreenQ1Vetoes.jsx) |
| 04 | Quiz Q2 · Budget | ↑ | [`code/screens/ScreenQ2Budget.jsx`](./code/screens/ScreenQ2Budget.jsx) |
| 05 | Quiz Q3 · Distance | ↑ | [`code/screens/ScreenQ3Distance.jsx`](./code/screens/ScreenQ3Distance.jsx) |
| 06 | Quiz Q4 · Vibe | ↑ | [`code/screens/ScreenQ4Vibe.jsx`](./code/screens/ScreenQ4Vibe.jsx) |
| 07 | Quiz Q5 · Regret | ↑ | [`code/screens/ScreenQ5Regret.jsx`](./code/screens/ScreenQ5Regret.jsx) |
| 08 | Waiting | [`surfaces/04-waiting.md`](./surfaces/04-waiting.md) | [`code/screens/ScreenWaiting.jsx`](./code/screens/ScreenWaiting.jsx) |
| 09 | Verdict (hero) | [`surfaces/05-verdict.md`](./surfaces/05-verdict.md) | [`code/screens/ScreenVerdict.jsx`](./code/screens/ScreenVerdict.jsx) |
| 10 | Hard-close | [`surfaces/06-hard-close.md`](./surfaces/06-hard-close.md) | [`code/screens/ScreenLocked.jsx`](./code/screens/ScreenLocked.jsx) |
| 11 | Reroll | [`surfaces/07-reroll.md`](./surfaces/07-reroll.md) | [`code/screens/ScreenReroll.jsx`](./code/screens/ScreenReroll.jsx) |
| 12 | Check-in | [`surfaces/08-checkin.md`](./surfaces/08-checkin.md) | [`code/screens/ScreenCheckin.jsx`](./code/screens/ScreenCheckin.jsx) |
| 13 | Settings | [`surfaces/09-settings.md`](./surfaces/09-settings.md) | [`code/screens/ScreenSettings.jsx`](./code/screens/ScreenSettings.jsx) |

Shared: [`code/tokens.css`](./code/tokens.css), [`code/components.jsx`](./code/components.jsx), [`code/README.md`](./code/README.md).

---

## Product invariants (do not redesign around)

These come from the original handover brief and have to survive every design decision:

1. **Voice register: warm friend.** `"Budget cap cut Ren Soba."` — never `"Alex said no"`, never `"The algorithm picked"`.
2. **NEED-then-EQUALITY** distribution. Never EQUITY. No turns, no win counts.
3. **Voluntary commitment language only.** `"I'm in."` Never `"Confirm"`, `"Accept"`.
4. **Aggregate-rule attribution.** The rule names *what* eliminated options, never *who*.
5. **Loser-targeted copy.** The verdict screen includes the loser, doesn't celebrate the winner.
6. **Implementation-intention.** Where + when + who, every time the verdict surfaces.
7. **No celebration motifs.** No 🏆, no confetti, no "you won this round."

The visual system is built so these are easy to do right and awkward to do wrong. Design defenses are noted inline in each surface spec.

---

## The five-second test (verdict screen)

Every verdict variant must let the **loser** see, in priority order, within 5 seconds:

1. The verdict (single option, no negotiation)
2. The rule that produced it (one short sentence)
3. Their voice was counted (per-member receipt)
4. A path to ratify ("I'm in")
5. A correctability path (friction-bearing reroll)

If a treatment hides or downgrades any of these in the first 5s read, it fails. See [`surfaces/05-verdict.md`](./surfaces/05-verdict.md) for the spec built around this.

---

## SwiftUI translation cheat sheet

| Web | SwiftUI |
|---|---|
| `linear-gradient` background | `LinearGradient(...)` |
| `@property --color` interpolation | `withAnimation(.easeInOut(duration: 1.1)) { stops = ... }` over `@State` color array |
| `backdrop-filter: blur()` | `.background(.ultraThinMaterial)` |
| `feTurbulence` grain overlay | Pre-baked `Image("grain").blendMode(.overlay).opacity(0.35)` |
| `cubic-bezier(.16, 1, .3, 1)` | `Animation.timingCurve(0.16, 1, 0.3, 1)` |
| `text-wrap: balance` | Manual line breaks in source strings |
| `transform: scale()` | `.scaleEffect(...)` |

See [`code/README.md`](./code/README.md) for a more thorough table and a per-file porting strategy.

---

## What's intentionally not in this package

- **Hand-edited Swift output.** `ios/Sources/GTITokens.swift` is generated by `scripts/gen-swift.mjs`; never hand-edit. CI's `verify.mjs` enforces a byte-identical drift gate.
- **Logo / wordmark.** The `GTIMark` tile + "GetToIt" wordmark in code is a placeholder pending real branding.
- **Brand voice copy strings.** Owned by `40_marketing_branding/`.
- **Warm-friend vs. court-formal copy register A/B.** Visual is locked to warm-friend; copy A/B is post-launch.
- **Tweak machinery** (palette switcher, motion variants, hue offset, grain slider) — exists only in the live prototype, intentionally stripped from this handoff. The values you see in `code/` are the locked canonical state.
