---
folder: 15_issues/v1.1
purpose: v1.1 follow-up issues from 2026-05-14 TestFlight dogfood — bugs against shipped v1 + missing-surface work + product decisions
status: 11 issues published 2026-05-14 (GitHub #41–#51); sg-03 closed 2026-05-14
---

# v1.1 — Dogfood follow-ups

Post-build feedback against the v1 TestFlight build, captured during the first real-device install on 2026-05-14. Source raw note: [[testflight-first-dogfood-2026-05-14|testflight-first-dogfood-2026-05-14]] (lives next to this index after compile).

## Framing

These items are follow-ups to v1, not part of the original v1 PRD ([[../../10_prds/v1-prd|v1-prd.md]]). v1 is feature-complete (TB-00 → TB-17 ✅); v1.1 captures defects and gaps surfaced once the build was on a real device.

**State as of 2026-05-14:** the original 11 candidates were grilled, split, and published. Three artifact kinds in v1.1 (`bug` is new; `spec-gap` and `tracer-bullet` carry over from v1). Three candidates do not appear as v1.1 issues — #2b and #10 deferred to the pre-public-launch milestone, #11 withdrawn (folded into [[issues/sg-02-landing-page-surface|sg-02]]). See [[#Resolutions (post-grilling, 2026-05-14)]] for the per-candidate decisions.

## Published issues

### Bugs

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| bug-01 | [[issues/bug-01-invite-link-404\|Invite link 404 + AASA regression test]] | AFK | [#41](https://github.com/samfarls55/gettoit/issues/41) | — |
| bug-02 | [[issues/bug-02-static-og-image-placeholder\|Static placeholder OG image + meta tags]] | AFK | [#42](https://github.com/samfarls55/gettoit/issues/42) | — |
| bug-03 | [[issues/bug-03-q5-placeholder-no-foursquare-calls\|Q5 placeholders, zero Foursquare calls — wire PlacesService into Q5]] | AFK | [#43](https://github.com/samfarls55/gettoit/issues/43) | — |
| bug-04 | [[issues/bug-04-question-transition-motion-lag\|Question transition motion lag]] | AFK | [#44](https://github.com/samfarls55/gettoit/issues/44) | — |

### Spec gaps

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| sg-01 | [[issues/sg-01-on-gradient-subheader-contrast\|On-gradient subheader contrast token fix]] | AFK | [#45](https://github.com/samfarls55/gettoit/issues/45) | — |
| sg-02 | [[issues/sg-02-landing-page-surface\|Landing page surface (two-button)]] | AFK | [#46](https://github.com/samfarls55/gettoit/issues/46) | — |
| sg-03 | [[issues/sg-03-account-creation-surfaces\|Forced first-launch sign-in + waiting-screen download CTA]] ✅ done | AFK | [#47](https://github.com/samfarls55/gettoit/issues/47) | — |
| sg-04 | [[issues/sg-04-geo-permission-and-location-selector\|Geo permission + location selector — C-23 LocationPicker]] | AFK | [#48](https://github.com/samfarls55/gettoit/issues/48) | — |

### Tracer-bullet build slices

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-01 (v1.1) | [[issues/tb-01-landing-page-wire\|Wire landing surface into iOS]] | AFK | [#49](https://github.com/samfarls55/gettoit/issues/49) | sg-02 |
| TB-02 (v1.1) | [[issues/tb-02-account-creation-wire\|Wire forced sign-in (iOS) + waiting-screen CTA (web)]] | AFK | [#50](https://github.com/samfarls55/gettoit/issues/50) | sg-03 |
| TB-03 (v1.1) | [[issues/tb-03-geo-permission-and-location-selector-wire\|Wire geo permission + location selector]] | AFK | [#51](https://github.com/samfarls55/gettoit/issues/51) | sg-04 |

### Dependency notes

Spec-gaps + bugs are dependency-free at the v1.1 layer — any can start immediately. Tracer-bullets pair 1-to-1 with the surface-introducing spec-gaps:

- `tb-01` consumes `sg-02` landing surface.
- `tb-02` consumes `sg-03` sign-in + waiting-screen specs.
- `tb-03` consumes `sg-04` permission + selector specs. The LocationPicker component decision was resolved 2026-05-14 (see [[../../60_engineering/adr/0009-locationpicker-as-reusable-component|ADR 0009]] — reusable `C-23 LocationPicker`); sg-04 is now AFK.

`bug-03` (Q5 placeholders) shares root-cause space with `tb-03` (location selector) — wiring location may resolve bug-03 as a side effect, but bug-03 owns its own acceptance criteria.

## Artifact kinds

v1.1 introduces one new artifact kind beyond v1's existing taxonomy:

- `bug` *(new)* — defect against shipped v1 functionality. No spec change required; localized code fix.
- `tracer-bullet` *(existing)* — vertical build slice for new functionality.
- `spec-gap` *(existing)* — change to the locked `design-system/` spec.

## Cross-references

- [[testflight-first-dogfood-2026-05-14|Source raw note]] — original first-impression observations (moved from 01_raw/ on 2026-05-14 compile)
- [[../v1/_index|v1 issues]] — the build these issues are against
- [[../../10_prds/v1-prd|v1 PRD]] — context for what "shipped v1" means
- [[../../60_engineering/adr|ADRs]] — for any decision that lands during triage

---

## Resolutions (post-grilling, 2026-05-14)

Resolution context captured during a `/grill-me` session run on the candidate table above. `/to-issues` or `/triage` should consume this section when splitting into individual `issues/<NN>-<slug>.md` files. Numbers map to the candidate table; deltas (splits, withdrawals, deferrals) called out inline.

### #1 — Invite link → 404 (bug, P0)
- **Fix scope:** URL resolution bug fix + regression test.
- **Regression test:** synthetic E2E in CI that (a) curls the live invite URL and (b) hits the AASA validator endpoint. Not just unit tests on URL generation — the bug was a live-plumbing failure and the test must catch live-plumbing regressions.
- **Investigate alongside #2a/#2b** (shared AASA / universal-links root-cause candidate from TB-00 + TB-02). Closing one may close the other.

### #2a — Static placeholder OG image (bug, was #2)
- **Split from original #2.** This sub-issue ships in v1.1; #2b deferred (see below).
- **Deliverables:** placeholder `/og/invite.png` (any gradient or solid color — explicitly **non-branded** for v1.1) + Open Graph / Twitter / Apple meta tags wired into `web/app/join/[roomId]/page.tsx`.
- **Acceptance:** pasting a `/join/<roomId>` link into iMessage shows a card (any card), not plain blue text.
- **Branding deferred:** see #2b.

### #2b — Branded / dynamic OG card (DEFERRED to pre-public-launch milestone)
- **Out of v1.1 scope.** Lands in pre-public-launch milestone (before any non-self user joins the platform).
- **Static branded card** comes first (lighter dependency). **Dynamic per-invite card** blocked on resolving initiator display-name source — intersects #9 profile-level data definition.
- **File as spec-gap + product-decision** when triaged for the milestone.

### #3 — Q5 (Regret?) shows placeholder, not real `PlacesService` candidates (bug)
- **Diagnostic clue:** Foursquare API logs show **zero calls** during a quiz pass. Either `PlacesService` is never invoked from the Q5 code path, or a guard short-circuits before the call. Stub-never-replaced vs wiring-broken-upstream — unknown.
- **Route through `diagnose` skill at fix time.** Start trace at `VerdictEngine` / Q5 view-model, walk up to `PlacesService.fetch()`.
- **Test scope:**
  - Unit test on Q5 view-model with canned `PlacesService` output (regression guard against placeholder-strings).
  - Boundary assertion that `PlacesService.fetch()` is actually invoked during a session (would have caught this exact bug — silent no-call is the failure mode).
  - Manual TestFlight smoke check on device.

### #4 — Motion lag (bug, P2)
- **Fix scope:** per-screen surgical `CHOREO` constant edit to align gradient curve duration with card transition. User confirmed the lag is on **every** question transition, so the fix likely lands in one shared transition primitive.
- **Verification:** on-device pass walking Q1→Q6 (or whatever count v1.1 lands on after #9), confirming no peer lag.
- **`verify.mjs` green required.** If verification surfaces another offender, folded into the same fix (not a separate motion review).

### #5 — Home-page subheader contrast (spec-gap)
- **Failure:** white subheader text on the brightest band of the initiator/home gradient (the first, yellow-heavy stop).
- **Fix:** **token-level**. Edit the on-gradient subheader role in `design-system/tokens.json` (likely `color.text.on-gradient.secondary` or new restricted role) so it clears WCAG AA (4.5:1) against the brightest gradient stop.
- **Likely change:** shift from pure white toward a tinted dark.
- **Verify with:** `design-system/accessibility.md` contrast table + `verify.mjs`. Spot-check every surface consuming that role for regressions.

### #6 — Landing page surface (spec-gap + tracer-bullet)
- **New surface above the existing flow.** Two buttons, nothing else for v1.1:
  - **Start a Decision** (or similar wording) → routes into existing "Pick a Vertical" screen → existing food flow.
  - **Account Settings** → routes to existing delete-your-data page.
- **Visual / brand design deferred.** v1.1 ships the structural surface only; user will design fully later.
- **Folds in #11** (sliders); see #11 below.
- **Does NOT introduce a category selector** — "Pick a Vertical" already exists with food enabled and drinks/movies stubbed. No new functionality.

### #7 — Account creation flow (spec-gap + tracer-bullet)
- **Initiator path:** **forced Sign in with Apple gate on first launch.** App is unusable until signed in. iPhone-only assumption holds.
- **Invitee path:** click invite link → anonymous auth (unchanged from today) → straight into questionnaire → on the waiting screen, present a **"Download the app"** CTA. App install triggers their own first-launch Apple sign-in.
- **Profile-edit surface (allergies / dietary / cuisine):** **deferred** to pre-public-launch milestone.
- **v1.1 deliverables narrow to:** (a) force Apple sign-in on first launch, (b) waiting-screen "Download the app" CTA.

### #8 — Geography / location permission surface (spec-gap + tracer-bullet)
- **When prompt fires:** pre-quiz, on tapping "Start a Decision," before the Pick a Vertical screen. Pre-prime card explains *why* (restaurant recs need location), then native iOS dialog.
- **Persistent location selector UI:** location is **always editable**. Auto-populates if permission granted, requires manual selection if denied, user can override the auto-populated value in either case.
- **No "denied = broken app" failure mode.** Denied users still have a viable path via manual selection.
- **Adjacency RESOLVED (2026-05-14):** [[../../60_engineering/adr/0009-locationpicker-as-reusable-component|ADR 0009]] picks Path B — reusable `C-23 LocationPicker` component, not a one-off composition. Original "extend `MapKitPlacesFallback`" framing was a category error (data-layer service, not a UI primitive). Agent has token / copy / Refero authority on this issue; see the issue body for the granted-autonomy list.

### #9 — Questions rework, profile vs session split (product-decision, RESOLVED)
- **Decision recorded in:** `50_product/questions-profile-vs-session-split.md` (to be created — does not yet exist, must be written before `/to-issues` runs).
- **Split rule:** identity / body / values = **profile** (sticky, lives on account). Right-now context = **session** (asked every run).
- **Profile-level items:**
  - Allergies
  - Dietary restrictions (vegan, keto, halal)
  - Cuisine preferences ("I love Thai")
  - Cuisine dislikes ("hate seafood")
- **Session-level items:**
  - Budget tier
  - Mood
  - Hunger level
  - Solo / partner / group
  - Indoor / outdoor / takeout
- **Deferred from v1.1 entirely** (out of both buckets, not just reassigned):
  - Distance willing to travel
  - Time available
  - Justification: v1.1 assumes all participants in the same general geographic area; multi-geo decisions are out of scope.
- **Future product direction:** passive preference learning from answer history over time — preferences should emerge, explicit capture stays opt-in. Document alongside the split rule in `50_product/`.
- **Issue type:** product-decision → resolves to a `50_product/` decision note, no spec-gap or tracer-bullet child issues spawn for the split itself in v1.1. (Surfaces consuming the split — profile-edit surface, anon 6th question — both deferred per #10 and #7.)

### #10 — Anonymous-user fallback 6th question (DEFERRED to pre-public-launch milestone)
- **Out of v1.1 scope.** Originally proposed: anon users get a pre-Q1 multi-select asking allergies + dietary restrictions (the safety subset of profile data). After #7 lock (no profile-edit surface in v1.1), capturing this data anonymously created an inconsistency: authed users had no place to store the same data.
- **Resolution:** defer **all** allergy / dietary handling — anon 6th question AND profile-edit surface — to the pre-public-launch milestone, so they land together.
- **v1.1 recommender is allergy-blind by design.** Acceptable risk because only the user-as-self is on the platform during v1.1; no real recipients of bad recs.
- **Was blocked on #9; #9 now resolved, but item still deferred for the reason above.**

### #11 — Landing-page distance + time sliders (WITHDRAWN, folded into #6)
- **Not a separate issue.** v1.1 has no distance + time inputs anywhere (see #9 deferrals). Sliders are simply removed from the landing surface.
- **No follow-up artifact.** Folded entirely into the new #6 landing-surface scope (two-button surface, no sliders).

---

## v1.1 → pre-public-launch milestone handoff

Items explicitly deferred out of v1.1 that **must land before the first non-self user** joins the platform. See [[../../../../../home/node/.claude/projects/-workspace/memory/project_pre_public_launch_milestone|project_pre_public_launch_milestone memory]] for the planning-checkpoint framing.

- **#2b** — branded OG image (static, then dynamic per-invite once display-name source resolved)
- **#10** — allergy / dietary capture (anon 6th question + persistent profile-edit surface — land as a pair)
- **Profile-edit surface** — cuisine likes/dislikes editor (intersects #7 settings surface)
- **Distance + time inputs** — re-enter scope when multi-geo decisions become a thing (likely tied to expanding beyond a single test cohort)
- **`support@gettoit.app` mailbox / forwarding** — deferred 2026-05-14 from [[../v1/issues/tb-16-privacy-legal-delete|TB-16]] because the operator couldn't log into the registrar email console mid-walkthrough. PP + ToS already cite the address as the contact for deletion / CCPA / informal dispute resolution. Cheapest fix is Namecheap / Cloudflare email-forwarding rule into the operator's existing Outlook account. Must land before the App Store public listing or any non-friend invitee joins.

Triage these when planning the milestone after v1.1 ships. Not appropriate to file as v1.1 issues now.

## Adjacencies surfaced during grilling

- **`LocationPicker` component** — RESOLVED 2026-05-14 as `C-23 LocationPicker` per [[../../60_engineering/adr/0009-locationpicker-as-reusable-component|ADR 0009]]. Stub slot reserved in `design-system/components.md`; agent fills in the full spec during sg-04 work.
- **Account Settings surface (existing)** — currently a delete-your-data page. #6 wires the landing-page button to it; #7 may extend it further in pre-public-launch milestone for the profile-edit surface.

## Completed prerequisites (2026-05-14)

- **[[../../50_product/questions-profile-vs-session-split|50_product/questions-profile-vs-session-split.md]]** written — the #9 decision note recording the split rule (identity/body/values vs right-now context), the P/S tagging, the v1.1 deferrals (distance, time), and the future passive-learning direction.
- 11 issues published to vault + GitHub (#41–#51); see [[#Published issues]] for the table.
