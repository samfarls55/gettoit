---
surface: 01-initiator
status: superseded
locked-date: 2026-05-12
superseded-date: 2026-05-19
superseded-by: 01-setup
jsx:
  - code/screens/ScreenInitiator.jsx
---

# S01 · Initiator Landing

> **SUPERSEDED (2026-05-19) — replaced by [[01-setup|S01 Plan setup]].** The workflow-overhaul phase collapsed this surface + [[01b-parameters|S01b Pre-quiz parameters]] into a single Plan setup screen ([[../../gti-vault/15_issues/0.1.0/issues/sg-wf-1-plan-setup-surface|sg-WF-1]] / #154). This file and `code/screens/ScreenInitiator.jsx` remain in the tree until the paired iOS tracer-bullet **tb-WF-4** retires the consuming Swift code; do **not** build new features against this surface. The Plan-list-as-landing decision also retires the standalone "initiator landing" pattern — there is no longer an entry surface that asks the user to "Pick a vertical". See [[../../gti-vault/50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] for the locked decisions.

> **Earlier note (2026-05-15) — partially superseded by 0.1.0 quiz redesign PRD.** The Timer chip group, the "How long" eyebrow, the `timer_minutes` column write, and any "Auto-fires" behavior described below were already RETIRED by US34 / US35 / §line 115 of the 0.1.0 PRD. The 2026-05-19 supersession above carries that retirement forward and additionally drops the radius slider, the vertical picker rows, and the SETTINGS footer link (subsumed by the new Setup surface + Plan list landing).

> **Code:** [`../code/screens/ScreenInitiator.jsx`](../code/screens/ScreenInitiator.jsx)

The user picks a vertical and generates a share link for the group. One choice → invite.

## What this surface defends against

- **Pre-commitment paralysis.** No "configure your session." No "name your night." No optional fields *that the zero-tap path needs to fill in*.
- **Algorithm framing.** No mention of AI, suggestions, smart anything. The app is plumbing.
- **Group-size friction.** Size is inferred from who accepts the invite, not set up front.

## Components used

`GradientSurface` (initiator) · `GTIMark` · `Eyebrow` · display headline · LocationPicker chip (C-23) · timer chip group (C-04 variant) · radius slider (C-21) · vertical picker rows (C-19) · `PillCTA` white.

## Timer + radius controls (spec exception)

The 0.1.0 PRD ([[../../gti-vault/10_prds/0.1.0-prd|0.1.0-prd.md]]) locks the verdict fire trigger to **initiator-set timer OR initiator manual "Decide now" tap** (see S04), and the candidate pool radius to **initiator-set slider**. Both controls live on this surface because the decision is made before the share-sheet step — the invitees never see them.

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

## Persistent location selector — `C-23 LocationPicker`

The persistent location selector lives **above** the timer + radius controls, immediately below the headline + body block. It is the first concrete fact the user states about their session — *where*. Timer (*how long*) and radius (*how far*) follow because they're parameters of the where.

The full visual + behavioral spec is in [[../components#c-23-locationpicker|`C-23 LocationPicker`]]. This section documents the surface-level placement and per-state behavior on S01.

### State table (per `C-23` states)

| State | When | Render on S01 |
|---|---|---|
| `loading` | First mount post-permission-grant, while `CLLocationManager` resolves the first fix (~2s) | Chip renders mono-tag `"LOCATING…"` with opacity pulse. CTA `"Drop the invite link"` is **enabled** anyway — the user can proceed and the location resolves in flight; if the resolve hasn't completed by tap time, the session writes a `null` location and the LocationPickerSheet auto-opens on S04 Waiting for them to set it manually. (Edge case; routine is sub-second on a warm location service.) |
| `auto` | Permission granted, GPS resolved | Chip shows GPS place name + sub-label `"YOUR LOCATION"` + sun-yellow paper-plane glyph. CTA enabled. |
| `manual` | User typed a place and committed it (either path) | Chip shows the manual value + sub-label `"YOUR LOCATION"`, no paper-plane glyph. CTA enabled. |
| `stale` | Permission granted but last GPS fix > 30 min ago | Chip shows last-known value + muted paper-plane glyph + sub-label `"OUT OF DATE — TAP TO REFRESH"`. CTA enabled. Tap-to-edit always re-opens the sheet, where the user can either re-tap "Use current location" to refresh or pick something else. |
| `empty` | Permission denied AND user has not yet selected | Chip shows placeholder `"Set your location"` + sub-label `"TAP TO SELECT"`. CTA **disabled** — the session can't fire without a location. The user is invited to tap the chip; the sheet renders with the deny-state re-enable card. |

### Layout

| Position | Element |
|---|---|
| 1 | `GTIMark` (top-left chrome) |
| 2 | `Tonight's session` eyebrow + `Figure it out together` headline + body line |
| 3 | **`LocationPickerChip` (C-23)** — full-width row, top-margin 28 |
| 4 | `How long` eyebrow + timer chip group (existing) |
| 5 | `How far` eyebrow + value mono-tag + radius slider (existing) |
| 6 | `Pick a vertical` eyebrow + vertical picker rows (existing) |
| 7 | `CTADock` — `Drop the invite link` primary, `SETTINGS` link |

### Behavior

- **First-launch route:** landing → sg-04 pre-prime ([[00b-location-permission|S00b]]) → iOS native prompt → S01 with the picker in `auto` / `empty` per the grant decision.
- **Subsequent-launch route:** landing → S01 directly. Picker mounts in whatever state the persisted session-state + current permission yield. The pre-prime is **not** re-shown.
- **Override at any time:** the chip is always tap-to-edit. The auto-populated value is a default, not a lock — the user can pick something else for tonight without changing the permission.
- **The persistent value writes to `rooms.location_*`** when the CTA fires (column names owned by `tb-03`).

## Settings footer link (spec exception)

A single mono-tag `"SETTINGS"` text button renders below the primary CTA in the `CTADock`. Tap routes the user to [[09-settings|S09 Settings]] — 0.1.0's account-management surface, which contains exactly one action (delete-my-data) per App Store guideline 5.1.1(v) + [[../../gti-vault/60_engineering/adr/0006-privacy-posture-0.1.0|ADR 0006]].

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

## 0.1.0 scope

Only `food` is selectable. Drinks/Movie render visibly as future plans (opacity 0.55, disabled) so users know more is coming, but aren't interactive.

## Behavior

CTA → generate session ID → write `rooms` row with the selected `timer_minutes` + `radius_meters` (default applied for un-touched controls) → copy link to clipboard → open the iOS share sheet. After share, the initiator transitions to their own Q1 (surface 03).
