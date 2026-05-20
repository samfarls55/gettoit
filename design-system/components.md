# Components — Sunset Pop

Every component in the prototype, spec'd. For each: visual at every state, sizes, spacing, accessibility, SwiftUI primitive.

States covered: **default**, **pressed**, **selected**, **disabled** where applicable.

---

## C-01 · Gradient Surface

The canvas. Every screen except `invite/imessage` is rendered on a gradient surface.

| Property | Value |
|---|---|
| Layers | 1 — linear-gradient, 2 — grain overlay (blend overlay 0.35), 3 — optional scanlines |
| Stops | 4 colors at 0% / 32% / 66% / 100% |
| Transition between surfaces | All 4 stops tween over `1100ms cubic-bezier(.65,0,.35,1)` |
| Hue offset | Global `--hue-shift` (0° default; ±60° tweak range) |

**SwiftUI:** see `tokens.md` §1.4 and §7. `withAnimation(.timingCurve(0.65, 0, 0.35, 1, duration: 1.1))` when changing the stop array.

---

## C-02 · Top Bar

`× close` + 5-segment progress + step counter.

| Element | Spec |
|---|---|
| Container | `0 22px` horizontal padding, no background |
| Close button | Inter 800 / 22px / white 0.85, tap target 32×32 |
| Progress segments | 5 × `flex: 1`, height 4px, radius 999, gap 5px |
| Filled segment | `#FFFFFF` |
| Empty segment | `rgba(255,255,255,0.32)` |
| Segment transition | `background 300ms ease-out` when step advances |

**Accessibility:** Close has `aria-label="Close"`; progress is read as "Question N of 5".

---

## C-03 · Question Header

Eyebrow + display title + sub.

| Element | Spec |
|---|---|
| Eyebrow | `eyebrow` (Inter 700 / 11 / tracking 0.18em, UPPERCASE), white 0.78 |
| Title | `display-m` (Inter 900 / 38 / -0.025em / line 0.95), white, `text-wrap: balance` |
| Sub | Inter 600 / 14 / line 1.4, white 0.78 |
| Title→sub gap | 10 |
| Eyebrow→title gap | 10 |

---

## C-04 · Chip (Multi / Single-Select)

Used in Q1 cuisine craving (multi, capped), Q3 reputation picker (single), Q5 row buttons (variant), reroll reasons (variant), check-in why (multi).

| State | Background | Text | Border | Shadow | Transform |
|---|---|---|---|---|---|
| default | `rgba(255,255,255,0.04)` | `#FFFFFF` | `1.5px rgba(255,255,255,0.55)` | none | scale 1 |
| pressed | same | same | same | none | scale 0.98 |
| selected | `var(--sun)` | `var(--ink)` | none | `shadow-chip-selected` (see tokens.md §5) | scale 1.02 |
| disabled | `rgba(255,255,255,0.04)` | white 0.4 | white 0.18 | none | scale 1 |

**Dimensions:** padding `14px 22px`, min-height `48px`, radius 999.
**Tap target:** ≥48×height by construction. Wide labels OK.
**Transition:** `all 180ms cubic-bezier(.22,.61,.36,1)`.
**Backdrop:** default state has `blur(4px)` so it reads on busy gradient. Selected does not (sun is opaque).

**Multi-select rule (check-in why):** the meta option `"Nothing tonight"` is mutually exclusive — selecting it clears all others; selecting any other clears it.

**Capped multi-select rule (Q1 cuisine craving):** Q1 is multi-select with a hard cap of **3** picks plus a mutually-exclusive **"No preference"** chip. Once 3 cuisines are selected, every unselected cuisine chip renders in the `disabled` state (dimmed); a selected chip always stays tappable so it can be deselected to free a slot. Selecting "No preference" clears every cuisine; selecting any cuisine clears "No preference". "No preference" never counts toward the 3-cap. (v1.1 quiz redesign — Q1; `surfaces/03-quiz.md` §Q1.)

**SwiftUI:**
```swift
Button(label) { ... }
  .padding(.horizontal, 22).padding(.vertical, 14)
  .background(isSelected ? GTIColor.sun : Color.white.opacity(0.04))
  .overlay(Capsule().stroke(isSelected ? .clear : .white.opacity(0.55), lineWidth: 1.5))
  .clipShape(Capsule())
  .shadow(...)
```

---

## C-05 · Primary Pill CTA

The bottom-anchored commitment surface. Always full-width within a 22px-inset dock.

| Variant | Background | Text | Shadow | When |
|---|---|---|---|---|
| `white` (canonical) | `#FFFFFF` | `var(--ink)` | `shadow-cta-white` | Quiz advance, "I'm in" |
| `sun` | `var(--sun)` | `var(--ink)` | `shadow-cta-sun` | Q5 "Drop the verdict", committed state ("You're in · 3 of 4"), reroll burn |
| `ink` | `var(--ink)` | `#FFFFFF` | `shadow-cta-white` | Disabled-ish (reroll without reason) |
| `ghost` | transparent | `#FFFFFF` | none, inset `1.5px white 0.5` border | Secondary ("Open in app", "Nudge Sam") |

| Property | Spec |
|---|---|
| Height | 60 |
| Radius | 999 (full pill) |
| Font | `cta` (Inter 800 / 14 / 0.14em tracking, UPPERCASE) |
| Pressed | `scale(0.98)` for 140ms |
| Disabled | `opacity: 0.45`, cursor not-allowed |

