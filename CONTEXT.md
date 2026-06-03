# CONTEXT

Domain glossary and shared vocabulary for GetToIt. Agents read this before exploring; outputs (issue titles, refactor proposals, test names) should use the terms defined here.

This file is grown lazily by `/grill-with-docs` as terms get resolved during real work. Don't pre-fill speculatively.

## Language

### Auth identity

**Anonymous session**:
A Supabase auth session minted via `signInAnonymously()`, carrying a real `user_id` but no Apple identity. Default for both iOS and web prior to the S00a sign-in gate. Post-S00a iOS, anonymous sessions only exist as transient legacy state on pre-S00a TestFlight installs and on the web fallback.
_Avoid_: guest user, anon account, unauthenticated session (a session is still present), no-account user.

**Linked-Apple session**:
A Supabase auth session whose `user_id` has an Apple identity attached, either via fresh `signInWithApple` (no prior session) or `linkApple` (existing anonymous session upgraded, same `user_id` preserved). Canonical iOS post-S00a state.
_Avoid_: signed-in user, authenticated user, Apple account (the account is on Apple's side, the session is ours).

**S00a Sign-in Gate**:
The surface (`design-system/surfaces/00a-signin.md`) rendered on iOS launch when the current auth state is anything other than Linked-Apple. One Sign-in-with-Apple pill, no skip. 0.1.0 closure of the iOS half of [[gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]'s anonymous-default.
_Avoid_: sign-up page, sign-up screen, onboarding screen, welcome screen, account creation page (see Flagged ambiguities).

**Account claim**:
The process by which a Web invitee who installs the iOS app carries their browser-held Anonymous session into the app *before* completing Apple sign-in, so that S00a upgrades that existing identity via `linkApple` (preserving `user_id`, zero row migration) instead of `signInWithApple` minting a fresh, disjoint account. **Same-device only** — browser and app on one phone. **Before-sign-in only** — the claim must complete on S00a *before* the Sign-in-with-Apple tap; once a Linked-Apple session exists there is no in-app recovery (that would require an account merge — deferred to a future feature). If the claim is skipped, Apple sign-in mints a new `user_id` and the web vote strands; the only recovery is delete-and-reinstall (which returns the user to a fresh S00a), within the 30-day anonymous-identity TTL. The carrier is a **Claim code**. See [[gti-vault/15_issues/0.1.0/issues/sg-wf-7-web-invitee-account-claim|sg-WF-7]].
_Avoid_: account merge (no merge — the Apple identity attaches to the *existing* anonymous user; nothing is merged), account linking (collides with `linkApple`, which is only the final upgrade step, not the cross-context transport).

**Claim code**:
The short, single-use, short-lived code shown on the web fallback that carries a Web invitee's Anonymous session key from the browser into a freshly-installed app. Entered on S00a *before* the Sign-in-with-Apple tap. **Per-person, not per-Plan** — redeeming one code brings over every web Plan that anonymous identity voted in, because the code carries the whole identity, not a single Plan.
_Avoid_: invite code (the SMS deep-link is the invite; the claim code is a different artifact, used post-install), pairing code, OTP (not an authentication factor — it is an identity-transport token).

### Quiz redesign vocabulary (0.1.0, 2026-05-15)

**Parameter**:
A session-level setting captured BEFORE the quiz begins, on a session-setup surface, typically by the initiator. Distinct from quiz questions (asked of every member) and profile data (account-level, sticky). Current 0.1.0 parameters: meal time / urgency (timestamp), dine-in vs takeout.
_Avoid_: setting, option, pre-question (ambiguous).

**Profile** (in the quiz-redesign sense):
Account-level data stored once per user and read on every decision. Identity / body / values that do not change session-to-session. 0.1.0 contents: allergies, dietary restrictions, cuisine NEVERS (negative-only). Note that the profile-edit surface itself is deferred to the pre-public-launch milestone.
_Avoid_: account info (too broad), preferences (the cuisine-craving signal is a session-level preference, distinct from profile preferences).

**Scenario question**:
A quiz question whose answer compiles to a *recipe* of multiple underlying Foursquare filters at once, rather than mapping to a single filter dimension. Users pick a real-world scenario in plain language; the engine assembles the filter set. Distinct from one-question-per-filter design.
_Avoid_: composite question (mechanically accurate but doesn't convey the "scenario in user voice" framing), bundled question (collides with "bundle" in PR terminology).

**Q5 preference probe**:
The 0.1.0 Q5 mechanism. Each member rates three real candidate venues 1-5 on excitement. The three cards are a strict factorial -- each deviates from the member's stated Q1-Q4 profile on exactly one axis (cuisine, reputation, vibe) and matches the other two; never a 100% match. The engine reads the member's axis-weight hierarchy from the ratings and extrapolates a preference function over the full candidate pool. Replaces the 0.1.0-locked "regret-of-omission per surviving option" mechanism (signal-unstable under partial quorum) and the briefly-considered archetype rater (rejected: too abstract, rated templates not real venues -- see [[gti-vault/50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]] §7).
_Avoid_: archetype rater (rejected design, now historical), regret rater (the 0.1.0 mechanism, historical), tiebreaker (Q5 is a probe, not a tiebreaker -- the verdict tiebreak is the maximin rule).

**Verdict trigger** (0.1.0):
The moment a Plan's room computes a winning venue. 0.1.0 PRD locks two triggers and only two: (a) **all participants have submitted Q5** (auto-fire on quorum-completion), or (b) the **initiator manually closes voting** from the Waiting surface. There is **no session timer** and no shot-clock countdown — 0.1.0 PRD's `timer_minutes` / `deadline_at` / cron-auto-fire mechanism is explicitly retired per 0.1.0 PRD US34, US35, and §line 115. Minimum quorum is one member (the initiator alone in the edge case where nobody else responds).
_Avoid_: auto-fire (overloaded — 0.1.0 auto-fire = "everyone finished," not "timer expired"), timer-fire (the mechanism 0.1.0 retired), shot clock (PRD voice for what was killed), Decide-now (the 0.1.0 CTA label — 0.1.0 may rename, but the underlying initiator-closes-voting action survives).

**Cuisine NEVER**:
A profile-level negative filter -- a cuisine the user will never eat under any circumstance. Hard veto, EBA-style. Distinct from cuisine craving (session-level positive signal, "Italian sounds good tonight").
_Avoid_: cuisine dislike (too soft; NEVER is hard veto), cuisine veto (collides with the Q1-veto verdict-engine machinery from 0.1.0).

### Plan vocabulary (workflow overhaul, 2026-05-19)

**Plan**:
The user-facing persistent unit of intent — a named item the user creates ("Thursday dinner with the crew") and later returns to. Carries a name, a category (food only in 0.1.0), a participant scope (solo / duo / group — the *occasion* signal, not a headcount), a location, and the rest of the session parameters. A Plan is **stateful**: it moves through `pending` → `decided-active` (verdict stamped on, reroll allowed) → `decided-expired` (read-only history). Replaces the prior loose product term *decision*.
_Avoid_: decision (deprecated — too many syllables, awkward in copy), session (engineering-only term for the room+quiz run that a Plan instantiates), task (collides with Reminders-app borrow without naming the GetToIt-specific shape).

**Search area**:
A Plan-level geographic constraint composed of a map-selected center and radius, edited together as one user-facing map control; the radius follows the visible map area and is shown with a circle plus distance label, and carries no timezone or timing semantics.
_Avoid_: location (when radius is also meant), distance (when the center is also meant), geo (engineering register).

When rendered as a Setup chip, a committed **Search area** shows the center's best human place label as the main line and the radius as supporting text (for example, "Search area · 1.5 mi"). An uncommitted value reads "Set search area."

On first open with no committed value, the **Search area editor** centers on current location with a 2.0 mi radius when permission is granted, or opens in a search-first state when permission is denied/not granted. Editing an existing Plan starts from the saved Search area. New Plans do not default to a prior Plan's area; they start from current location.

Saving a pending Plan does not require a **Search area**. Launching a Room from Setup does require a committed **Search area**; if missing, the primary action opens the **Search area editor** instead of minting the Room.

**Search area radius**:
The distance from the map camera center to the nearest visible map edge; pan changes the center, pinch zoom changes the radius, and the committed value is still persisted as center coordinate plus radius.
_Avoid_: distance slider, zoom level (implementation detail), viewport bounds (backend-inconvenient shape).

In the **Search area editor**, the radius value appears as a floating badge near the bottom center above the commit action (for example, "2.0 MI RADIUS"), outside the circle so it does not read as a map marker.

The radius badge is flanked by visible minus/plus step buttons for users who cannot comfortably pinch; the buttons use the same allowed radius stops and keep the map zoom in sync.

**Search area jump**:
A typed place search or current-location action that recenters the map before the user commits the Search area; it is navigation inside the selector, not a separate final selection mode.
_Avoid_: manual location (old C-23 language), typeahead selection (sounds final), address picker (too narrow).

**Search area editor**:
The full-screen map surface opened from the Setup chip where a member pans, pinches, jumps, and explicitly commits a Search area; leaving with uncommitted map changes prompts to commit or cancel.
_Avoid_: location sheet (old C-23 shape), map picker (underspecified), radius picker (only half the control).

The **Search area editor** chrome is intentionally minimal: close/back, a top search field, full-screen map, floating current-location button, bottom-center radius badge, and bottom primary action "USE THIS AREA." Dirty close prompts offer "Use this area" or "Discard changes."

**Density preview pin**:
A non-interactive map marker inside the selected circle for a broad Apple MapKit food/dining place shown only to help a member size the Search area; it refreshes after map movement settles, caps around 20 visible pins, and is not a candidate, recommendation, or venue detail entry point.
_Avoid_: candidate pin, result pin, restaurant pin (over-promises category/detail).

**Plan reroll window**:
The interval during which a Plan in `decided-active` state may have its verdict replaced in place. The window closes at **23:59:59 in the Plan's search-area timezone on the calendar day *after* the verdict fired** — the search-area zone is `plans.location.timeZoneIdentifier` (the IANA id the C-23 LocationPicker resolves when the coordinate is committed), NOT the creator's device timezone (locked in the sg-WF-6 grill, 2026-05-21 — the device zone is never stored, and for the common near-home Plan the two are identical anyway). E.g. a Tuesday 5 PM verdict closes Wednesday 23:59:59 (~31h); a Tuesday 11:30 PM verdict closes Wednesday 23:59:59 (~24.5h). Acceptably asymmetric — the boundary tracks the today/tomorrow mental model of the meal's location rather than a uniform clock interval. The window inherits the existing 0.1.0 reroll friction model from `surfaces/07-reroll.md` intact: **max 3 rerolls** ("burns") per Plan, each requires a **stated reason that becomes a new constraint**, initiator-only. The time window is an *outer* bound: unused burns expire when the window closes. The Plan transitions to `decided-expired` on whichever happens first — window close, third burn used, or check-in completed.
_Avoid_: reroll timer (collides with the 0.1.0-retired session timer), verdict TTL (engineering register), 24-hour window (the boundary is calendar-day-anchored, not a rolling 24h).

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
- **Account member** — a user with a Linked-Apple session (iOS app holder, post-S00a). Has a personal **Plan list** surface as the app's landing. Plans they `Created` or `Joined` both appear on this list with distinct badges. May Exit any Plan, may Delete only their own Created Plans.
- **Web invitee** — a user without an account, accessing a single Plan via the iMessage/SMS deep-link rendered by the web fallback. Has **no Plan list** and no homepage; the SMS link is their only persistent handle on the Plan. Identified by a name they enter on first landing. Re-opening the same link returns them to the Plan's current state (quiz / waiting / verdict / read-only history). May Exit; cannot Delete (only creators can, and creators are always Account members).

The Plan creator is always an Account member — Plan creation is iOS-only post-workflow-overhaul. A Plan's joiners may be any mix of Account members (joined via iOS deep-link, with the Plan appearing on their list) and Web invitees (joined via the iMessage link in a browser, no list).
_Avoid_: guest (collides with "Anonymous session"), user / participant (acceptable colloquially but underspecified about which subtype — say "Account member" or "Web invitee" when the distinction matters).

### Sheet primitives (UI dogfood, 2026-05-24)

**Modal sheet**:
A sheet hosting a rich editor surface — multi-row content, persistent open state, the user can scroll inside it. Carries the bespoke Sunset Pop sheet container: `rgba(20,20,30,0.92)` dark glass, inset 12 from edges, bottom 12, custom 38×4 handle, no native iOS grabber. Used for the reroll surface (C-16) and the C-23 LocationPicker sheet. The container is intentionally **non-native** — its visual register binds the sheet to the system's other dark-glass surfaces and is correct for modal-editor intent.
_Avoid_: bottom sheet (ambiguous — collides with `Action sheet`), reroll sheet (one specific consumer, not the primitive), dark-glass sheet (visual-property name; the *role* is what's load-bearing).

**Action sheet**:
A sheet hosting a short choice — typically 1-3 affordances and a cancel, content-height, no scrolling inside. Carries the **native iOS shape** via SwiftUI `.sheet` + `.presentationDetents([.height(contentHeight)])` + `.presentationDragIndicator(.visible)` — rounded-top, full-width, system safe-area, native grabber. Inside the container, the Sunset Pop dark-glass register is preserved for visual continuity. Used for the S00 Plan list disambig (Solo / Group) sheet and the per-card delete-confirm sheet. Primitive: `C-2N` (assigned at the bug-24 spec edit; see [[gti-vault/15_issues/0.1.0/issues/bug-24-bottom-sheet-ios-shape|bug-24]]).
_Avoid_: confirm sheet (only one of two consumers is a confirm; the disambig sheet is a 2-row picker), bottom action sheet (redundant — the action-sheet idiom is bottom-anchored on iOS by construction), alert sheet (collides with iOS HIG alert, a distinct primitive).

The distinction matters because the bespoke modal-sheet container intentionally feels non-native — that is correct for the rich-editor role but **wrong** for the short-choice role, where users expect the iOS-HIG native shape. Grilling bug-24 resolved the two roles into two separate primitives instead of collapsing them.

### Verdict surfaces (pre-public-launch, 2026-05-26)

**Live verdict surface** (`VerdictScreen.swift`):
The Focus surface rendered when a Plan is in `decided-active` state for an Account member who participated in the room — eyebrow + hero + time-badge + receipts + reroll + Home chrome. Carries a three-case `Flavor` enum: `default` (pre-ratify group view), `committed` (post-`I'm in` group view with dock countdown), `solo` (single-member view — suppresses receipts and time-badge audience subtitle, swaps group-save for the C-22 save-taste-profile chip). One intent: *act on this verdict before the window closes*. Reroll burns and ratify live here. See [[gti-vault/60_engineering/adr/0018-verdict-surface-three-way-split|ADR 0018]].
_Avoid_: verdict screen (overloaded — prior name for the 5-mode unified struct, deprecated 2026-05-26), Live VerdictScreen (engineering register; "live verdict surface" is the canonical noun in design-doc voice).

**Read-only verdict surface** (`VerdictReadOnlyScreen.swift`, post-ADR-0018):
The Focus surface rendered when a viewer arrives at a `decided-expired` Plan, OR when a Web invitee deep-links into someone else's `decided-active` Plan they did not vote in. Suppresses ratify, reroll, dock countdown, save-chip; Home chrome rendering depends on arrival vector (Account member from PlanList History → yes; Web invitee from SMS → no). One intent: *show a closed verdict as a record*. Primary CTA is `Start a new decision`. Replaces the prior `.readOnly` mode case on the unified VerdictScreen.
_Avoid_: history verdict (the surface is reachable from history but also from non-history deep links — the read-only-ness is the load-bearing property, not the history-ness), past verdict screen (uses deprecated "screen" register).

**No-survivor surface** (`NoSurvivorScreen.swift`, post-ADR-0018):
The Focus surface rendered when a Plan's quiz round produces a candidate pool that the verdict engine cannot reduce to a winner — every option vetoed, no satisficing floor survivors. NOT a verdict surface (no hero, no time-badge, no receipts). One intent: *widen the search and re-run*. Carries the inline range slider and a `Re-run · N.N mi` primary CTA. Home chrome preserved (initiator-owned, PlanList reachable). Reroll burns are not consumed by the widen action (the widen is free; only post-verdict reroll consumes a burn). Replaces the prior `.noSurvivor` mode case on the unified VerdictScreen.
_Avoid_: no-results screen (collides with the Q5 no-results screen — that one fires on per-member empty fetch, not on post-verdict no-survivor; see [[gti-vault/60_engineering/adr/0013-no-fictitious-fallback-venues|ADR 0013]]), verdict-failure screen (overloaded — "failure" implies an error path; no-survivor is a successful quiz with a recoverable outcome).

### Candidate pool (0.1.0, 2026-05-19)

**Candidate pool**:
The set of real venues a session's verdict ranks -- the running union of every member's per-member Foursquare / MapKit fetch, deduped by `fsq_place_id`. The Q5 preference probe draws its three factorial cards from the same union: the Q5 candidate pool and the verdict candidate pool are one set, not two.
_Avoid_: options (the `options` table is the pool's persisted form, not a separate concept), results (a raw Foursquare response, pre-union), candidate set (acceptable informally, but "pool" is the canonical noun).

**Candidate-pool floor**:
The named, shared allowlist of venue *types* eligible for the candidate pool before any quiz answer narrows it. 0.1.0: eight Foursquare `Dining and Drinking` subcategories -- Restaurant, Sports Bar, Food Court, Food Truck, Food Stand, Cafeteria, Breakfast Spot, Bagel Shop. Applied as a fetch-time hard filter on every Foursquare call (seeded into `fsq_category_ids` when no other category scope is present) and approximated as `.restaurant`-only on the MapKit fallback. The single source of truth that keeps the Q5 candidate pool and the verdict candidate pool from diverging. See [[gti-vault/60_engineering/adr/0012-candidate-pool-floor|ADR 0012]].
_Avoid_: category filter (collides with the per-cuisine `fsq_category_ids` scoping, a different mechanism), restaurant filter ("Restaurant" is one of eight members, not the whole floor).

## Relationships

- An **Anonymous session** can upgrade to a **Linked-Apple session** via `AuthCoordinator.linkApple`, preserving the `user_id` and all owned rows (rooms, votes, members, events).
- The **S00a Sign-in Gate** is the iOS entry point that converts any non-Linked-Apple state into a **Linked-Apple session**. It is the ONLY surface that mints a Linked-Apple session on iOS.
- A **Linked-Apple session** is durable across reinstalls keyed by the device's Apple identity. An **Anonymous session** is durable only until the keychain is cleared or the app is deleted.
- An **Account claim** reuses the existing S00a `linkApple` path unchanged — its only new work is transporting the Anonymous session from browser to app keychain via a **Claim code**. Once the session is in the keychain, S00a treats the user identically to a pre-S00a legacy-carryover anonymous install.
- A **Parameter** is set on session setup and constrains the entire quiz that follows. A **Scenario question** is asked of every member during the quiz, and its answer is per-member. A **Profile** value is read silently per member without re-asking.
- The conditional Q3 structure (indoor/outdoor only if dine-in **Parameter**) means quiz question identity depends on session parameters. Schema must support per-session question-slot variability.
- The **Q5 preference probe** draws its three cards from the **Candidate pool**; the verdict engine ranks the same **Candidate pool**. They are one set — the **Candidate-pool floor** is what guarantees they cannot diverge.
- A **Search area** supplies only the geo/radius portion of the **Candidate pool** fetch; it does not decide Plan timing or timezone behavior.
- A **Search area jump** can change the center of a **Search area**, but the committed **Search area** remains the map's current center plus **Search area radius**.
- The **Search area editor** is opened from one compact Setup chip; the map does not render inline on Setup.
- **Density preview pins** can appear inside the **Search area editor**, but they do not define or promise membership in the **Candidate pool**.
- The **Candidate-pool floor** is a fetch-time (Stage 1) venue-*class* hard filter, applied alongside geo / radius / price / meal-time. It is orthogonal to cuisine, which is a Stage-2 soft scoring axis in the verdict engine and never strict-filters the fetch.
- A **Plan** is the durable owner; a **Room** is the ephemeral container for one quiz round. A Plan owns at most one active Room (the in-flight round). Launching a `pending` Plan mints a new Room. On verdict, the Room closes and the Plan transitions to `decided-active`. A reroll re-runs the verdict on that **same** Room in place — it does not mint a new Room (the 3-burn cap is per-Room). Once the Plan transitions to `decided-expired`, no new Rooms may be minted against it. Plan name, status, params, and the stamped verdict survive Room lifecycle; the Room's `votes` / `options` rows do not.
- A **Modal sheet** and an **Action sheet** are distinct primitives, not visual variants. They differ in *role* (rich editor vs short choice), in container shape (bespoke dark-glass vs native-iOS), and in HIG semantics. C-16 (reroll) and C-23 LocationPicker are Modal sheets. The S00 disambig (Solo / Group) and delete-confirm sheets are Action sheets. A future surface that needs to host a richer single-choice picker (e.g. a long list) belongs in the Modal sheet family, not the Action sheet family — the choice is editor-vs-choice, not list-length.

## Example dialogue

> **Founder:** "There is still no sign-up page upon app launch."
> **Engineer:** "The **S00a Sign-in Gate** is wired but its render guard only fires when there is no session at all. Your phone still has an **Anonymous session** in keychain from a pre-S00a build, so the gate is being skipped."
> **Founder:** "And when I do sign in, I keep my old rooms?"
> **Engineer:** "Yes. The fix routes you through **S00a** but taps `linkApple` instead of `signInWithApple`, so your **Anonymous session** is upgraded to a **Linked-Apple session** with the same `user_id`. Every row keyed off that id survives."

## Flagged ambiguities

- "S01 + S04 surface specs are stale on timer/countdown": `design-system/surfaces/01-initiator.md` (locked 2026-05-12) and `design-system/surfaces/04-waiting.md` describe a timer chip group + `"Auto-fires in 7:42"` countdown that the 0.1.0 PRD (2026-05-15) explicitly retired (US34, US35, §115). Surfaces need a sweep to remove the timer chip, the countdown mono-tag, the `"Auto-fires"` copy, and any related state in `code/screens/Screen*.jsx` + `tb-03` / `tb-07` carryover. Workflow-overhaul setup screen (post-grill) does not include a Timer control.
- "sign-up" vs "sign-in": product / founder voice uses "sign-up page" loosely for any account-creation moment. Engineering uses "sign-in gate" because the surface only ever signs in with an existing Apple identity (Apple owns account creation; the app never sees a "new vs returning" distinction). When the founder says "sign-up page," they almost always mean the **S00a Sign-in Gate**.
- "anonymous user" vs "no user": pre-S00a these were the same in practice (every iOS install minted an anonymous user on launch). Post-S00a they diverge - no user = pre-S00a state; anonymous user = legacy carryover that must pass through S00a via `linkApple`.
- "Search-area timezone" conflict: the existing **Plan reroll window** definition says the close boundary uses `plans.location.timeZoneIdentifier`, but the Search area grill on 2026-06-03 clarified that **Search area** has no timing or timezone semantics. The timing model needs a separate correction; do not use the map selector work to reinforce the old search-area-timezone language.
- "C-23 LocationPicker" vs "C-28 SearchAreaPicker": the 2026-06-03 Search area grill clarified that the active Setup component should be a new **C-28 SearchAreaPicker**, not a relabeled C-23 LocationPicker. C-23 remains historical until the design-system and iOS cleanup retires its active references.

## See also

- `gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade.md` - Auth ADR
- `gti-vault/50_product/0.1.0-workflow-overhaul-plan-setup.md` - Plan setup screen decisions (the 11 grilled outcomes that defined the Plan vocabulary above)
- `gti-vault/10_prds/0.1.0-quiz-redesign-prd.md` - source of the Verdict trigger ruling (no timer, no shot clock)
- `design-system/surfaces/00a-signin.md` - S00a surface spec
- `docs/agents/domain.md` - consumer rules for this file
