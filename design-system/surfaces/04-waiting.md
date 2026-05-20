---
surface: 04-waiting
status: locked
locked-date: 2026-05-12
partially-superseded-by:
  - gti-vault/10_prds/v1.1-quiz-redesign-prd.md
stale-sections:
  - "Countdown timer (all members)"
  - "Verdict fire trigger (timer-elapse branch)"
  - "Timer expiry no-quorum edge case"
  - 'Copy: "Auto-fires in 7:42"'
jsx:
  - code/screens/ScreenWaiting.jsx
---

# S04 · Waiting / Coordination

> **PARTIALLY SUPERSEDED — v1.1 quiz redesign PRD (2026-05-15).** The countdown timer, the `"Auto-fires in 7:42"` mono-tag, the timer-elapse fire branch, and the `rooms.deadline_at` / cron-auto-fire mechanism described below are RETIRED. The v1.1 PRD removed the session timer entirely (US34, US35, §line 115). The verdict trigger is now exactly two paths: **(a) all participants have submitted Q5**, or **(b) initiator manually closes voting** (the existing "Decide now" CTA survives, but may be relabelled). Do **not** implement timer-elapse mechanics from this doc. The canonical trigger is in `CONTEXT.md → Verdict trigger`.

> **Code:** [`../code/screens/ScreenWaiting.jsx`](../code/screens/ScreenWaiting.jsx)

The user has finished the quiz; not everyone has. Honest, calm, no anxiety.

## What this surface defends against

- **Anxiety motion.** No spinners. No pulsing dots. No "waiting…" with animated ellipsis. The avatar row + headline are the entire signal.
- **Coercion of late answerers.** Nudge is opt-in (user must tap) and rate-limited (1 per 2min per session). The surface does NOT say "Sam is holding up the group."
- **Algorithm framing.** Verdict is described as "what surfaces when everyone's in" — never "what we compute / recommend."

## Components used

`GradientSurface` (waiting) · `GTIMark` · `Eyebrow` · display headline (`N of M` / `ARE IN`) · `AvatarDot` × N · `PillCTA` ghost (Nudge) · `PillCTA` ghost (Decide now, initiator-only) · `PillCTA` white (`"Download the app"`, web-anonymous-only) · mono-tag countdown · `AuthUpgradeChip` (C-22, iOS-only).

## Copy register

- **`"3 of 4 are in"`** — N-of-M ratio. Never percentages. "75%" frames as an algorithm output.
- **`"Sam is still answering"`** — present continuous. Not "Sam hasn't answered" (accusatory).
- **`"no spinners, promise."`** — a meta-commitment. End-of-workday users are fatigued; this surface promises not to perform urgency.
- **`"Decide now · 3 of 4 in"`** — label exposes the partial-quorum cost. Not `"Skip waiting"` (dismissive) or `"Force verdict"` (algorithm framing).
- **`"Auto-fires in 7:42"`** — the timer is what counts down, not the group's patience.
- **`"Download the app"`** (web-only, anonymous-only — see §"Download the app" CTA below) — voluntary verb, plain noun. The web fallback's primary post-quiz CTA, surfacing the only path the user has to a persistent identity. NEVER `"Get the app"` (sales register), NEVER `"Install GetToIt"` (transactional), NEVER `"Continue in app"` (implies a continuation that doesn't exist — installing creates a fresh anonymous identity per ADR 0007 unless they later complete S00a).

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

### "Download the app" CTA (web fallback, anonymous-only)

Added in v1.1 (sg-03). The web fallback ([[02-invite|S02 web]]) carries anonymous voters who answered the quiz in the browser. Once they reach S04, they have demonstrated effort but have no path to persistent identity — C-22 is hidden on web per ADR 0007 (no Sign in with Apple in browser). The "Download the app" CTA replaces it.

| Property | Value |
|---|---|
| Component | `C-05` Pill CTA, `white` variant |
| Visibility | Web fallback only AND user is anonymous. On iOS the CTA renders `hidden` (the user is already in the app; downloading it again is meaningless). On web for a returning user who later linked their identity, the CTA renders `hidden` (same hidden-state semantics as C-22 — once a real identity exists, the upgrade affordance disappears). |
| Position | In the CTA dock, **above** the `"Nudge"` CTA. On web there is no `"Decide now"` CTA (only the initiator who used the iOS app sees that) and no C-22 chip, so this CTA is the dock's primary affordance. |
| Label | `"Download the app"` — LOCKED. Sentence-case in source; the `cta` token renders it UPPERCASE. NEVER `"Get the app"`, NEVER `"Install GetToIt"`, NEVER `"Continue in app"`. |
| Apple-glyph prefix | None. This is a download CTA, not a sign-in CTA. A glyph would imply Apple-authored content; the user is downloading an iOS app from a third-party store. The pill is type-only. |
| On tap | Opens the iOS App Store URL (`itms-apps://itunes.apple.com/app/<id>` on iOS Safari, `https://apps.apple.com/app/<id>` elsewhere) in a new tab / system handler. The web page itself does not advance — the user remains on S04, the verdict still computes for the room they're in, and their vote still counts. |
| Subscript line | Below the pill, `eyebrow` token treatment, white 0.6 — `"Then your votes save with you."` Single line of value framing; spells out that installing isn't just for future sessions, it makes the current session's contribution survive. |

#### iOS / web cross-cut

| Render context | C-22 chip | "Download the app" CTA |
|---|---|---|
| iOS, anonymous (legacy v1 install pre-S00a, or post-delete fresh anon) | renders `default` | hidden |
| iOS, Apple-linked (post-S00a, the v1.1 norm) | hidden | hidden |
| Web fallback, anonymous (the canonical web path) | hidden (per ADR 0007 — no SiwA on web) | renders |
| Web fallback, Apple-linked (returning user) | hidden | hidden |

Exactly one of the two affordances ever renders in a given context; the dock never carries both. This is enforced by the `platform` prop on `ScreenWaiting` (`"ios"` vs `"web"`) plus the `isAnonymous` prop.

#### Behavior

- Tap writes a telemetry event (`waiting_download_cta_tapped` per [[../../gti-vault/60_engineering/adr/0005-telemetry-supabase-event-store|ADR 0005]] event-store conventions) before opening the store URL — gives us conversion measurement.
- On a subsequent iOS install the user hits [[00a-signin|S00a]] like any other first launch. Their web-fallback room state does NOT auto-rehydrate into the new install — per ADR 0007 §"Negative / accepted tradeoffs", web-to-iOS identity merge is a future feature, not v1.1 scope. The CTA copy ("Then your votes save with you") promises only forward-going behavior, not retroactive merge.
- No countdown coupling. The pill does not change label or state as the timer ticks down. If the room expires while the user is mid-install, they re-open the link to find the verdict (the deep link routes them to the verdict surface as a late-joiner per [[05-verdict|S05 §read-only]]).

## Edge cases

- **Quorum met (≥2 answered, <100%).** Verdict computes for the subset that answered. Non-answerers appear in `pending` style on the verdict screen as a non-shaming "didn't answer" tag.
- **Timer expires with only the initiator answered (no quorum).** Room enters `expired` status. Surface flips to a terminal mode with copy `"Couldn't reach quorum tonight"` + body `"Only you answered before the timer ran out. Start a new round?"` + primary CTA `"Start over"` (white pill). The initiator returns to S01 with the prior timer + radius pre-populated.
- **Late answerer submits during verdict computation.** Their answer is honored if it lands before the engine commits the verdict (race-free via DB transaction). After commit, they fall into the late-joiner read-only path (see [[05-verdict|S05]] §read-only).