**Copy rules:** UPPERCASE only. `"I'm in"` / `"Drop the verdict"` / `"Reroll · burns 1 of 3"` — never `"Confirm"`, never `"Submit"`, never `"OK"`.

---

## C-06 · Receipt Chip — Glass

The procedural-justice signal: `{name} {action}`.

| Element | Spec |
|---|---|
| Container | padding `7px 13px 8px`, radius 999, **glass**: `rgba(255,255,255,0.18)` + `backdrop-filter: blur(14px) saturate(160%)` + `0.75px solid rgba(255,255,255,0.32)` |
| Inset highlight | `inset 0 1px 0 rgba(255,255,255,0.25)` |
| Name | Inter 800 / 12 / tracking 0.1 / white |
| Action | Inter 500 / 12 / tracking 0.1 / white 0.82 |
| Gap (name→action) | 5 |
| Enter animation | `gti-stagger-in` (480ms ease-out-soft) with 80ms stagger between chips |

**Wrap rule:** receipts wrap to a 2nd line at the 4th chip. Always centered.

**Anonymization rule (from brief):** the *what* is private if it's a constraint (`"filtered shellfish"`, not `"has shellfish allergy"`), but the *who* surfaces because that part is consented.

**SwiftUI:** `.background(.ultraThinMaterial)` inside a Capsule clip is the correct primitive.

---

## C-07 · Avatar Dot

Used in waiting state and (optionally) receipts. Initial letter on colored disk.

| Property | Spec |
|---|---|
| Size | 36 (compact) / 48 (waiting prominent) |
| Background | per-person color (see §personas below) |
| Initial | Inter 900 / 42% of size / `var(--ink)` |
| Answered ring | `0 0 0 2.5px white 0.85, 0 8px 22px rgba(0,0,0,0.18)` |
| Unanswered ring | `inset 0 0 0 1px white 0.25`, opacity 0.55, grayscale 0.5 |
| Answered check badge | 14×14 sun-yellow disk, bottom-right, `✓` Inter 900 / 8 |
| Transition | `all 320ms ease-out` |

**Persona color reference (placeholder; real personas come from user record):**
`#FFD23F` (you · sun) / `#7DDFB5` (alex) / `#FF8DA1` (maya) / `#9BC0FF` (sam) / `#E0B0FF` (sam-alt) / `#FFA86D` (additional).

---

## C-08 · Vibe Energy Scale (Q4)

The Q4 input — a 5-point cardinal energy scale. (The v1 name "Vibe Slider"
was retired: Q4 was never a continuous slider, and the v1.1 quiz redesign
fixes the question to a single axis — energy / loudness, not formality.)

| Element | Spec |
|---|---|
| Live word | `display-xl` (Inter 900 / 96 / -0.03em), white, height container 124, vertical center |
| Word change animation | `gti-rise` (700ms ease-out-soft) — replaces by key change |
| Stop bar | 5 × `flex: 1`, height 12, radius 999, gap 6 |
| Stop default | `rgba(255,255,255,0.22)` |
| Stop selected | `var(--sun)`, scaleY(1.4), glow `0 0 18px rgba(255,210,63,0.6)` |
| Stop transition | `all 200ms ease-out` |
| End labels | eyebrow / white 0.7, justify-between |

**Vocabulary** — the canonical Q4 energy scale is the `vibe-labels` token
in `tokens.json`: `QUIET · CHILL · SOCIAL · LIVELY · ROWDY`. The scale runs
low-energy → high-energy; index 0 is the quietest stop. Generated into
`GTIVibeLabels.all` (`ios/Sources/GTITokens.swift`) by `gen-swift.mjs` — never
hardcode the labels. (v1.1 quiz redesign — `gti-vault/50_product/v1.1-quiz-amendments` §2.)

**Why no real drag handle:** Q4 is **cardinal-scalar**, not interpolatable; tapping a stop is the canonical interaction. A drag handle would invite users to land between stops, which the preference math can't use.

---

## C-09 · Time Badge

Sun-yellow rounded block carrying when + who.

| Element | Spec |
|---|---|
| Container | padding `12px 30px`, radius 16, `var(--sun)` bg, `var(--ink)` fg |
| Shadow | `shadow-time-badge` |
| Time | `display-s` (Inter 900 / 34 / -0.02em) |
| Audience line | Inter 800 / 9 / tracking 0.18em, UPPERCASE, 4px above content baseline |
| Enter | `gti-pop` (520ms ease-out-soft) at choreo delay 820ms |

**Audience copy formula:** `"All four of you"` (when 100%) / `"Three of four"` (when partial, kept after hard-close). Lowercase "of" — sentence-case in eyebrow casing for warmth.

---

## C-10 · Verdict Hero (Place Name)

| Property | Spec |
|---|---|
| Font | `display-l` Inter 900 / 60 / -0.03em / line 0.9 |
| Case | UPPERCASE |
| Layout | **One word per line.** Hand-break the string at the model level — don't trust the renderer. |
| Color | `#FFFFFF` |
| Enter (choreo) | `gti-rise` (800ms ease-out-soft) at delay 280ms |

---

## C-11 · Eyebrow

Inter 700 / 11 / tracking 0.18em, UPPERCASE. White on gradient at opacity 0.78 (default) or 0.6 (de-emphasized). See `tokens.md` §2.

---

## C-12 · Rule Chip / Rule Sentence

The aggregate-rule receipt. One short sentence, not a paragraph. **Names what eliminated options, never who.**

