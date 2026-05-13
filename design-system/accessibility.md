# Accessibility — Sunset Pop

WCAG 2.2 AA target. iOS HIG conformance for tap targets and Dynamic Type behavior.

---

## 1 · Contrast

### 1.1 White text on gradient surfaces

The system places white text on gradient surfaces of varying lightness. The Q4/Q5/waiting surfaces (indigo/midnight) are safest; the initiator/Q1/Q2 surfaces (coral/yellow bottoms) are where ratios get tight.

| Surface | Worst-case stop | White on stop (4.5:1 needed AA, 7:1 AAA) |
|---|---|---|
| `initiator` | `#FFD23F` bottom | **~2.1:1 — FAILS AA.** Content area is positioned above this stop. The bottom is below the keyboard / out of read range. |
| `q1` | `#FFD23F` bottom | Same. Chips and CTA stay in the upper 2/3. |
| `q2` | `#FFC75A` bottom | ~2.6:1 — fails. Same mitigation. |
| `q3` | `#6E63E0` bottom | **~3.4:1** — fails AA for body text, passes for large text (≥18pt bold). |
| `q4` | `#7C68E4` bottom | ~3.6:1 — passes large, fails body. |
| `q5` | `#363B82` bottom | **~7.5:1** — passes AAA. |
| `waiting` | `#7256C4` bottom | ~4.0:1 — passes large. |
| `verdict` | `#FFC548` top | Body sits below this. Hero is white-on-coral-mid (~5.0:1 — passes AA). |
| `checkin` | `#FFDB6B` top | Tap rows are colored backgrounds; white only appears on the snooze ghost (mid-screen). |

**Defenses in the design:**

- All **body copy** sits in the upper half of the gradient, where the lightness has room.
- All **CTA labels** are `ink` on `white`/`sun` — never white-on-yellow.
- The eyebrow is treated as *decorative* on bright surfaces — it's a recognition cue, not a load-bearing label. (The display headline carries the meaning.)
- **Dynamic Type respondent:** as users increase type size, lines reflow but don't reposition into the bright zone.

### 1.2 Type on white surfaces (CTAs)

- `var(--ink)` `#0E1011` on `#FFFFFF` → **20.4:1 — AAA**.
- `var(--ink)` on `var(--sun)` `#FFD23F` → **12.1:1 — AAA**.

### 1.3 Type on midnight surfaces

- `#FFFFFF` on `#0A0B1A` → **20.0:1 — AAA**.
- White 0.7 on midnight → **~14:1 — AAA**.

### 1.4 Non-text contrast (UI elements)

- Chip outlines (white 0.55 on coral) → ~2.6:1, passes 3:1 for non-text components.
- Glass receipt border (white 0.42 on gradient) → ~2.0:1 — borderline; the **inset highlight + backdrop blur** carry the visual separation, not the stroke alone.
- Time badge (sun-yellow on coral) → ~1.8:1 — fails. **Mitigated** by the badge's elevation shadow + interior contrast (ink type on yellow).

---

## 2 · Tap targets

iOS HIG minimum: **44×44pt**. We hit this almost everywhere — exceptions are flagged.

| Component | Size | Status |
|---|---|---|
| Top bar `×` close | 32×32 button, 44×44 effective with surrounding padding | ✅ via hit-slop |
| Top bar segments | 4px height — non-tappable by design | n/a |
| Veto chip (C-04) | min-height 48 | ✅ |
| Pill CTA (C-05) | height 60 | ✅ |
| Receipt chip (C-06) | ~30 height — **non-tappable** (informational) | n/a |
| Avatar dot (C-07) | 36 / 48 | ⚠ 36 is below 44 — wrap in 44×44 hit area, add `accessibilityLabel` |
| Vibe stop (C-08) | 12 visual / 44 hit | ⚠ visual is small, hit area must be padded — bar segment full row 44 tall |
| Time badge (C-09) | non-tappable | n/a |
| Cuts drawer trigger | width 100%, padding 8 — ~32 height | ⚠ pad to 44 |
| Cuts row | padding `8 12` — ~36 height | ⚠ non-tappable (display only) so OK |
| Regret rating button (C-15) | flex / **height 40** | ⚠ **below 44.** Fix in SwiftUI: `.frame(minHeight: 44)`. |
| Reroll reason tile (C-16) | padding 14 — ~64 height | ✅ |
| Check-in tap row (C-18) | padding `16 22` — ~62 height | ✅ |
| Vertical picker row (C-19) | padding `14 18` — ~62 height | ✅ |

**Fixes for the SwiftUI port:**
1. **Regret rating row** — bump min-height to 44. Reduces vertical density slightly; acceptable trade.
2. **Vibe stops** — pad the tap target vertically beyond the 12px visual bar so the user can tap the whole row.
3. **Cuts drawer "See what got cut →" trigger** — bump to 44 min height.

---

## 3 · Focus order

Per surface, the focus order ladders from top → bottom, with the primary CTA always last:

### Quiz surfaces (Q1–Q5)
1. Top-bar close (`×`)
2. (Skip progress bar — decorative)
3. Eyebrow / Title / Sub (read together as the screen header)
4. Each chip / picker / control in source order
5. Primary CTA

