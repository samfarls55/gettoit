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

- **Pre-commitment paralysis.** No "configure your session." No "name your night." No optional fields *that the zero-tap path needs to fill in*.
- **Algorithm framing.** No mention of AI, suggestions, smart anything. The app is plumbing.
- **Group-size friction.** Size is inferred from who accepts the invite, not set up front.

## Components used

`GradientSurface` (initiator) · `GTIMark` · `Eyebrow` · display headline · timer chip group (C-04 variant) · radius slider (C-21) · vertical picker rows (C-19) · `PillCTA` white.

## Timer + radius controls (spec exception)

The v1 PRD ([[../../gti-vault/10_prds/v1-prd|v1-prd.md]]) locks the verdict fire trigger to **initiator-set timer OR initiator manual "Decide now" tap** (see S04), and the candidate pool radius to **initiator-set slider**. Both controls live on this surface because the decision is made before the share-sheet step — the invitees never see them.

### Spec exception against "no optional fields"

The surface's defense rule above forbids "configure your session." These two controls are an explicit exception. The framing is **setting expectations, not configuring options**:

- Both controls have sensible defaults. A user who never touches them still gets a valid session — that's the zero-tap path. The defaults (10 min / 2.0 mi) ship the session.
- Both surface *time-of-night* information the user already has in their head ("we want to leave in 15", "let's stay close"). They're not opening a settings drawer; they're stating the obvious.
- Neither control names the algorithm. Timer reads `"How long"`; radius reads `"How far"`. The values are kept legible (chip labels, mono-tag value), not buried in a sheet.

If the surface starts accumulating more knobs, this exception is over and we move them to a separate sheet. Two is the ceiling.

### Timer chip group — `How long`

| Property | Value |
|---|---|
| Component | C-04 chip variant — pill, full-width row of equal-flex children |
| Options | `5 · 10 · 15 · 30` (minutes) |
| Default | `10` |
| Selection | single-select; tap a chip to select |
| Selected style | sun-yellow fill, ink text, scale 1.02, `shadow-chip-selected` |
| Default style | glass row (white 0.04 bg + white 0.55 outline + blur 4px) |
| Label format | `"{N} MIN"` UPPERCASE, Inter 800 / 14 / tracking 0.08 |
| Tap target | min-height 44 (HIG conformant) |

The selected timer is written to `rooms.timer_minutes` when the CTA fires.

### Radius slider — `How far`

| Property | Value |
|---|---|
| Component | C-21 Range Slider |
| Range | `0.5 mi – 5.0 mi` |
| Step | `0.5 mi` |
| Default | `2.0 mi` |
| Live value label | mono-tag (`"2.0 MI"`) UPPERCASE, top-right of the row, aligns with the `"How far"` eyebrow on the left |
| Track unfilled | `rgba(255,255,255,0.22)` |
| Track filled (left of thumb) | sun-yellow + glow `0 0 12px rgba(255,210,63,0.45)` |
| Thumb | 22×22 white disk |

The selected radius is written to `rooms.radius_meters` (converted from miles) when the CTA fires.

**Layout:** both controls render *above* the vertical picker. The `"tonight, near me"` framing of the radius slider precedes the vertical choice and primes the food-vs-other decision.

## Settings footer link (spec exception)

A single mono-tag `"SETTINGS"` text button renders below the primary CTA in the `CTADock`. Tap routes the user to [[09-settings|S09 Settings]] — v1's account-management surface, which contains exactly one action (delete-my-data) per App Store guideline 5.1.1(v) + [[../../gti-vault/60_engineering/adr/0006-privacy-posture-v1|ADR 0006]].

### Spec exception against "no chrome above the headline"

S01 is otherwise the cleanest surface — `GTIMark` in the top-left corner is the only non-content element above the eyebrow. The Settings link is an explicit exception:

- **App Store 5.1.1(v) requires the deletion affordance to be "easily discoverable."** Reviewers traversing a fresh install must reach the delete action without spelunking. S01 is the surface every user lands on first; placing the link here means the path from cold start to delete-confirm is two taps.
- **The link's visual weight is minimal.** Same `eyebrow` token treatment as `"Maybe later"` on the [[../components#c-22-auth-upgrade-chip|C-22 Auth Upgrade Chip]] — mono-tag, white 0.55, UPPERCASE. No icon, no chrome, no chevron. Doesn't compete with the primary CTA.
- **Anchored to the CTADock, not the top.** Keeps the eyebrow + headline + control stack untouched. The link lives below `"Drop the invite link"`, where the user's eye has already terminated.
- **Single-purpose.** Settings is the only secondary route off S01. If a second secondary route is ever needed (e.g., "View past verdicts"), that's a spec change requiring its own justification — not a license to start growing the dock.

### Treatment

| Property | Value |
|---|---|
| Component | Plain `<button>` styled with the `eyebrow` token (Inter 700 / 11 / tracking 0.18em / UPPERCASE) |
| Label | `"SETTINGS"` (literal upper from the eyebrow case) |
| Color | `rgba(255,255,255,0.55)` (white 0.55 — tertiary on gradient, matches the dismiss-link convention) |
| Tap target | 44pt min-height row (HIG conformant); visible label is small |
| Position | Inside `CTADock`, immediately below the primary `PillCTA` with `4px` margin-top |
| Background / border | None — pure text affordance |

The selection is invariant: no selected state, no disabled state. Tap navigates to S09.

## Copy register

- **`"Figure it out together"`** — warm, present-tense, plural pronoun. Not "Decide where to eat" (procedural) or "Group decision time" (formal).
- **`"Five quick taps each. One verdict. Sixty seconds."`** — three short declarative sentences. The 60-second promise is load-bearing.
- **`"How long"` / `"How far"`** — second-person, casual. Not "Session duration" / "Search radius" (algorithm-tinted).
- **`"Drop the invite link"`** — voluntary verb, casual register, conveys finality.
- **`"SETTINGS"`** — mono-tag eyebrow treatment, deliberately understated. The destination matters more than the link to it.

## v1 scope

Only `food` is selectable. Drinks/Movie render visibly as future plans (opacity 0.55, disabled) so users know more is coming, but aren't interactive.

## Behavior

CTA → generate session ID → write `rooms` row with the selected `timer_minutes` + `radius_meters` (default applied for un-touched controls) → copy link to clipboard → open the iOS share sheet. After share, the initiator transitions to their own Q1 (surface 03).