| Property | Spec |
|---|---|
| Container | no background — type only, centered, max-width 280 |
| Font | Inter 600 / 14 / line 1.45, white 0.92, `text-wrap: balance` |
| Enter (choreo) | `gti-rise` (500ms) at delay 1020ms |

**Good:** `"Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission."`
**Bad:** `"Maya capped at $30 so we cut Ren Soba."` (names the who)
**Bad:** `"The algorithm chose Pico's."` (gives the app authorship)

---

## C-13 · Cuts Drawer

Collapsed by default. Reveals struck-through eliminated options, each tagged with the rule that killed it.

| Element | Spec |
|---|---|
| Trigger (collapsed) | "See what got cut →" — eyebrow style, full width, white 0.85, centered |
| Header (open) | Eyebrow "What got cut" + tappable "Hide" eyebrow on right |
| Row | padding `8px 12px`, radius 10, `rgba(0,0,0,0.18)` bg, `gti-fade-up` stagger 60ms |
| Cut name | Inter 800 / 14, white, `text-decoration: line-through` 1.5px white 0.6 |
| Cut reason | Inter 600 / 11, white 0.7 |
| Row gap | 6 |

---

## C-14 · Voice Receipt Row

A horizontal-wrap row of `Receipt Chip` (C-06). On verdict: 4 chips, wraps to 2 lines. Gap 6 between chips, centered, padding `0 22px`.

Stagger order: declared in receipt order, 80ms between each, beginning at choreo delay 1140ms.

---

## C-15 · Regret Rater Card (Q5)

3 cards. Each card: name + meta + 5-button rating row.

| Element | Spec |
|---|---|
| Card | `Glass` soft variant (white 0.10) + `border 0.75px white 0.32` + `radius 18` + padding 14 |
| Name | Inter 900 / 17 / line 1.1, white |
| Meta | Inter 600 / 11 / tracking 0.08, UPPERCASE, white 0.7 |
| Rating button | flex:1, height 40, radius 10, default `rgba(255,255,255,0.10)` + `1px white 0.22` border |
| Rating selected | `var(--sun)` + `var(--ink)`, no border, shadow `0 8px 18px rgba(255,210,63,0.32)` |
| End labels | eyebrow / 9px / opacity 0.6 — "Don't mind" / "Really mind" |
| Card-to-card gap | 12 |

**Accessibility note:** Rating buttons are 40px in the canvas — below the 44pt iOS minimum. In SwiftUI, target `.frame(minHeight: 44)` and let the row size up; if vertical room is tight, reduce padding instead. See `accessibility.md`.

---

## C-16 · Bottom Sheet — Reroll

Reroll sheet is the system's friction surface. Slides up from below the verdict.

| Element | Spec |
|---|---|
| Backdrop | `rgba(0,0,0,0.32)` over the original verdict (verdict stays visible behind, dimmed) |
| Sheet | inset 12 from edges, bottom 12; `rgba(20,20,30,0.92)` + 24px backdrop blur; radius 26; `1px white 0.10` border; shadow `0 -20px 60px rgba(0,0,0,0.5)` |
| Handle | 38×4 white 0.22 pill, top-centered, margin-bottom 18 |
| Reason tiles | 5 items in `2-col grid`, gap 8; each is radius 12, padding 14, default `rgba(255,255,255,0.04)` + `1px white 0.14` border; selected `var(--sun)` + `var(--ink)` + shadow `0 10px 22px rgba(255,210,63,0.28)` |
| Tile content | display icon glyph (`$ → ~ ✕ ○`) Inter 900 / 18 / opacity 0.85, then label Inter 800 / 13 |
| "2 LEFT" stamp | radius 6, padding `6px 10px`, `rgba(255,210,63,0.16)` bg + `1px rgba(255,210,63,0.45)` border, `var(--sun)` text Inter 900 / 10 / tracking 0.14, UPPERCASE |
| Detail input | radius 10, padding `12px 14px`, `rgba(255,255,255,0.05)` + `1px white 0.14`, Inter 600 / 13 / white |
| CTA | Pill CTA `sun` if reason selected, `ink` (disabled-ish) if not. Label literally reads `"Reroll · burns 1 of 3"` to expose the cost. |

**The friction is the feature.** The "2 LEFT" stamp and the burns-cost CTA copy are load-bearing.

---

## C-17 · Locked Plate (Hard-Close)

What replaces the verdict when the correctability window closes.

| Element | Spec |
|---|---|
| Veil | `rgba(0,0,0,0.62)` over the verdict gradient at half grain |
| Shutters (`closeMotion: shutter`) | 2 black panels (top + bottom) at 34% screen height each, `#0A0A0F` bg, sun-yellow hairline border on the inner edge (`1px rgba(255,210,63,0.18)`), enter `gti-shutter-top`/`bot` 700ms with 100ms delay |
| Locked badge | eyebrow text "● Verdict locked", `rgba(255,210,63,0.18)` bg + `1px rgba(255,210,63,0.5)` border, `var(--sun)` text, radius 8, padding `10px 16px` |
| Headline | `display-m` 52px, UPPERCASE, white. Always shows `"{Place}\nat {Time}"` |
| Body | Inter 600 / 13 / white 0.7 / max 280 / balanced — explains the window closed |
| Timestamp footer | Mono 10 / tracking 0.18 / white 0.45 / UPPERCASE — "Locked 6:48:32 PM · 2 of 3 rerolls remain" |
| Alt motions | `fade` (no shutter, veil only fade-in) / `stamp` (lock badge pops fast, headline immediate) |

**Why it has to feel like finality and not punishment:** the shutters are sun-edged (system color), not black-edged. The mono timestamp + receipts (rerolls remain) carry information forward; the user is told their next move.