### Verdict
1. Top-bar close (none — verdict is post-quiz; close exits to home)
2. Eyebrow → Hero → Meta → Time → Rule → Receipt 1..4 (this read order is the **five-second test**)
3. Cuts drawer trigger
4. Primary CTA (`I'm in` / `You're in`)
5. Secondary (`Start over`)

### Reroll sheet
1. Eyebrow + headline (modal title)
2. "2 LEFT" stamp (read by VO as "2 rerolls remaining")
3. Each reason tile in source order
4. Detail input (when revealed)
5. Primary CTA
6. Cancel

### Check-in
1. Brand + eyebrow context
2. Place hero + meta
3. "Did you go?" question
4. Three tap rows in source order

---

## 4 · VoiceOver labels

Per-component:

| Component | accessibilityLabel |
|---|---|
| Top bar `×` | `"Close session"` |
| Top bar progress | `"Question {n} of 5"` (read once at the start; not on every change) |
| Eyebrow | (skipped — it's an over-line, not a label) |
| Chip (default) | `"{label}"` `accessibilityHint: "Double tap to add as a hard no."` |
| Chip (selected) | `"{label}, selected"` `hint: "Double tap to remove."` |
| Vibe stop | `"Vibe: {word}, position {n} of 5"` |
| Time badge | `"Tonight at 7 PM, for all four of you"` |
| Rule sentence | (read as static text; no special handling) |
| Receipt chip | `"{name}: {action}"` |
| Cuts trigger | `"See what got cut. Double tap to expand."` |
| Cuts row | `"{name}, cut: {reason}"` |
| I'm in (default) | `"I'm in. Double tap to commit to this verdict."` |
| I'm in (committed) | `"You're in. 3 of 4 committed."` |
| Locked plate | `"Verdict locked at 6:48 PM. Re-opening requires a reroll. {n} of 3 rerolls remain."` |

**Cuts drawer rule:** when the drawer expands, post `.announcement` with `"3 places were cut. Ren Soba, over budget cap. Café Lou, shellfish veto. Halal Cart, outside walk range."`.

---

## 5 · Reduced motion

See `motion.md` §5 for the full table. Summary: keep continuity, drop choreography.

- Gradient tween: keep, shorter (300ms linear).
- Verdict reveal: force `off`. All elements present on appear.
- Hard-close: force `fade`. Drop stamp pop.
- Receipt stagger: simultaneous.
- Press feedback: keep (it's not parallax, it's affordance).

SwiftUI gate: `@Environment(\.accessibilityReduceMotion) private var reduceMotion`.

---

## 6 · Dynamic Type

Inter scales cleanly; the layouts have to flex.

| Element | Dynamic Type behavior |
|---|---|
| Display headlines | Don't scale past Large (`xxLarge`). The verdict hero is at the visual ceiling already; further scaling breaks the one-word-per-line rule. **Lock at +1 step beyond default; warn beyond.** |
| Body copy | Scale freely. Use `.dynamicTypeSize(...).injection-aware` layouts (reroll sheet may scroll). |
| CTAs | Scale to a ceiling (height 72 max). Letter-spacing relaxes proportionally. |
| Eyebrow | Doesn't scale (it's chrome, not content). |

When the user is at Accessibility sizes (AX1–AX5):
- Vibe slider's giant word **switches from `display-xl` to `display-l`** (96 → 64) to leave room for the bigger system chrome.
- Q5 regret cards re-flow rating row to 2 lines (`1 2 3 / 4 5`).
- Reroll sheet's reason grid collapses to 1 column.

---

## 7 · Hit-slop / gesture conflict

- The **iOS Dynamic Island** is at `top: 11` over `126×37`. All surface content starts at `padding-top: 56` to clear it. Don't lower this.
- The **home indicator** is at the bottom 34. CTA dock pads bottom 32 to leave breathing room.
- The **swipe-back gesture edge** (left 20px) — primary CTA spans full width but is well above the gesture edge.
- The reroll **sheet handle** is a 38×4 visual that serves as a drag-to-dismiss target; pad the tap zone 44×44 around it.

---

## 8 · Color blindness check

- Sun-yellow is **the only state signal**. There is no green / red duality to confuse.
- Deuteranopia + protanopia: sun-yellow on coral retains contrast (yellow is preserved).
- Tritanopia: yellow → pink shift; the **shape + position** of the time badge and CTA carry the signal even if the color collapses.
- **Don't add a green check** to the "You're in" state. The sun-yellow disk + ink-check is sufficient and CB-safe.

---

## 9 · Audit results

Run on the current prototype:

- ✅ All display copy passes contrast except the bottom 20% of bright gradients, which is design-positioned outside content range.
- ⚠ Regret rating buttons need a +4pt height bump in SwiftUI.
- ⚠ Vibe stop visual is 12px — pad tap target.
- ⚠ Cuts drawer trigger is a 32-tall row — pad to 44.
- ✅ All CTAs are well above 44.
- ✅ Color blindness paths intact (single accent).
- ✅ Reduced motion fallbacks specified.
- ⚠ Dynamic Type strategy needs a per-surface test pass at AX1+ before ship.
