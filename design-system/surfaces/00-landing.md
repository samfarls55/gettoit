---
surface: 00-landing
status: locked
locked-date: 2026-05-14
jsx:
  - code/screens/ScreenLanding.jsx
---

# S00 · Landing

> **Code:** [`../code/screens/ScreenLanding.jsx`](../code/screens/ScreenLanding.jsx)

The post-sign-in entry surface. Renders on every app launch after the forced first-launch Apple sign-in gate (see [[sg-03-account-creation-surfaces|sg-03]]) and on every subsequent launch with an existing session. Two affordances:

- **Start a Decision** — routes into [[01-initiator|S01 Initiator]] ("Pick a Vertical" → existing food flow).
- **Account Settings** — routes into [[09-settings|S09 Settings]] (the v1 delete-your-data surface).

This surface is the structural introduction of the landing page in v1.1. **Visual / brand design is deferred** — a polish ticket lands separately in the pre-public-launch milestone. The skeleton ships now so the routing + tap targets are real; the typography, gradient choice, and any lockup beyond the existing `GTIMark` can change without re-spec'ing the structure.

## What this surface defends against

- **Dropping users into a half-loaded session.** Before v1.1 the app launched directly into S01, which presents timer + radius + vertical-picker controls. A returning user opening the app to check settings, or just to see if anyone responded to a prior invite, has no path that doesn't pre-stage a new session. The landing surface provides a neutral entry point.
- **Settings-discoverability creep.** S01 already carries a `"SETTINGS"` footer link as a spec exception against "no chrome above the headline" — App Store guideline 5.1.1(v) requires the delete affordance to be "easily discoverable." With the landing surface in place, the settings route promotes to a first-class CTA on the entry screen, which strengthens the 5.1.1(v) discoverability story (one tap to settings from cold start, was two). The S01 footer link can remain or be removed in a follow-up; this surface does not mandate either direction.
- **Pre-commitment paralysis (cont'd).** The S01 defense against "configure your session" still applies once the user taps Start a Decision; this surface is upstream of that and contains no fields or controls of its own.

## Components used

`GradientSurface` (initiator stop) · `GTIMark` · `Eyebrow` · display headline · `PillCTA` white (Start a Decision) · `PillCTA` ghost (Account Settings).

No new components. No new tokens. All copy + layout sit within the existing C-05 Primary Pill CTA spec — the ghost variant is documented in `components.md §C-05` and already in use elsewhere (e.g. "Open in app", "Nudge Sam").

## Gradient choice — initiator

Reuses the existing `initiator` gradient stop (`tokens.json` → `gradient.surfaces.initiator`). The landing surface is the user's first interaction post-sign-in; the warm yellow-to-coral wash that opens the Sunset Pop ritual arc is the right frame for "this is where the decision starts." When the user taps Start a Decision, S01 inherits the same stop — the gradient does not need to retransition, which keeps the entry-to-S01 motion as quiet as possible. Account Settings will cross-fade to the registered `midnight` stop on tap (S09's gradient).

## Copy register

- **`"Welcome back"`** — eyebrow. Second-person, present-tense; matches the warm-friend voice. NEVER `"Sign-in successful"`, `"Account dashboard"`, `"Home"`.
- **`"What's next?"`** — display headline. Two-word, question-mark register; pre-empts the user's own mental question without prescribing what they should pick. Not `"Choose an option"` (procedural), not `"Pick one"` (terse). Display weight intentionally smaller than S01's hero headline (36pt vs 52pt) — this surface is a router, not a destination.
- **`"Start a Decision"`** — primary CTA label. Verb-first, capital `D` on Decision to mark it as the named ritual rather than a generic action. Renders uppercase via the `cta` token (`case: upper`). NEVER `"Start"`, `"Go"`, `"Begin"`, `"New session"`.
- **`"Account Settings"`** — secondary CTA label. Plain, noun-phrase. Renders uppercase via the `cta` token. NEVER `"Settings"` (matches the S01 footer mono-tag and would read as the same affordance), NEVER `"Manage account"`, NEVER `"Profile"` (no profile editor exists at v1.1).