---

## C-18 · Check-in Tap Card

Three large tap rows. Selecting opens a follow-up.

| Row | Background | Text | Shadow | Sub copy |
|---|---|---|---|---|
| `We went` | `var(--sun)` | `var(--ink)` | `shadow-cta-sun` | "And it was great" |
| `We skipped` | `#FFFFFF` | `var(--ink)` | `shadow-cta-white` | "Something came up" |
| `Ask me later` | transparent + `1.5px white 0.5` | `#FFFFFF` | none | "Not sure yet" |

| Element | Spec |
|---|---|
| Row | padding `16px 22px`, radius 18, justify-between, → glyph right (Inter 900 / 18 / opacity 0.7) |
| Title | Inter 900 / 16 / tracking 0.06 |
| Sub | Inter 600 / 11 / tracking 0.06 / opacity 0.7 |

After `We skipped`: chip row (C-04) of reasons: `Wallet/time · Group bailed · Place was packed · Mood shifted · Other`.
After `We went` or `Snooze`: confirmation plate with a one-liner. Always a single tap surface — never a form.

---

## C-19 · Vertical Picker Row (Initiator)

| Element | Spec |
|---|---|
| Row | padding `14px 18px`, radius 14, glass bg `rgba(255,255,255,0.06)` default / `rgba(255,255,255,0.22)` selected, `1px white 0.18` / `1px white 0.5` border, `blur(12px)` backdrop |
| Label | Inter 800 / 18 / white |
| Meta | Eyebrow / 11 / white 0.78 — "Where to eat" / "Coming v2" |
| Selected check | 22×22 sun disk, `✓` Inter 900 / 12 / ink |
| Disabled | opacity 0.55, not-allowed cursor |

---

## C-20 · GTI Wordmark

Placeholder. Lockup: 5-radius sun-yellow tile containing Inter 900 lowercase `g` (size 0.55×) + Inter 800 wordmark `GetToIt` (size 0.78×) with letter-spacing 0.6.

Treat as **not final** — real wordmark is owned by `40_marketing_branding/`.

---

## C-21 · Range Slider

Continuous numeric input on a gradient surface. Used by S01-setup (distance) and S05 verdict's "Widen radius" branch. Single primitive — no min/max chips, no end labels, no histogram. The current value renders as a readable label in the row above the slider (e.g. `"2.0 mi"`).

| Element | Spec |
|---|---|
| Row | full-width, vertical padding 18 (gives a 60-tall hit row clearing 44pt) |
| Track | height 6, radius 999, background `rgba(255,255,255,0.22)`, inset shadow `inset 0 1px 0 rgba(0,0,0,0.18)` |
| Filled track (left of thumb) | `var(--sun)` with glow `0 0 12px rgba(255,210,63,0.45)` |
| Thumb | 22×22 disk, `#FFFFFF`, shadow `0 4px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.7)` |
| Hit target | the `<input type="range">` overlay is `height: 44`, opacity 0 — clears HIG 44pt min |
| Transition | none on the thumb (latency-sensitive). Filled-track width follows the drag 1:1. |

**Visual treatment chosen — sun-filled left of thumb:**
The C-08 vibe slider already uses sun-fill for its selected stop. Continuity with that pattern keeps "state = sun" intact (`tokens.md §1.3`). White-glass fill would have read as inert/decorative.

**Tap target:** The visual bar is 6px; the input overlay is 44pt tall. Both the bar and the row above (label) are inside the same hit row.

**Accessibility:**
- `aria-label` describes what's being adjusted (e.g. `"Walk radius"`, `"Plan distance"`).
- `aria-valuetext` mirrors the visible label so VO reads `"2.0 miles"` rather than `"2"`.
- VO order: row label → live value → slider hint (`"Adjustable. Swipe up or down to change."`).

### Variants

**Uniform step (canonical):** Pass `min` + `max` + `step`. The native `<input type="range">` slides linearly across that range. Used by S05 verdict "Widen radius" (`1.0 / 0.5 / 10.0`).

**Non-uniform `steps` array + anchor tick** *(added 2026-05-19 for sg-WF-1):* Pass `steps={[…]}` instead of `min`/`max`/`step`. The slider derives `min` / `max` from the first / last entries; the native overlay uses the smallest gap between adjacent entries as its step resolution; on `onChange`, the JSX snaps the raw value to the nearest entry in the list. The optional `tickAt={value}` prop renders a subtle 2 × 10 px anchor mark on the track at the given value (color: `color.slider.tick` → white 0.55). The tick is purely visual — no words, no label — and does not interact with snap behavior.

Used by S01-setup distance slider:
- `steps={[0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]}` — granularity tracks the walk/drive cognitive shift (0.25 below 1 mi, 0.5 between 1 and 5, 1.0 above 5).
- `tickAt={1.0}` — anchors the implicit walk/drive boundary without resurrecting the rejected transport-mode question (workflow-overhaul Q8).

The token `color.slider.tick` (`rgba(255,255,255,0.55)`) was added with this variant; the same opacity already serves the chip outline and the S01 settings link, so the value lifts an existing visual into a registered semantic role. Generated into `GTIColor.Slider.tick` (`ios/Sources/GTITokens.swift`) by `gen-swift.mjs`.

**SwiftUI primitive (uniform step):** `Slider(value: $radius, in: 0.5...5.0, step: 0.5)` with `.tint(GTIColor.sun)` and a custom `.frame(height: 44)`. Render the value label separately above the slider so it can use `mono-tag` or similar treatment.

