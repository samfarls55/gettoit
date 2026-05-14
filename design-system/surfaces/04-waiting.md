---
surface: 04-waiting
status: locked
locked-date: 2026-05-12
jsx:
  - code/screens/ScreenWaiting.jsx
---

# S04 · Waiting / Coordination

> **Code:** [`../code/screens/ScreenWaiting.jsx`](../code/screens/ScreenWaiting.jsx)

The user has finished the quiz; not everyone has. Honest, calm, no anxiety.

## What this surface defends against

- **Anxiety motion.** No spinners. No pulsing dots. No "waiting…" with animated ellipsis. The avatar row + headline are the entire signal.
- **Coercion of late answerers.** Nudge is opt-in (user must tap) and rate-limited (1 per 2min per session). The surface does NOT say "Sam is holding up the group."
- **Algorithm framing.** Verdict is described as "what surfaces when everyone's in" — never "what we compute / recommend."

## Components used

`GradientSurface` (waiting) · `GTIMark` · `Eyebrow` · display headline (`N of M` / `ARE IN`) · `AvatarDot` × N · `PillCTA` ghost (Nudge) · `PillCTA` ghost (Decide now, initiator-only) · mono-tag countdown · `AuthUpgradeChip` (C-22, iOS-only).

## Copy register

- **`"3 of 4 are in"`** — N-of-M ratio. Never percentages. "75%" frames as an algorithm output.
- **`"Sam is still answering"`** — present continuous. Not "Sam hasn't answered" (accusatory).
- **`"no spinners, promise."`** — a meta-commitment. End-of-workday users are fatigued; this surface promises not to perform urgency.
- **`"Decide now · 3 of 4 in"`** — label exposes the partial-quorum cost. Not `"Skip waiting"` (dismissive) or `"Force verdict"` (algorithm framing).
- **`"Auto-fires in 7:42"`** — the timer is what counts down, not the group's patience.

## Verdict fire trigger

The verdict computes the moment **either** condition holds:

1. Every member of the room has submitted answers — the canonical "everyone's in" path, OR
2. The room's timer elapses (initiator-set, see [[01-initiator|S01]]). Minimum 2 answers required (initiator + 1). Below that, the room flips to an expired state instead of firing, OR
3. The **initiator** taps the `"Decide now"` CTA on this surface. Disabled until ≥2 members have answered. Fires the verdict for whoever has answered so far.

Conditions 2 and 3 are the new v1 escape hatches that keep a slow answerer from holding the room indefinitely. Both are owned by the initiator.

### `"Decide now"` CTA (initiator-only)

| Property | Value |
|---|---|
| Component | `C-05` Pill CTA, `ghost` variant |
| Visibility | Initiator only (current user === room's initiator). Invitees never see this control. |
| Disabled until | `answered.length >= 2` (initiator + 1 invitee) |
| Disabled style | opacity 0.45, not-allowed cursor; label remains visible so the initiator sees the threshold |
| Label (disabled) | `"Decide now · need 2 in"` |
| Label (enabled) | `"Decide now · {N} of {M} in"` |
| Confirmation | none — the cost is on the initiator's own tap; a confirm step would undermine the speed promise |
| Position | below the avatar row, above the Nudge CTA in the dock |

### Countdown timer (all members)

| Property | Value |
|---|---|
| Type | mono-tag (`tokens.md §2 → mono-tag`) — IBM Plex Mono 11 / tracking 0.18em / UPPERCASE |
| Color | `rgba(255,255,255,0.6)` (tertiary on-gradient) — low-emphasis on purpose |
| Position | bottom of content, above the CTA dock |
| Format | `"AUTO-FIRES IN 7:42"` — single digit minutes OK (`"AUTO-FIRES IN 0:42"`) |
| Tick cadence | every second. Initiator is watching this to decide when to tap; coarse minutes would lose the read. |
| Reduced motion | replace the live tick with a coarse `"under {N} min"` update once per minute. |
| Visibility | all members see it; identical render. |

## Behavior

- Live updates: when `answered` flips, animate `all 320ms ease-out` (color, ring, check appears).
- Nudge → push to Sam's device: `"Maya, Alex + 2 are waiting on you."` Cap: 1 per 2min.
- The `"Decide now"` CTA writes `rooms.fire_trigger = 'manual'` and immediately advances the room to verdict computation for the subset that has answered.
- Timer expiry with ≥2 answers writes `rooms.fire_trigger = 'timer'` and advances the same way.
- Timer expiry with <2 answers writes `rooms.status = 'expired'` and flips the surface to the no-quorum terminal (see edge cases).

### Auth-upgrade chip (all members, iOS-only)

This is the surface where the Sign-in-with-Apple upgrade lives. Per [[../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]], the chip is **non-blocking**, **voluntary warm-friend register**, and **iOS-only** — the web fallback ([[02-invite|S02]], TB-15) renders S04 without it.

| Property | Value |
|---|---|
| Component | `C-22` Auth Upgrade Chip |
| Visibility | All members on iOS. Hidden when (a) user is already Apple-linked, (b) user dismissed within the last 30 days (`user_preferences.auth_prompt_dismissed_at` within 30d), or (c) render context is the web fallback. |
| Position | In the CTA dock, **above** the initiator-only `"Decide now"` CTA and **above** the `"Nudge"` CTA. Below the avatar row + headline. Secondary to the primary "N of M are in" state — never competing for the eye. |
| Primary copy | `"Save this taste profile"` — LOCKED. Never `"Sign up"` / `"Create account"` / `"Confirm"` / `"Sign in with Apple"`. |
| Dismiss copy | `"Maybe later"` — LOCKED. Never `"No thanks"` / `"Skip"` / `"X"`. |
| On tap → success | Chip replaces itself with a quiet `"Saved."` mono-tag confirmation, white 0.6, fade 320ms. No celebration motion. |
| On tap → dismiss | Write `user_preferences.auth_prompt_dismissed_at = now()`. Chip vanishes for 30 days. The avatar row + headline carry the surface alone. |
| On tap → cancel/error | No state change. Chip returns to the `default` state; user can retry or dismiss. |

The chip exists for the post-quiz upgrade moment ADR 0007 ratified — the user has just demonstrated effort (5 quiz answers); the affordance to save it converts at this moment but pre-quiz prompts default-deny. The chip is intentionally the **only** persistent identity surface in v1; reinstall = new anonymous identity unless the user took this tap.

## Edge cases

- **Quorum met (≥2 answered, <100%).** Verdict computes for the subset that answered. Non-answerers appear in `pending` style on the verdict screen as a non-shaming "didn't answer" tag.
- **Timer expires with only the initiator answered (no quorum).** Room enters `expired` status. Surface flips to a terminal mode with copy `"Couldn't reach quorum tonight"` + body `"Only you answered before the timer ran out. Start a new round?"` + primary CTA `"Start over"` (white pill). The initiator returns to S01 with the prior timer + radius pre-populated.
- **Late answerer submits during verdict computation.** Their answer is honored if it lands before the engine commits the verdict (race-free via DB transaction). After commit, they fall into the late-joiner read-only path (see [[05-verdict|S05]] §read-only).
