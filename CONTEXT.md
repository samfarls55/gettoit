# CONTEXT

Domain glossary and shared vocabulary for GetToIt. Agents read this before exploring; outputs (issue titles, refactor proposals, test names) should use the terms defined here.

This file is grown lazily by `/grill-with-docs` as terms get resolved during real work. Don't pre-fill speculatively.

## Language

### Auth identity

**Anonymous session**:
A Supabase auth session minted via `signInAnonymously()`, carrying a real `user_id` but no Apple identity. v1 default for both iOS and web. Post-v1.1 iOS, anonymous sessions only exist as transient legacy state on pre-v1.1 TestFlight installs and on the web fallback.
_Avoid_: guest user, anon account, unauthenticated session (a session is still present), no-account user.

**Linked-Apple session**:
A Supabase auth session whose `user_id` has an Apple identity attached, either via fresh `signInWithApple` (no prior session) or `linkApple` (existing anonymous session upgraded, same `user_id` preserved). Canonical iOS post-v1.1 state.
_Avoid_: signed-in user, authenticated user, Apple account (the account is on Apple's side, the session is ours).

**S00a Sign-in Gate**:
The surface (`design-system/surfaces/00a-signin.md`) rendered on iOS launch when the current auth state is anything other than Linked-Apple. One Sign-in-with-Apple pill, no skip. v1.1 closure of the iOS half of [[gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]'s anonymous-default.
_Avoid_: sign-up page, sign-up screen, onboarding screen, welcome screen, account creation page (see Flagged ambiguities).

### Quiz redesign vocabulary (v1.1, 2026-05-15)

**Parameter**:
A session-level setting captured BEFORE the quiz begins, on a session-setup surface, typically by the initiator. Distinct from quiz questions (asked of every member) and profile data (account-level, sticky). Current v1.1 parameters: meal time / urgency (timestamp), dine-in vs takeout.
_Avoid_: setting, option, pre-question (ambiguous).

**Profile** (in the quiz-redesign sense):
Account-level data stored once per user and read on every decision. Identity / body / values that do not change session-to-session. v1.1 contents: allergies, dietary restrictions, cuisine NEVERS (negative-only). Note that the profile-edit surface itself is deferred to the pre-public-launch milestone.
_Avoid_: account info (too broad), preferences (the cuisine-craving signal is a session-level preference, distinct from profile preferences).

**Scenario question**:
A quiz question whose answer compiles to a *recipe* of multiple underlying Foursquare filters at once, rather than mapping to a single filter dimension. Users pick a real-world scenario in plain language; the engine assembles the filter set. Distinct from one-question-per-filter design.
_Avoid_: composite question (mechanically accurate but doesn't convey the "scenario in user voice" framing), bundled question (collides with "bundle" in PR terminology).

**Q5 preference probe**:
The v1.1 Q5 mechanism. Each member rates three real candidate venues 1-5 on excitement. The three cards are a strict factorial -- each deviates from the member's stated Q1-Q4 profile on exactly one axis (cuisine, reputation, vibe) and matches the other two; never a 100% match. The engine reads the member's axis-weight hierarchy from the ratings and extrapolates a preference function over the full candidate pool. Replaces the v1-locked "regret-of-omission per surviving option" mechanism (signal-unstable under partial quorum) and the briefly-considered archetype rater (rejected: too abstract, rated templates not real venues -- see [[gti-vault/50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]] §7).
_Avoid_: archetype rater (rejected design, now historical), regret rater (the v1 mechanism, historical), tiebreaker (Q5 is a probe, not a tiebreaker -- the verdict tiebreak is the maximin rule).

**Verdict trigger** (v1.1):
The moment a Plan's room computes a winning venue. v1.1 PRD locks two triggers and only two: (a) **all participants have submitted Q5** (auto-fire on quorum-completion), or (b) the **initiator manually closes voting** from the Waiting surface. There is **no session timer** and no shot-clock countdown — v1 PRD's `timer_minutes` / `deadline_at` / cron-auto-fire mechanism is explicitly retired per v1.1 PRD US34, US35, and §line 115. Minimum quorum is one member (the initiator alone in the edge case where nobody else responds).
_Avoid_: auto-fire (overloaded — v1.1 auto-fire = "everyone finished," not "timer expired"), timer-fire (the mechanism v1.1 retired), shot clock (PRD voice for what was killed), Decide-now (the v1 CTA label — v1.1 may rename, but the underlying initiator-closes-voting action survives).

**Cuisine NEVER**:
A profile-level negative filter -- a cuisine the user will never eat under any circumstance. Hard veto, EBA-style. Distinct from cuisine craving (session-level positive signal, "Italian sounds good tonight").
_Avoid_: cuisine dislike (too soft; NEVER is hard veto), cuisine veto (collides with the Q1-veto verdict-engine machinery from v1).

### Plan vocabulary (workflow overhaul, 2026-05-19)

**Plan**:
The user-facing persistent unit of intent — a named item the user creates ("Thursday dinner with the crew") and later returns to. Carries a name, a category (food only in v1), a participant scope (solo / duo / group — the *occasion* signal, not a headcount), a location, and the rest of the session parameters. A Plan is **stateful**: it moves through `pending` → `decided-active` (verdict stamped on, reroll allowed) → `decided-expired` (read-only history). Replaces the prior loose product term *decision*.
_Avoid_: decision (deprecated — too many syllables, awkward in copy), session (engineering-only term for the room+quiz run that a Plan instantiates), task (collides with Reminders-app borrow without naming the GetToIt-specific shape).

**Plan reroll window**:
The interval during which a Plan in `decided-active` state may have its verdict replaced in place. The window closes at **23:59:59 in the user's local timezone on the calendar day *after* the verdict fired** — e.g. a Tuesday 5 PM verdict closes Wednesday 23:59:59 (~31h); a Tuesday 11:30 PM verdict closes Wednesday 23:59:59 (~24.5h). Acceptably asymmetric — the boundary tracks the user's "today/tomorrow" mental model rather than a uniform clock interval. The window inherits the existing v1 reroll friction model from `surfaces/07-reroll.md` intact: **max 3 rerolls** ("burns") per Plan, each requires a **stated reason that becomes a new constraint**, initiator-only. The time window is an *outer* bound: unused burns expire when the window closes. The Plan transitions to `decided-expired` on whichever happens first — window close, third burn used, or check-in completed.
_Avoid_: reroll timer (collides with the v1.1-retired session timer), verdict TTL (engineering register), 24-hour window (the boundary is calendar-day-anchored, not a rolling 24h).

**Plan history**:
The list of past `decided-expired` Plans visible to the user from the Plan list surface. Read-only by definition — the verdict is preserved as a record of what was decided, not a re-runnable session. The Plan name, params, and stamped verdict survive; the quiz votes and the candidate pool do not (those remain ephemeral in `votes` / `options`).
_Avoid_: past decisions (uses the deprecated noun), verdict log (engineering register).

**Plan exit** (verb):
A *participant-scoped* withdrawal from an in-progress quiz, taken on any quiz screen (Q1–Q5 via an `Exit` affordance in the chrome — joiners see the same affordance labelled `Leave`). The exiter's quiz answers are discarded and their membership is dropped from the active room. The room remains alive for the remaining participants. The Plan itself does **not** change state — for the initiator's list, an exited Plan stays `pending` if the remaining members no longer hold quorum (room times out without a verdict), or transitions to `decided-active` if the rest reach verdict without the exiter's votes counted.
_Avoid_: cancel (overloaded — see Plan delete), leave (acceptable colloquially in UI copy but ambiguous about whose state changes), abandon (engineering register).

**Plan delete** (verb):
An *initiator-scoped* destruction of the Plan, taken from the Plan list surface. Kills any active room belonging to the Plan (joiners get a "session ended" toast and are punted). Removes the Plan from the initiator's list entirely. Only the Plan's creator (`creator_id` owner) can delete. Distinct from `Plan exit`: exit is "I'm out, you carry on"; delete is "everyone, we're done."
_Avoid_: cancel (overloaded), end session (joiner-side framing — joiners cannot delete), close (collides with `closed`/`hard-close` from S06).

**Plan back** (verb):
In-quiz local navigation, available on Q2 through Q5. Steps the active quiz screen one question backward (e.g., Q3 → Q2) with the prior answer preserved and re-editable. Strictly per-member — never affects others or room state. Q1 has no `Back` affordance (no prior question); the Q1 chrome carries only an `Exit` affordance instead.
_Avoid_: previous (form-field register), undo (suggests destructive reversal; back is non-destructive).

**Plan member** (any-platform):
A user participating in a Plan's quiz round. Two disjoint subtypes, distinguished by auth identity, not by role within the quiz:
- **Account member** — a user with a Linked-Apple session (iOS app holder, post-v1.1). Has a personal **Plan list** surface as the app's landing. Plans they `Created` or `Joined` both appear on this list with distinct badges. May Exit any Plan, may Delete only their own Created Plans.
- **Web invitee** — a user without an account, accessing a single Plan via the iMessage/SMS deep-link rendered by the web fallback. Has **no Plan list** and no homepage; the SMS link is their only persistent handle on the Plan. Identified by a name they enter on first landing. Re-opening the same link returns them to the Plan's current state (quiz / waiting / verdict / read-only history). May Exit; cannot Delete (only creators can, and creators are always Account members).

The Plan creator is always an Account member — Plan creation is iOS-only post-v1.1. A Plan's joiners may be any mix of Account members (joined via iOS deep-link, with the Plan appearing on their list) and Web invitees (joined via the iMessage link in a browser, no list).
_Avoid_: guest (collides with "Anonymous session"), user / participant (acceptable colloquially but underspecified about which subtype — say "Account member" or "Web invitee" when the distinction matters).

### Candidate pool (v1.1, 2026-05-19)

**Candidate pool**:
The set of real venues a session's verdict ranks -- the running union of every member's per-member Foursquare / MapKit fetch, deduped by `fsq_place_id`. The Q5 preference probe draws its three factorial cards from the same union: the Q5 candidate pool and the verdict candidate pool are one set, not two.
_Avoid_: options (the `options` table is the pool's persisted form, not a separate concept), results (a raw Foursquare response, pre-union), candidate set (acceptable informally, but "pool" is the canonical noun).

**Candidate-pool floor**:
The named, shared allowlist of venue *types* eligible for the candidate pool before any quiz answer narrows it. v1.1: eight Foursquare `Dining and Drinking` subcategories -- Restaurant, Sports Bar, Food Court, Food Truck, Food Stand, Cafeteria, Breakfast Spot, Bagel Shop. Applied as a fetch-time hard filter on every Foursquare call (seeded into `fsq_category_ids` when no other category scope is present) and approximated as `.restaurant`-only on the MapKit fallback. The single source of truth that keeps the Q5 candidate pool and the verdict candidate pool from diverging. See [[gti-vault/60_engineering/adr/0012-candidate-pool-floor|ADR 0012]].
_Avoid_: category filter (collides with the per-cuisine `fsq_category_ids` scoping, a different mechanism), restaurant filter ("Restaurant" is one of eight members, not the whole floor).

## Relationships

- An **Anonymous session** can upgrade to a **Linked-Apple session** via `AuthCoordinator.linkApple`, preserving the `user_id` and all owned rows (rooms, votes, members, events).
- The **S00a Sign-in Gate** is the iOS entry point that converts any non-Linked-Apple state into a **Linked-Apple session**. It is the ONLY surface that mints a Linked-Apple session on iOS.
- A **Linked-Apple session** is durable across reinstalls keyed by the device's Apple identity. An **Anonymous session** is durable only until the keychain is cleared or the app is deleted.
- A **Parameter** is set on session setup and constrains the entire quiz that follows. A **Scenario question** is asked of every member during the quiz, and its answer is per-member. A **Profile** value is read silently per member without re-asking.
- The conditional Q3 structure (indoor/outdoor only if dine-in **Parameter**) means quiz question identity depends on session parameters. Schema must support per-session question-slot variability.
- The **Q5 preference probe** draws its three cards from the **Candidate pool**; the verdict engine ranks the same **Candidate pool**. They are one set — the **Candidate-pool floor** is what guarantees they cannot diverge.
- The **Candidate-pool floor** is a fetch-time (Stage 1) venue-*class* hard filter, applied alongside geo / radius / price / meal-time. It is orthogonal to cuisine, which is a Stage-2 soft scoring axis in the verdict engine and never strict-filters the fetch.
- A **Plan** is the durable owner; a **Room** is the ephemeral container for one quiz round. A Plan owns at most one active Room (the in-flight round). Launching a `pending` Plan mints a new Room. On verdict, the Room closes and the Plan transitions to `decided-active`. A reroll mints a new Room against the same Plan. Once the Plan transitions to `decided-expired`, no new Rooms may be minted against it. Plan name, status, params, and the stamped verdict survive Room lifecycle; the Room's `votes` / `options` rows do not.

## Example dialogue

> **Founder:** "There is still no sign-up page upon app launch."
> **Engineer:** "The **S00a Sign-in Gate** is wired but its render guard only fires when there is no session at all. Your phone still has an **Anonymous session** in keychain from a pre-v1.1 build, so the gate is being skipped."
> **Founder:** "And when I do sign in, I keep my old rooms?"
> **Engineer:** "Yes. The fix routes you through **S00a** but taps `linkApple` instead of `signInWithApple`, so your **Anonymous session** is upgraded to a **Linked-Apple session** with the same `user_id`. Every row keyed off that id survives."

## Flagged ambiguities

- "S01 + S04 surface specs are stale on timer/countdown": `design-system/surfaces/01-initiator.md` (locked 2026-05-12) and `design-system/surfaces/04-waiting.md` describe a timer chip group + `"Auto-fires in 7:42"` countdown that the v1.1 PRD (2026-05-15) explicitly retired (US34, US35, §115). Surfaces need a sweep to remove the timer chip, the countdown mono-tag, the `"Auto-fires"` copy, and any related state in `code/screens/Screen*.jsx` + `tb-03` / `tb-07` carryover. Workflow-overhaul setup screen (post-grill) does not include a Timer control.
- "sign-up" vs "sign-in": product / founder voice uses "sign-up page" loosely for any account-creation moment. Engineering uses "sign-in gate" because the surface only ever signs in with an existing Apple identity (Apple owns account creation; the app never sees a "new vs returning" distinction). When the founder says "sign-up page," they almost always mean the **S00a Sign-in Gate**.
- "anonymous user" vs "no user": pre-v1.1 these were the same in practice (every iOS install minted an anonymous user on launch). Post-v1.1 they diverge - no user = pre-S00a state; anonymous user = legacy carryover that must pass through S00a via `linkApple`.

## See also

- `gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade.md` - Auth ADR
- `gti-vault/50_product/workflow-overhaul-plan-setup.md` - Plan setup screen decisions (the 11 grilled outcomes that defined the Plan vocabulary above)
- `gti-vault/10_prds/v1.1-quiz-redesign-prd.md` - source of the Verdict trigger ruling (no timer, no shot clock)
- `design-system/surfaces/00a-signin.md` - S00a surface spec
- `docs/agents/domain.md` - consumer rules for this file
