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
| Web fallback ([[02-invite|S02 web]] invite link) | **Anonymous-by-default**, unchanged from v1 per ADR 0007 §"Web fallback voters stay anonymous indefinitely". The web-fallback voter never sees S00a. On the [[04-waiting|S04 Waiting]] surface they see the "Download the app" CTA (sg-03) which routes to the App Store. On a subsequent iOS install they hit S00a like any other first launch — where the sg-WF-8 `"Voted on the web?"` affordance (see §below) lets them carry their browser vote across via a [[../../CONTEXT|Claim code]] minted from the web `"Getting the app?"` affordance ([[web-01-invitee-shell|web-01]] §C). |

This asymmetry is intentional. The web fallback's whole job is to keep the two-tap invitee promise alive for non-installers; gating it would break the invite loop. The iOS gate is acceptable because (a) the user has already chosen to install, and (b) Apple permits a single-button Sign-in-with-Apple gate per HIG (see [[../components#c-22-auth-upgrade-chip|C-22 §"Why not the system SignInWithAppleButton"]] — the same custom-pill argument applies here).

## Interaction with C-22 Auth Upgrade Chip

The C-22 chip on S04 Waiting was designed for the v1 anonymous-default world. After this PR lands:

- **iOS:** every member who reaches S04 is already Apple-linked (they cleared S00a). C-22 renders `hidden` per its existing `hidden`-state trigger (`isAnonymous === false`). No visual change to S04 on iOS beyond what's already there.
- **Web fallback:** C-22 already renders `hidden` per ADR 0007 (no Sign in with Apple in browser). The new "Download the app" CTA (see [[04-waiting|S04 §"Download the app" CTA]]) occupies the same dock slot.

C-22 stays in the spec — it's the correct fallback if any future surface ever needs to re-prompt mid-session — but its day-one consumer on iOS goes silent. No deletion in this PR.

## "Voted on the web?" account-claim affordance

> **Spec amendment — sg-WF-8.** Added 2026-05-21. Architecture: [[../../gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]]; grilled decisions: [[../../gti-vault/50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]]. This section specs the visual / copy / motion layer; the redeem wiring (the `redeem-claim-code` edge function, the keychain install, the `linkApple` dispatch) is owned by tb-WF-14.

