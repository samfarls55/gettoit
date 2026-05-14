---
surface: 00b-location-permission
status: locked
locked-date: 2026-05-14
jsx:
  - code/screens/ScreenLocationPermission.jsx
---

# S00b · Location permission pre-prime

> **Code:** [`../code/screens/ScreenLocationPermission.jsx`](../code/screens/ScreenLocationPermission.jsx)

Pre-prime card explaining *why* location is needed before iOS fires the native `CLLocationManager.requestWhenInUseAuthorization` dialog. Surface position: between the landing CTA ("Start a Decision" from sg-02) and S01 Pick-a-Vertical, fired the first time the user enters the decision flow on a fresh install. On subsequent launches with permission already granted (or hard-denied), the surface is skipped.

## What this surface defends against

- **Reflexive "Don't Allow" taps.** Native iOS permission prompts are noisy by default; users who don't see *why* an app wants location often tap deny out of muscle memory. The pre-prime explains the use-case in the app's voice before iOS asks.
- **Algorithm framing.** Don't explain location as "we need it for the algorithm" or "to provide better recommendations." Explain it as "so we don't make you type your neighborhood every time."
- **"Denied = broken app" failure mode.** The body copy and the secondary path both signal that denying is a survivable outcome. The user can still get to a verdict by typing a location manually.

## Components used

`GradientSurface` (initiator stop — same as S01, surface continuity) · `GTIMark` · `Eyebrow` · display headline · body copy · `PillCTA` white (primary) · ghost text-link (secondary).

No `C-23 LocationPicker` on this surface — the picker doesn't show up until S01 Pick-a-Vertical, with whatever value the permission flow produced. This surface is purely the pre-prime card.

## Behavior

| User action | App behavior |
|---|---|
| Tap **primary CTA** (`"Share my location"`) | Fire native `CLLocationManager.requestWhenInUseAuthorization`. iOS dialog appears on top of the surface. On dialog resolve: granted → proceed to S01 with `LocationPicker` mounted in `loading` then `auto` state; denied → proceed to S01 with `LocationPicker` mounted in `empty` state. |
| Tap **secondary** (`"Pick a place manually"`) | Skip the iOS prompt entirely. Permission state remains `notDetermined`. Proceed to S01 with `LocationPicker` mounted in `empty` state. The picker's sheet will show the typeahead-only flow (no "Use current location" affordance, no deny-state re-enable card — the user explicitly chose this path, no need to flag it). |

## Why offer a "Pick a place manually" escape

The pre-prime is a soft prompt — the user gets a one-tap path to keep moving without ever firing the system prompt. This matters because:

1. The native iOS prompt is **two-state-and-out** — granted/denied are sticky until the user goes into Settings. If a user wants to try the flow first and decide on permission later, the manual-entry path is the only way to reserve that decision.
2. Permission-fatigued users (post-iOS-17 ATT era) often deny everything on first-pass and re-grant selectively later. The picker's `empty` state on S01 still works.
3. The pre-prime should feel like a courtesy, not a gate. The presence of a manual-entry escape reinforces that framing.

## Copy register

- **Eyebrow:** `"BEFORE WE START"` — mono-tag eyebrow, sets context that this surface is one step.
- **Headline:** `"Where are\nyou eating\ntonight?"` — hand-broken, one phrase per line, conversational second-person. Avoids `"Enable location services"` (procedural-system) or `"Allow location access"` (procedural-coercive). The question framing names the use case directly.
- **Body:** `"We'll line up restaurants close enough to walk to, instead of asking your neighborhood every time. Sharing your location is optional — type it in if you'd rather."` — three short clauses, second-person, voluntary register. The "optional" disclosure is load-bearing — it's the explicit signal that denying is survivable.
- **Primary CTA:** `"Share my location"` — voluntary verb (`"Share"`), not `"Allow"` (matches iOS system register) or `"Enable"` (procedural). The user is *sharing*, not toggling a setting.
- **Secondary:** `"Pick a place manually"` — eyebrow-style text link, second-person, signals that the user is in control of *how* they tell us where they are.

## Visual

| Element | Spec |
|---|---|
| Surface | `GradientSurface` stop `initiator` — same gradient as S01, so the transition between pre-prime → permission dialog → S01 reads as the same coral-to-sunset moment. |
| `GTIMark` | top-left, size 22, matches S01 chrome |
| Eyebrow | `"BEFORE WE START"`, white 0.78, mono-tag treatment via the `eyebrow` token |
| Headline | `display-m` token (Inter 900 / 44 / -0.025em / line 0.92) — fits comfortably under the eyebrow with breathing room for the body |
| Body | Inter 600 / 15 / line 1.45, white 0.84, max-width 320 |
| Primary CTA | C-05 `white` PillCTA, `"Share my location"` |
| Secondary | eyebrow-token text button, white 0.55, `"Pick a place manually"`, 44pt hit-row below primary CTA — same treatment as S01's `"SETTINGS"` link and S04's `"Maybe later"` |
| Layout | `GTIMark` top, headline+body block at ~40% vertical, CTA dock at bottom. Matches S01 structure for surface continuity. |

## Motion

- Enter: surface fades up over 320ms `var(--ease-out-soft)` from the prior surface (landing). No choreographed reveal — this is a utility surface, not a verdict.
- Exit on CTA tap: native iOS permission dialog renders on top; surface is unchanged until dialog resolves. After resolve, transition to S01 via the standard gradient tween (1100ms — same surface stop so no visible color change, just the layout swap).
- Reduced motion: instant fade-up.

## Accessibility

- VO order: `GTIMark` (decorative — `aria-hidden`) → eyebrow → headline → body → primary CTA → secondary text link.
- Primary CTA `accessibilityHint`: `"Triggers the iOS location permission prompt."` — the hint discloses what happens next so the user knows the system dialog is intentional, not unexpected.
- Secondary `accessibilityHint`: `"Skip the iOS prompt. Proceed to manually pick a place."`
- Reduced motion: no animation on enter; instant present.
- Contrast: body text sits in the upper half of the gradient (initiator), well clear of the bright yellow bottom. White 0.84 on coral mid ≈ 4.6:1 (passes AA body).

## Per-platform behavior

| Platform | Behavior |
|---|---|
| iOS (initiator first-launch, post-Apple-sign-in) | Render the surface. Both CTAs functional. |
| iOS (subsequent launches with permission already granted) | Skip the surface. Route directly from landing → S01. |
| iOS (subsequent launches with permission already denied) | Skip the surface. Route directly from landing → S01 (which mounts `LocationPicker` in `empty` state with the deny-state re-enable card available). |
| Web fallback (invitee) | Skip entirely. The web fallback never prompts for location; invitees use their initiator's room which already has a location set. |

## Out of scope

- The iOS implementation of `CLLocationManager.requestWhenInUseAuthorization`, the permission-state observer, and the routing logic between this surface and S01 — all owned by `tb-03`.
- The pre-Apple-sign-in version of this surface — pre-prime fires **after** Sign-in-with-Apple (per `sg-03`), not before. The Apple gate is the first interactive surface; this is the second.
- The "always" / "while-using" granularity — iOS gives us only `whenInUse`; "always" is not requested.