**SwiftUI primitive (non-uniform steps + tick):** The native `Slider` API only supports uniform steps. The iOS port lays a custom track + thumb on top of a `Slider(value: $rawValue, in: 0.25...10.0)` (no step), binds `onChange` to snap to the nearest entry of the `steps` array, and overlays a 2×10 `Rectangle().fill(GTIColor.Slider.tick)` at the `tickAt` percentage. See tb-WF-4 for the specific Swift wiring.

**When NOT to use:** ordinal/cardinal-scalar inputs (vibe Q4) — use C-08 Vibe Energy Scale; users should land on discrete labeled stops, not in-between values.

---

## C-22 · Auth Upgrade Chip

The non-blocking Sign-in-with-Apple affordance on S04 Waiting. **Voluntary warm-friend register** — opportunistic upgrade, never a gate. The chip is secondary to the primary "N of M are in" headline; users can complete the entire decision ritual without ever touching it.

Per [[../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] the chip is iOS-only. The web fallback never renders it (no Sign in with Apple in browser).

### States

| State | Trigger | Render |
|---|---|---|
| `default` | Anonymous user, never dismissed (or dismissal > 30d old) | The full chip — pill button with Apple glyph + label `"Save this taste profile"` and a ghost-text dismiss link `"Maybe later"` below it. |
| `in-progress` | User tapped — Apple flow is on-screen | Pill renders with a small spinner glyph replacing the Apple glyph; label unchanged; disabled. The native Apple sheet is the actual progress UI; the chip just reflects it can't be re-tapped. |
| `success` | `auth.linkIdentity` resolved | Replace the whole component with a quiet `"Saved."` confirmation (mono-tag treatment, white 0.6, no exclamation, no animation beyond a 320ms fade). Auto-hides on the next surface transition; never blocks. |
| `dismissed` | User tapped "Maybe later" OR row already exists with `auth_prompt_dismissed_at` within 30d | Nothing renders. Empty space; the avatar row + headline carry the surface. |
| `hidden` | User is already Apple-linked, OR the surface is being rendered in the web fallback | Nothing renders. |

### Visual spec — `default` state

| Element | Spec |
|---|---|
| Pill | `C-05` Pill CTA, `white` variant — `#FFFFFF` bg, `var(--ink)` text, height 60, radius 999, shadow `shadow-cta-white`. Same primitive as the canonical primary CTA. |
| Apple glyph | Inter 900 / 18 / `var(--ink)`, rendered before the label with 10px gap. Glyph: `` (SF Symbols `applelogo`) on iOS; the JSX uses the Unicode  for fidelity. |
| Label | `cta` token (Inter 800 / 14 / tracking 0.14em / UPPERCASE). String: `"Save this taste profile"`. Hand-cased: the literal copy is sentence-case `"Save this taste profile"`, the pill renders it uppercase via the `cta` token's `case: upper`. |
| Dismiss link | `eyebrow` token, white 0.6, label `"Maybe later"`, 14px tap padding inside a 44pt-tall hit row. Centered below the pill, 12px gap. |
| Surface position | In the CTA dock on S04, **above** the initiator-only `"Decide now"` CTA, **below** the avatar row + waiting headline. On non-initiator screens, the chip is the only CTA besides "Nudge". |

### Visual spec — `in-progress` state

| Element | Spec |
|---|---|
| Pill | Same as default, but `disabled` (opacity 0.45, not-allowed cursor). Apple glyph + label stay; the visual signal "I tapped, I'm waiting" comes from the dimmed pill. |
| Apple sheet | The native `ASAuthorizationController` sheet renders **on top** of the surface and is the actual progress UI. We don't render an in-pill spinner — that would compete with the sheet for attention. |
| Dismiss link | Hidden — the user is mid-flow; offering the escape competes with Apple's own sheet. |

### Visual spec — `success` state

| Element | Spec |
|---|---|
| Container | No pill, no shadow. Centered in the slot the chip used to occupy. |
| Label | `mono-tag` (IBM Plex Mono 11 / tracking 0.18em / UPPERCASE / white 0.6). String: `"Saved."` with a trailing period. |
| Transition | `fade` 320ms ease-out from the chip's final frame. No bounce, no celebration motion — quiet by design. |
| Auto-dismiss | The label is informational, not a CTA. It vanishes on the next surface transition (verdict). |

### Copy rules (LOCKED)

- **Primary label:** `"Save this taste profile"`. NEVER `"Sign up"`, `"Create account"`, `"Sign in with Apple"`, `"Continue with Apple"`, `"Confirm identity"`.
- **Dismiss label:** `"Maybe later"`. NEVER `"No thanks"`, `"Skip"`, `"Not now"`, `"X"`.
- **Success label:** `"Saved."`. Period included. NEVER `"Welcome!"`, `"You're in!"`, `"All set"`, `"Account created"`.

The register is voluntary warm-friend per ADR 0007 §"Why" — anything that frames the action as joining, signing up, or finishing a setup violates the design.

### Dismiss + suppression

- Tapping `"Maybe later"` writes `user_preferences.auth_prompt_dismissed_at = now()` for the current `auth.users.id`.
- On every subsequent render of S04, the chip checks `now() - auth_prompt_dismissed_at`. If < 30 days, render `dismissed` (nothing). If ≥ 30 days, render `default` again — the user gets one re-prompt per month at most.
- Successful link does NOT touch `auth_prompt_dismissed_at`. The user's identity is no longer anonymous; the chip checks the identity state first and renders `hidden`. The timestamp lingers for forensic / debug value; it's harmless once the user is linked.

### Accessibility

- Pill tap target ≥ 44pt (the 60-tall pill clears it natively).
- Dismiss link tap target ≥ 44pt — the visible label is small, but the hit row pads it out to 44.
- VoiceOver order: pill ("Save this taste profile, button") → dismiss link ("Maybe later, button"). The Apple glyph is decorative — no separate VO announcement.
- Reduced motion: skip the success-state fade; show the `"Saved."` label immediately.

### SwiftUI primitive

```swift
// Reuses the existing `PillCTA` style — no new primitive.
// The Apple glyph is `Image(systemName: "applelogo")` in `.foregroundStyle(GTIColor.ink)`.
// The dismiss link is a `Button("Maybe later") { ... }` with `.font(.system(size: GTIFont.Size.eyebrow, weight: .bold))`.
// `SignInWithAppleButton` from `AuthenticationServices` is NOT used directly — Apple's HIG
// allows custom buttons as long as the locked copy is honored. We render our own pill
// and trigger the `ASAuthorizationAppleIDProvider().createRequest()` flow on tap.
```

**Why not the system `SignInWithAppleButton`:** that primitive locks the label to Apple's strings (`"Sign in with Apple"`, `"Continue with Apple"`) and a fixed visual treatment. We need the warm-friend label and the surface-matched white-pill style. Apple's HIG explicitly permits custom buttons that trigger the same `ASAuthorizationController` request — the constraint is on the auth API, not the visual.

**When NOT to use:** anywhere outside S04 Waiting. The chip is single-surface by design — it appears at the post-quiz upgrade moment ADR 0007 ratified, and nowhere else. The success and dismiss states fold cleanly into the same surface so no follow-up screen is needed.

---

## C-23 · LocationPicker

Reusable location selector. Bundled **readout chip** + tap-to-open **bottom sheet** containing a **typeahead input**, a **use-current-location** affordance, and a **suggestion list**. Decision recorded in [[../gti-vault/60_engineering/adr/0009-locationpicker-as-reusable-component|ADR 0009]] (Path B — reusable primitive, not ad-hoc composition).

The conceptual component is single; the JSX splits into `LocationPickerChip` (the persistent readout) + `LocationPickerSheet` (the editor) for clarity, mirroring the C-22 chip+sheet relationship.

**Refero anchor:** [Lumy — Changing location step 3](https://refero.design/screens/a18a8df8-e338-4339-a1d7-a93becea9ed9) (`a18a8df8-e338-4339-a1d7-a93becea9ed9`). Dark surface, yellow accent for the selected row (yellow text + yellow check), "Current Location" affordance with an arrow-paper-plane glyph, recents list grouped under a hairline rule, dismiss `×` in the upper-right. Translates to Sunset Pop with zero re-mapping: the dark surface is already our gradient idiom, the yellow accent is `var(--sun)`, no red or green anywhere.

**Why a sheet and not an inline expand:** the typeahead surface needs the on-screen keyboard plus 4–6 suggestion rows visible at once; an inline expand would push the rest of S01 off the bottom. C-16 already establishes the sheet idiom for the system's secondary editor surface (reroll). The picker inherits the same primitive.

**Why no map thumbnail:** the original issue floated a place-typeahead + map-thumbnail composite. Dropped after Refero pass — neither Lumy nor Apple Invites earns a thumbnail in their picker, the screen is text-first, and the thumbnail would compete with the suggestion list for the same vertical real estate. Kept as a deferred option in case the multi-geo work resurfaces it.

### Sub-components

`C-23` ships as two JSX exports that compose into a single conceptual primitive:

- **`LocationPickerChip`** — the always-visible readout on S01 (initiator) and any future surface hosting persistent location.
- **`LocationPickerSheet`** — the typeahead editor that opens on chip tap.

### States — at-a-glance

| State | Trigger | Render |
|---|---|---|
| `auto` | iOS location permission granted AND GPS resolved a coordinate | Chip shows the GPS-derived place name (e.g. `"Mission · San Francisco"`). Sun-yellow paper-plane glyph (matching Lumy's "Current Location" affordance) signals the value came from GPS. |
| `manual` | Permission denied OR user typed a value AND committed it | Chip shows the manually-selected place name. No paper-plane glyph (the value is user-typed, not GPS). |
| `stale` | Permission granted but GPS unavailable / last fix > 30 min | Chip shows last-known place name, paper-plane glyph muted to white 0.45, mono-tag suffix `"· OUT OF DATE"`. Tap-to-edit still works. |
| `empty` | Permission denied AND user has not yet selected | Chip shows placeholder `"Set your location"` in white 0.6, tap-to-edit. No glyph. |
| `loading` | Permission granted, GPS request in flight (initial mount only) | Chip shows mono-tag `"LOCATING…"` in white 0.6. Non-interactive until resolved (~2s). |

### Visual spec — `LocationPickerChip` (the readout)

| Element | Spec |
|---|---|
| Container | full-width row, padding `12px 16px`, radius `var(--r-row)` (12), soft-glass `--glass-fill-soft` bg + `1px white 0.18` border, `backdrop-filter: blur(12px) saturate(160%)` |
| GPS glyph | Inter 900 / 16 / `var(--sun)`, paper-plane character rotated -45deg (matches Lumy's tilt), 8px right margin. Only renders in `auto` + `stale` states. `aria-hidden`. |
| Place name | Inter 700 / 17 / line 1.2, white, 1 line, ellipsis on overflow |
| Sub-label | `eyebrow` (Inter 700 / 11 / tracking 0.18em UPPERCASE) white 0.6, top-margin 2. Reads `"YOUR LOCATION"` in `auto`/`manual`, `"OUT OF DATE — TAP TO REFRESH"` in `stale`, `"TAP TO SELECT"` in `empty`. |
| Edit affordance | Trailing chevron `›` Inter 900 / 14, white 0.55, vertically centered. Indicates tap-to-edit. |
| Tap target | Full row, min-height 56 (clears HIG 44 with breathing room) |
| Press state | Background → `--glass-fill-soft-press` (white 0.16), 140ms `var(--ease-out)`. Same press idiom as C-19. |
| Loading shimmer | When `state === 'loading'`, the place-name slot is replaced with `mono-tag` text `"LOCATING…"` opacity-pulse 0.5 ↔ 1.0 over 1400ms `var(--ease-in-out)`. No spinner — the system's no-spinner rule (motion.md §"What we deliberately do *not* animate") applies. |

### Visual spec — `LocationPickerSheet` (the editor)

The sheet inherits C-16's primitive (radius, blur, shadow, handle) verbatim so the system has one sheet idiom, not two.

| Element | Spec |
|---|---|
| Backdrop | `rgba(0,0,0,0.32)` over the host surface (S00b or S01). Tap-to-dismiss. |
| Sheet | inset 12 from edges, bottom 12; `rgba(20,20,30,0.92)` + 24px backdrop blur; radius `var(--r-sheet)` (26); `1px white 0.10` border; `shadow-sheet` |
| Handle | 38×4 white 0.22 pill, top-centered, margin-bottom 18 — identical to C-16 |
| Header | Left: dismiss `×` (Inter 900 / 22 / white 0.85, 32×32 tap target — wraps in a 44pt hit-row). Right: eyebrow `"LOCATION"` white 0.6. |
| Open motion | translateY 100% → 0 + opacity 0 → 1, **380ms `var(--ease-out-soft)`** (matches C-16 sheet-open timing — motion.md utility table) |
| Dismiss motion | reverse, **280ms `var(--ease-out)`** |

### Visual spec — typeahead input (inside the sheet)

| Element | Spec |
|---|---|
| Container | full-width row, padding `14px 16px`, radius `var(--r-row)` (12), `--glass-fill-soft` bg + `1px white 0.18` border |
| Leading search glyph | Inter 900 / 14, white 0.55, `aria-hidden` |
| Input | Inter 600 / 16 / line 1.2, white. Placeholder `"Search a city, neighborhood, or address"` in white 0.45. `appearance: none`, transparent bg, no native chrome. |
| Caret | Native `caret-color: var(--sun)` — the sun-yellow caret is the only state signal in the input. |
| Trailing clear `×` | Visible only when input has text. Inter 900 / 14 / white 0.6, 32×32 tap target. Clears the input, returns the sheet to its empty / recents state. |
| Focus state | Border thickens to `1.5px var(--sun)` (sun is the only state color). No glow — the caret carries the focus signal. 180ms `var(--ease-out)`. |

### Visual spec — "Use current location" affordance

Renders **only** when iOS permission is granted (states `auto` / `stale`). Sits immediately below the typeahead input, before the recents / suggestion list.

| Element | Spec |
|---|---|
| Container | full-width row, padding `12px 16px`, radius `var(--r-row)` (12), transparent bg (no glass — visually distinct from typed-suggestion rows) |
| Paper-plane glyph | Inter 900 / 14 / `var(--sun)`, rotated -45deg, 12px right margin, `aria-hidden` |
| Label | Inter 700 / 15, white. String: `"Use current location"`. |
| Sub-label | `eyebrow` token, white 0.6, top-margin 2. Renders only in `stale` — string: `"Last fix {N} min ago"` |
| Press state | Background → `--glass-fill-soft-press` (white 0.16), 140ms `var(--ease-out)` |
| Tap target | Full row, min-height 52 |

### Visual spec — suggestion row

| Element | Spec |
|---|---|
| Container | full-width row, padding `12px 16px`, radius `var(--r-row)` (12), transparent bg by default; selected → `var(--sun)` bg + `var(--ink)` text |
| Place name | Inter 700 / 15, white (default) / `var(--ink)` (selected), 1 line, ellipsis on overflow |
| Sub-meta | Inter 500 / 12 / line 1.3, white 0.6 (default) / `rgba(14,16,17,0.7)` (selected). Reads the address line (e.g. `"Mission District, San Francisco, CA"`). |
| Selected check | Right-aligned, 18×18 `var(--ink)` `✓` Inter 900 / 12, only renders in selected state |
| Press state | Background → `--glass-fill-soft-press` (white 0.16), 140ms `var(--ease-out)`. Selected rows skip the press transition (sun is opaque, no need). |
| Tap target | Full row, min-height 52 (clears HIG 44) |
| Row gap | 4 between rows; section header (`"RECENT"`, `"RESULTS"`) is an `eyebrow`-token row above |

**Selection behavior:** tap → row's selected state lights up for 180ms → sheet dismisses → chip readout updates → focus returns to the host surface's next CTA.

### Visual spec — empty state (typeahead has no query AND no recents)

| Element | Spec |
|---|---|
| Container | centered column, padding `48px 22px`, gap 12 |
| Glyph | sun-yellow `◎` Inter 900 / 32 — non-figurative locator mark |
| Headline | Inter 800 / 16 / line 1.3, white, `text-wrap: balance`. String: `"Type a place to get started."` |
| Body | Inter 500 / 13 / line 1.4, white 0.65, max 260, `text-wrap: balance`. String: `"City, neighborhood, or street address — whatever lands quickest."` |

### Visual spec — deny state (sheet opened with permission denied)

The deny-state empty replaces the "Use current location" affordance with a permission re-enable card. The typeahead input above it still works — manual selection is always available.

| Element | Spec |
|---|---|
| Container | full-width card, padding 16, radius `var(--r-card)` (18), `--glass-fill-soft` bg + `1px white 0.18` border |
| Eyebrow | `eyebrow` token, `var(--sun)`, string `"LOCATION OFF"` |
| Headline | Inter 800 / 15 / line 1.3, white, top-margin 6, `text-wrap: balance`. String: `"Type a place above to keep going."` |
| Body | Inter 500 / 13 / line 1.4, white 0.7, top-margin 4. String: `"Or turn on location in Settings if you'd rather we pick it up automatically."` |
| Settings deep-link | C-05 `ghost` PillCTA, height 48 (compact), label `"Open Settings"`, top-margin 12. iOS deep-link `URL(string: UIApplication.openSettingsURLString)` — opens the app's row in Settings, where the user toggles Location. Web fallback hides this row entirely (no equivalent affordance — manual selection is the only path). |

**Why no red:** the deny-state card uses sun-yellow eyebrow + neutral body copy. Following the locked rule from `tokens.md §1.3` — sun is the only state color, there is no destructive / warning red in the system. The headline frames the denial as "type instead", not "you broke something."

### Copy register (LOCKED)

- **Chip empty:** `"Set your location"` — voluntary verb, not `"Add a location"` (procedural) or `"Location required"` (procedural-coercive).
- **Chip stale suffix:** `"OUT OF DATE — TAP TO REFRESH"` — mono-tag eyebrow, tells the user the value is reusable but staler than the user might want.
- **Typeahead placeholder:** `"Search a city, neighborhood, or address"` — names the input granularity, not the action. Avoid `"Where are you?"` (algorithm-tinted question).
- **Current-location row:** `"Use current location"` — second-person voluntary verb. Never `"Get my location"` (extractive) or `"Use my GPS"` (technical-tinted).
- **Deny-state headline:** `"Type a place above to keep going."` — points the user at the path they can take. Never `"Location is required"` (coercive) or `"Permission denied"` (system-register).
- **Deny-state body:** `"Or turn on location in Settings if you'd rather we pick it up automatically."` — voluntary register, the GPS path is framed as a convenience the user can opt into.
- **Settings deep-link:** `"Open Settings"` — neutral, matches iOS HIG's own deep-link convention.

### Accessibility

- Chip tap target ≥ 56 (clears 44).
- Sheet `×` close, all suggestion rows, "Use current location" row, Settings deep-link — all ≥ 44.
- Caret color (`var(--sun)`) gives the focus signal independent of contrast on the dark sheet.
- VO order on sheet open: dismiss `×` → typeahead input → "Use current location" (when present) → empty/deny-state card (when present) → first suggestion row.
- Sheet uses `role="dialog"` + `aria-modal="true"`; focus is trapped while open.
- `aria-live="polite"` region under the input announces typeahead result count (`"5 results"`).
- Reduced motion: skip the sheet rise; opacity fade only. Skip the `loading` opacity-pulse — show static `"LOCATING…"` until resolved.

### SwiftUI primitive

```swift
// Chip — persistent readout. Renders on S01 and any future surface hosting location.
struct LocationPickerChip: View {
  @Binding var place: ResolvedPlace?
  @State private var sheetOpen = false
  let state: LocationState  // .auto | .manual | .stale | .empty | .loading
  // ...
  var body: some View {
    Button { sheetOpen = true } label: { /* chip layout */ }
      .sheet(isPresented: $sheetOpen) {
        LocationPickerSheet(place: $place, permission: $permission)
          .presentationDetents([.medium, .large])
          .presentationCornerRadius(GTIRadii.sheet)
      }
  }
}

// Sheet — typeahead editor. Wraps `MKLocalSearchCompleter` for suggestions.
// The data-layer service is wired in `tb-03` (iOS); the design-system spec
// is permission-state-agnostic — the iOS port supplies `permission`, the
// component renders the right sub-state.
struct LocationPickerSheet: View {
  @Binding var place: ResolvedPlace?
  @Binding var permission: CLAuthorizationStatus
  // ...
}
```

The data layer is supplied by `tb-03` — `MKLocalSearchCompleter` for typeahead suggestions, `CLLocationManager` for current-location resolution, and an iOS service that bridges both to the SwiftUI `LocationPickerSheet` view. The design-system spec is data-layer-agnostic.

### When NOT to use

- **Anywhere the location is fixed / non-editable.** The chip's always-editable behavior is load-bearing — it's the defense against "denied = broken app." A non-editable location reads as an info row, use a plain glass row instead.
- **Inside the quiz surfaces (Q1–Q5).** The picker is a session-context input that lives on the initiator surface, not a per-question control. Inside the quiz, location is already fixed for the session.

### Re-evaluation triggers (per ADR 0009)

- Picker still hosted only on S01 after pre-public-launch milestone → reconsider whether `C-23` should be folded back into a single-surface composition.
- Multi-geo handling lands and the picker needs to render per-room rather than per-user → may force a `C-23` re-spec.
- Map thumbnail proves needed by a future consumer → un-defer the composite, add a `composite` variant.