A [[../../CONTEXT|Web invitee]] who voted in the browser and then installs the iOS app gets a **fresh, disjoint Apple `user_id`** the moment they tap Sign in with Apple — the browser vote strands ([[../../gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] §Context). The fix is **transport, before the Apple tap**: the web fallback mints a [[../../CONTEXT|Claim code]] that carries the browser's anonymous session; S00a collects it, installs it into the keychain, and the Apple tap then becomes `linkApple` (the legacy-anonymous row in the Two-launch boundary table above) instead of `signInWithApple`. The ordering — code first, Apple second — is exactly why the affordance lives **on S00a**: putting both on one screen makes the only correct order the default order ([[../../gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] §Why).

### Default state — the quiet secondary entry

Beneath the Sign-in-with-Apple pill, in the CTA dock, sits a **secondary text affordance** labelled `"Voted on the web?"`. It is deliberately **quiet and secondary** — the `eyebrow`-token text-link treatment (Inter 700 / 11 / tracking 0.18em / UPPERCASE, white 0.6, 44pt-tall hit row, centered), the same low-key treatment S00b's `"Pick a place manually"` and S01's `"SETTINGS"` link use. It never competes with the white pill for the eye.

The common fresh-install user — who was **never on the web** — reads `"Voted on the web?"`, answers "no" in their head, and **ignores it without friction**. It costs them nothing: no field, no extra screen, no decision. The affordance only matters to the small population of Web invitees converting to an app install, and for them it is the entire bridge.

### Revealed state — code entry

Tapping `"Voted on the web?"` reveals the **code-entry state** inline, in place of (or expanding within) the dock — it is not a separate route. The revealed state adds three elements:

| Element | Spec |
|---|---|
| Teaching copy | A short line above the field — see §"Copy register" below. TTL-honest framing. |
| Claim-code input | A **single** soft-glass text field — full-column width, height 56, radius `var(--r-row)` (12), `--glass-fill-soft` background, `1px var(--glass-stroke)` border, `backdrop-filter: blur(12px)`. Focus border → `var(--sun)`, 140ms `var(--ease-out)`. Text Inter 600 / 16, white (`--paper`); placeholder white 0.6 (`--text-tertiary`), literal `Enter your code`. `autocapitalize="characters"`, `autocomplete="off"`, `autocorrect="off"` — a claim code is an opaque token, not a word. This is the **same soft-glass input pattern** the web-01 §A name input and the C-23 LocationPicker typeahead already use — **not a new component**. |
| Submit CTA | `PillCTA` `white` variant, label `"Bring my Plans over"`, full-column width, disabled until the trimmed input is non-empty (the existing `PillCTA` disabled treatment — opacity 0.45 — and no separate inline validation message, matching the design system's "disabled CTA, no error copy" posture). |

A bad / expired / mistyped code surfaces a **non-blocking inline error line** below the field — `"That code didn't work. Generate a fresh one from your web link."` (Inter 600 / 13 / white 0.7) — the same inline-error treatment the Apple-flow error uses. The user re-types or goes back to the web link for a new code; failure is **visible and recoverable** ([[../../gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] §Why #4).

### Copy register

- **`"Voted on the web?"`** — the secondary affordance label. Question-form, warm-friend register; it asks the user to self-identify rather than announcing a feature. NEVER `"Restore account"`, NEVER `"Have a code?"` (procedural), NEVER `"Import data"` (transactional).
- **Teaching copy (revealed state).** Above the field: `"Bring back your recent web Plans. Open any link you voted on, tap “Getting the app?”, and enter the code here."` Inter 600 / 14 / white 0.84 / max-width 300. This does two jobs: it tells a user who **does not yet have a code** how to generate one (open a prior web link → the `"Getting the app?"` mint affordance), and it is **honest about the ~30-day ceiling**. Per [[../../gti-vault/60_engineering/adr/0006-privacy-posture-v1|ADR 0006]], anonymous identities are purged after 30 days — older web Plans are gone and their links land on the web `"This plan is closed"` terminal with nothing to mint. The copy says **"your recent web Plans"**, never "all your history" / "everything you voted on" / "recover your account" — it must not promise recovery the 30-day TTL cannot deliver.
- **`"Bring my Plans over"`** — the code-entry CTA label. Voluntary verb, plain noun; the `cta` token uppercases it at render. NEVER `"Redeem"`, NEVER `"Submit"`, NEVER `"Restore"`, NEVER `"Link account"`.
- **Inline error `"That code didn't work. Generate a fresh one from your web link."`** — names the failure and the fix in one breath. NEVER `"Invalid code"` (system register), NEVER `"Error"`.

### Behavior (visual only — wiring owned by tb-WF-14)

1. Default render: the dock shows the Sign-in-with-Apple pill + the `"Voted on the web?"` text link beneath it. The code-entry state is collapsed.
2. Tap `"Voted on the web?"`: the code-entry state reveals — teaching copy + field + submit CTA fade in; the field autofocuses so the keyboard rises. The `"Voted on the web?"` link itself is consumed by the reveal (it does not persist beside the open field).
3. Tap `"Bring my Plans over"` with a valid code: redeem succeeds, the anonymous session installs into the keychain, S00a re-renders into its `.anonymous` state — and the Sign-in-with-Apple pill's tap is now `linkApple`, exactly the legacy-anonymous row already in the Two-launch boundary table. The user has **not** signed in yet; they still must tap the Apple pill.
4. Tap with a bad / expired code: the inline error line appears; the field stays open for a retry. No state change, no route change.
5. A force-quit after a successful redeem is safe — the keychain keeps the anonymous session, and the next launch routes straight through `linkApple` ([[../../gti-vault/50_product/workflow-overhaul-web-invitee-account-claim|decision doc §Q6]]).

The claim is **before-sign-in only**. There is no in-app, post-sign-in claim entry — a user who taps Sign in with Apple without claiming first strands their web data (recoverable only by delete-and-reinstall within the 30-day window). This is not new harm; it is exactly the pre-amendment ADR 0007 behavior. After-sign-in recovery is deferred to a future feature ([[../../gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] §Re-evaluation triggers).

### No new component, no new token

The whole affordance is composition: the `eyebrow`-token text link is the S00b / S01 precedent; the claim-code field is the existing soft-glass input pattern (web-01 §A name input, C-23 typeahead); the submit CTA is the existing `PillCTA white`; every color resolves to a registered token (`--glass-fill-soft`, `--glass-stroke`, `--sun`, `--paper`, `--text-tertiary`, white-alpha text roles); the radius is `var(--r-row)`. **No new component, no new token.** If a future need cannot be met from this set, that is a spec gap to flag — not an inline literal.

## Components used

`GradientSurface` (initiator stop — visual continuity into S01 if the user proceeds) · `GTIMark` · `Eyebrow` · display headline (one word per line, like S01) · body sub-copy · single `PillCTA` `white` variant with Apple-glyph prefix (the same primitive C-22's `default` state uses) · the `"Voted on the web?"` `eyebrow`-token text link · the revealed account-claim soft-glass code input + its `PillCTA white` submit CTA.

**No new components.** The Apple-prefixed pill is the existing `PillCTA white` + the prefix slot the component already exposes; the C-22 default-state render is the visual precedent. We do not import C-22 directly because S00a has no dismiss path and no `success` / `in-progress` / `dismissed` states — the surface owns its own copy, and the post-tap result is a route change, not a state change. The account-claim affordance (see §"Voted on the web?" above) is likewise pure composition of existing primitives — no new component, no new token.

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

Code-entry reveal: tapping `"Voted on the web?"` fades the teaching copy + field + submit CTA in via `gti-fade-up` 320ms `var(--ease-out-soft)`; the field autofocuses after the entrance settles. No layout jump above the dock — the headline block does not move.

Exit on success: full-surface fade-out 240ms `var(--ease-out)` overlapping with the S01 mount — no gradient tween (same stop).

Reduced motion: skip the stagger; render all elements at full opacity immediately. The code-entry reveal collapses to an instant show (no `gti-fade-up`) — consistent with the rest of the design system's reduced-motion posture.

## Accessibility

- **Pill tap target:** 60-tall, clears HIG 44pt natively.
- **Apple glyph:** `aria-hidden="true"` — decorative; the pill label carries the full meaning.
- **VoiceOver order (default state):** GTIMark (decorative, skipped) → eyebrow ("Tonight's session") → headline ("Pick up where you left off") → body sub → pill ("Save my taste profile, button") → `"Voted on the web?"` text link (button).
- **VoiceOver order (code-entry revealed):** the focus moves to the teaching copy → claim-code field ("Enter your code, text field") → submit CTA ("Bring my Plans over, button"). On reveal, VoiceOver focus is programmatically moved to the teaching copy so the change is announced.
- **`"Voted on the web?"` tap target:** 44pt-tall hit row, clears HIG 44pt.
- **Claim-code field:** the field carries an `aria-label` ("Claim code") since the placeholder is not a substitute for a label; the inline error line uses `role="alert"` so a failed redeem is announced (same treatment as the Apple-flow error line).
- **Dynamic Type:** headline scales per the `display-l` token; if the user's chosen size pushes the headline past four lines, truncate at the renderer level (the copy is one phrase, the line-break is presentational). The teaching copy + claim-code field scale with Dynamic Type and reflow within the column.
- **Reduced motion:** see §Motion above.
- **Color contrast:** white text on the initiator gradient passes WCAG AA (see [[../accessibility|accessibility.md]] §"Contrast tables" — the initiator stop is the test case for that table). The claim-code field's white text on the `--glass-fill-soft` surface over the initiator gradient inherits the same AA-passing contrast as the existing soft-glass inputs (C-23, web-01 §A).

## Out of scope

- **Email / password fallback.** Not in v1; not in v1.1. The "Apple-only" decision lives in ADR 0007 §"What is and isn't supported."
- **Google / other social.** Same — single-provider matrix per ADR 0007.
- **Pre-sign-in walkthrough / value-prop screens.** The surface is the walkthrough. Adding screens before it would re-open the onboarding cliff this surface defends against.
- **Account-recovery / forgot-Apple-ID path.** Apple owns this; the system Apple sheet handles it. The app does not render any custom recovery affordance.
- **The claim-code redeem wiring.** The `redeem-claim-code` edge function, the keychain install of the redeemed anonymous session, and the `linkApple` dispatch are owned by **tb-WF-14** — this doc specs only the surface. The web side that *mints* the code (the `"Getting the app?"` affordance on the web Waiting screen + read-only verdict card) is spec'd in [[web-01-invitee-shell|web-01]] §"Getting the app?" and wired by tb-WF-13.
- **After-sign-in account claim.** Once a Linked-Apple session exists there is no in-app claim path; recovery is delete-and-reinstall (back to a fresh S00a) within the 30-day TTL. The empty-Apple-account and populated-Apple-account after-sign-in variants are deferred to a future feature ([[../../gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] §Considered options 4).
