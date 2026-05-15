---
surface: 00a-signin
status: locked
locked-date: 2026-05-14
jsx:
  - code/screens/ScreenSignIn.jsx
---

# S00a · Forced Sign-in Gate (iOS, first launch)

> **Code:** [`../code/screens/ScreenSignIn.jsx`](../code/screens/ScreenSignIn.jsx)

The first surface a fresh-install iOS user sees. A single Sign-in-with-Apple affordance gates the rest of the app. There is no skip, no "continue as guest," no email fallback — the user signs in with Apple, or the app does nothing for them.

This is the v1.1 closure of the iOS half of [[../../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]. The "anonymous default" half of that ADR survives **only** for invite-link arrivals on the web fallback ([[02-invite|S02 web]]); native iOS launches always pass through this gate.

## What this surface defends against

- **Anonymous-default carry-over.** v1 launched anonymous-by-default with a post-quiz upgrade chip ([[../components#c-22-auth-upgrade-chip|C-22]]). For v1.1, iOS launches must own a real identity from the first tap. The gate is what closes that.
- **Onboarding cliff.** Despite the gate, the surface itself is one tap. No fields, no form, no consent boilerplate body. The visual is the welcome; the button is the entire interaction.
- **Setup framing.** Copy register is the same warm-friend voice as C-22 — `"Save your taste profile"`, never `"Create account"` / `"Sign up"` / `"Get started"`. The user isn't doing setup; they're saying yes.
- **Algorithm framing.** No mention of accounts, profiles, databases, identifiers. The eyebrow names the destination (`"Tonight's session"`), not the auth machinery.

## Two-launch boundary

| Launch | Surface shown | Tap-time auth call |
|---|---|---|
| Fresh install (no Apple identity on file for the device) | S00a — this surface | `signInWithApple` (mint a new Linked-Apple session) |
| Subsequent launch (session restored from Keychain) | App routes straight to S01 — S00a is skipped | — |
| Sign-out / data delete via S09 | Next launch routes back through S00a | `signInWithApple` (post-delete reboot lands in `.anonymous` then re-routes through the gate; legacy-anon row covers the dispatch) |
| Re-install over an existing Apple identity | S00a renders, the user taps once, Apple's flow returns the prior identity, app routes to S01 with prior data intact | `signInWithApple` |
| **Legacy v1 anonymous session in Keychain** (pre-v1.1 TestFlight install carried over) | S00a — gate renders even though `Auth.currentSession != nil`, because the cached session is anonymous and the iOS post-v1.1 invariant ("every iOS session is Linked-Apple") is not yet satisfied | `linkApple` (upgrade the existing anonymous session — preserves `user_id` and every owned `rooms` / `votes` / `members` / `events` row per [[../../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] §"the userID before and after linkApple is the same") |

The boundary is enforced at the app router level — S00a is the launch destination iff the current session is missing OR anonymous. It is **not** part of the Sunset Pop ritual arc; the user passes through it once per install (or once after a delete, or once at the v1 → v1.1 upgrade) and never sees it again.

## iOS / web asymmetry

| Path | Identity model |
|---|---|
| iOS first launch | **Forced sign-in.** Surface S00a renders; user must complete the Apple flow before reaching S01. After this surface, no anonymous iOS sessions exist for the duration of the install. |
| Web fallback ([[02-invite|S02 web]] invite link) | **Anonymous-by-default**, unchanged from v1 per ADR 0007 §"Web fallback voters stay anonymous indefinitely". The web-fallback voter never sees S00a. On the [[04-waiting|S04 Waiting]] surface they see the new "Download the app" CTA (this PR's second surface change) which routes to the App Store; on a subsequent iOS install they hit S00a like any other first launch. |

This asymmetry is intentional. The web fallback's whole job is to keep the two-tap invitee promise alive for non-installers; gating it would break the invite loop. The iOS gate is acceptable because (a) the user has already chosen to install, and (b) Apple permits a single-button Sign-in-with-Apple gate per HIG (see [[../components#c-22-auth-upgrade-chip|C-22 §"Why not the system SignInWithAppleButton"]] — the same custom-pill argument applies here).

## Interaction with C-22 Auth Upgrade Chip

The C-22 chip on S04 Waiting was designed for the v1 anonymous-default world. After this PR lands:

- **iOS:** every member who reaches S04 is already Apple-linked (they cleared S00a). C-22 renders `hidden` per its existing `hidden`-state trigger (`isAnonymous === false`). No visual change to S04 on iOS beyond what's already there.
- **Web fallback:** C-22 already renders `hidden` per ADR 0007 (no Sign in with Apple in browser). The new "Download the app" CTA (see [[04-waiting|S04 §"Download the app" CTA]]) occupies the same dock slot.

C-22 stays in the spec — it's the correct fallback if any future surface ever needs to re-prompt mid-session — but its day-one consumer on iOS goes silent. No deletion in this PR.

## Components used

`GradientSurface` (initiator stop — visual continuity into S01 if the user proceeds) · `GTIMark` · `Eyebrow` · display headline (one word per line, like S01) · body sub-copy · single `PillCTA` `white` variant with Apple-glyph prefix (the same primitive C-22's `default` state uses).

**No new components.** The Apple-prefixed pill is the existing `PillCTA white` + the prefix slot the component already exposes; the C-22 default-state render is the visual precedent. We do not import C-22 directly because S00a has no dismiss path and no `success` / `in-progress` / `dismissed` states — the surface owns its own copy, and the post-tap result is a route change, not a state change.

## Gradient choice — initiator

Reuses the existing `initiator` gradient stop (`tokens.json` → `gradient.surfaces.initiator`). Two reasons:

1. **Visual continuity into S01.** Successful sign-in routes to S01 Initiator, which also renders on the `initiator` stop. The surface-to-surface transition is identity (no gradient tween), so the user experiences sign-in → landing as one continuous space — the gate is a moment in the arc, not a separate environment.
2. **Pre-existing.** `initiator` is already registered; no new gradient stop needed.

## Copy register

- **`"Tonight's session"`** — eyebrow. Reuses S01's eyebrow verbatim. The repeat is intentional: the user's mental model is "I'm about to start a decision," not "I'm about to set up an account."
- **`"Pick up where / you left off"`** — display headline, one word per line per the stacked-uppercase rule (`tokens.md §2`). Frames the action as continuity, not creation. A first-time user has nothing to pick up; the copy still reads as "you're the kind of person who picks up where they left off" — assumes the relationship, doesn't transact it.
- **Body sub:** `"Sign in once and your taste profile saves itself."` — Inter 600 / 14 / white 0.84 / max-width 300. Names the value (taste profile saves) and the cost (once). Plain English; no "Apple ID," no "account," no "secure."
- **`"Save my taste profile"`** — CTA label. Reuses the C-22 register one-for-one with a tense shift (`Save my` vs C-22's `Save this`). The `cta` token uppercases this to `SAVE MY TASTE PROFILE` at render time. NEVER `"Sign in with Apple"`, `"Continue with Apple"`, `"Create account"`, `"Get started"`. Locked.

The Apple glyph (`` PUA codepoint, SF Pro rendering on iOS — same as C-22's `default` state) renders before the label with a 10px gap.

## Behavior

1. **Mount:** app router lands on S00a iff the auth coordinator is in `.idle` (no cached session) OR `.anonymous` (legacy v1 anonymous session in Keychain — see Two-launch boundary row above). Otherwise router goes straight to S01.
2. **CTA tap:** trigger `ASAuthorizationAppleIDProvider().createRequest()` flow. The system Apple sheet renders on top of S00a. Pill renders `disabled` (opacity 0.45, same as C-22 `in-progress`) while the sheet is presented. The screen captures the coordinator's state at tap time and dispatches accordingly — `.idle` → `signInWithApple`, `.anonymous` → `linkApple`. Both methods take the same Apple credential shape; only the dispatch differs.
3. **Apple flow success:** `signInWithIdToken` → Supabase row created (new install) or matched (re-install, same Apple identity), OR `linkIdentityWithIdToken` → Apple identity attached to the existing anonymous `user_id` (legacy-anon path; merge invariant: `user_id` before == `user_id` after). Route to S01.
4. **Apple flow user-cancel:** sheet dismisses; pill returns to `default`. Surface does not advance. No error toast (cancel is a valid user choice, not a failure).
5. **Apple flow error (network, rejection, etc.):** sheet dismisses; pill returns to `default`. Surface presents a non-blocking inline error line below the body sub: `"Couldn't reach Apple. Try again."` (Inter 600 / 13 / white 0.7). User taps the pill again to retry.

The pill is the only interactive element. There is no "Skip," no "Maybe later," no footer link, no settings link. The surface is binary: complete the Apple flow, or remain here.

## Motion

Mount enter:
- Gradient surface is already painted (matches S01 stop) — no gradient tween on launch.
- `GTIMark` + eyebrow + headline fade-up via `gti-fade-up` 480ms `var(--ease-out-soft)` with a 60ms stagger between the three. Same primitive S01 uses.
- Body sub + pill fade in together at +400ms after the headline.

Pill press: same `scale(0.98)` 140ms `var(--ease-out)` as every other `PillCTA`.

Exit on success: full-surface fade-out 240ms `var(--ease-out)` overlapping with the S01 mount — no gradient tween (same stop).

Reduced motion: skip the stagger; render all elements at full opacity immediately.

## Accessibility

- **Pill tap target:** 60-tall, clears HIG 44pt natively.
- **Apple glyph:** `aria-hidden="true"` — decorative; the pill label carries the full meaning.
- **VoiceOver order:** GTIMark (decorative, skipped) → eyebrow ("Tonight's session") → headline ("Pick up where you left off") → body sub → pill ("Save my taste profile, button").
- **Dynamic Type:** headline scales per the `display-l` token; if the user's chosen size pushes the headline past four lines, truncate at the renderer level (the copy is one phrase, the line-break is presentational).
- **Reduced motion:** see §Motion above.
- **Color contrast:** white text on the initiator gradient passes WCAG AA (see [[../accessibility|accessibility.md]] §"Contrast tables" — the initiator stop is the test case for that table).

## Out of scope

- **Email / password fallback.** Not in v1; not in v1.1. The "Apple-only" decision lives in ADR 0007 §"What is and isn't supported."
- **Google / other social.** Same — single-provider matrix per ADR 0007.
- **Pre-sign-in walkthrough / value-prop screens.** The surface is the walkthrough. Adding screens before it would re-open the onboarding cliff this surface defends against.
- **Account-recovery / forgot-Apple-ID path.** Apple owns this; the system Apple sheet handles it. The app does not render any custom recovery affordance.