## Behavior

1. **Entry:** the app routes to S00 on every launch where a valid auth session exists. First-launch installs hit the forced Apple sign-in gate ([[sg-03-account-creation-surfaces|sg-03]] / S00a) first; on success they advance to this surface. Web fallback never reaches S00 — invitee paths go from invite-link directly into the quiz.
2. **Idle state:** surface displays the eyebrow + headline + two pill CTAs. No active timers, no controls, no fields.
3. **Start a Decision tap:** navigate to [[01-initiator|S01 Initiator]] with the same `initiator` gradient stop. No state to seed — S01 boots its own defaults (timer 10 min, radius 2.0 mi, vertical `food`).
4. **Account Settings tap:** navigate to [[09-settings|S09 Settings]]. Gradient cross-fades to the `midnight` stop per `motion.md` (1100ms `gti-gradient-tween`). The S09 surface owns the settings UX from there; tapping "Done" on S09 returns to S00.

## v1.1 scope

- **Exactly two CTAs.** No third row. No "View past verdicts," no "Help," no "About," no "Sign out." If a new requirement adds a CTA, that's a spec change — flag and discuss before adding.
- **No category selector.** "Pick a Vertical" lives on S01 already (food enabled, drinks/movies stubbed). This surface routes into it; it does not replicate the selector.
- **No distance / time inputs.** Both deferred from v1.1 per [[../../50_product/questions-profile-vs-session-split|the profile/session split decision]] (same-geo assumption holds for v1.1). S01 owns the timer + radius controls; both stay there until / unless the multi-geo case re-enters scope.
- **Visual / brand polish deferred.** This is the structural surface; the polish ticket lands in the pre-public-launch milestone. Allowable polish without re-spec: refined headline copy, alternate eyebrow string, a real wordmark replacing the `GTIMark` placeholder, motion choreography on entry. Not allowed without re-spec: adding a third CTA, swapping in a different gradient stop, replacing the pill CTAs with a different component, introducing fields / controls.

## Edge cases

- **Returning user with an active room mid-session.** Out of v1.1 scope. The session-restore path is not specified in v1; if a user backgrounds the app mid-quiz and returns, the existing behavior (boot back into the quiz at the last answered question) takes precedence over routing through S00. The surface is for cold-start and post-deletion bootstraps.
- **User taps Account Settings, then Done from S09.** Returns to S00. No state mutation. Tapping Start a Decision from S00 then advances to S01 with fresh defaults — the round-trip is idempotent.
- **User signs in, immediately backgrounds the app, returns later.** Auth session persists; on resume they land on S00. The forced sign-in gate fires only on the first launch where no auth session exists.
- **Anonymous user via web invite link.** Never reaches S00 (web fallback has its own flow). If they install the app afterward, they hit S00a (forced sign-in) first, then S00 — they do not skip ahead.

## Adjacencies

- **[[sg-03-account-creation-surfaces|sg-03]] (S00a sign-in gate)** — upstream of this surface on first launch. The two surfaces compose: S00a is the one-time auth gate; S00 is the per-launch entry. Both can be spec'd independently because the JSX never branches between them — S00a is its own screen, S00 is its own screen, and routing is owned by the iOS layer.
- **[[01-initiator|S01 Initiator]]** — downstream of Start a Decision. S01's existing `"SETTINGS"` footer link becomes redundant once S00 routes to S09 as a first-class CTA; whether to remove the S01 footer is a separate spec decision (flagged here, not actioned in this issue's scope).
- **[[09-settings|S09 Settings]]** — downstream of Account Settings. No changes to S09 required; the "Done" footer link already returns to the prior surface, which is now S00 instead of S01.

## Out of scope (deferred)

- **Brand polish** (typography refinement, alternate gradient, wordmark) — pre-public-launch milestone.
- **Third-CTA candidates** (past verdicts, help, about) — none scoped at v1.1; would require a separate spec change.
- **Re-routing the S01 footer SETTINGS link** — flag for a follow-up; not part of this surface's scope.
