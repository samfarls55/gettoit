---
date: 2026-05-26
type: workflow-review
scope: whole app (iOS + web)
hub: gti-vault/30_design/interaction-patterns/
mode: audit
---

# Workflow review — whole app — 2026-05-26

Surfaces audited:

**iOS** (Mobile overlay applied to all)
- `ios/Sources/App/SignInScreen.swift` — Do (auth gate)
- `ios/Sources/App/LocationPermissionScreen.swift` — Entry (pre-prime)
- `ios/Sources/App/LockedScreen.swift` — Entry/state (locked-state landing)
- `ios/Sources/App/PlanListScreen.swift` — Overview (S00 post-sign-in default)
- `ios/Sources/App/SetupScreen.swift` — Do + Form (Plan create/edit)
- `ios/Sources/App/QuizScreen.swift` + `QuizChromeView.swift` — Do (wizard)
- `ios/Sources/App/PostQuizHostScreen.swift` — Do (post-Q5 router)
- `ios/Sources/App/JoinScreen.swift` — Do (deep-link join)
- `ios/Sources/App/RerollScreen.swift` — Do (sheet)
- `ios/Sources/App/CheckinScreen.swift` — Do
- `ios/Sources/App/VerdictScreen.swift` — Focus (5 modes)
- `ios/Sources/App/WaitingScreen.swift` — Focus (transient)
- `ios/Sources/App/SettingsScreen.swift` — Settings

**Web**
- `web/app/page.tsx` — Entry (marketing landing)
- `web/app/layout.tsx` — global shell
- `web/app/join/[roomId]/page.tsx` — Entry + Do (universal-link fallback)
- `web/app/s/[sessionId]/page.tsx` — Focus + Do (session share landing)
- `web/app/places-fallback/page.tsx` — Focus (error state)
- `web/app/privacy/page.tsx` — Focus (legal)
- `web/app/terms/page.tsx` — Focus (legal)

---

## Findings

### S1 — Cognition

1. [S1] [Route: grill] **VerdictScreen — 5-mode branching crosses Focus single-intent boundary**
    Foundation/Pattern: [[principles#P-01. Safe Exploration]], [[surfaces#Focus]], [[patterns#Center Stage]]
    Why this route: Re-scope question, not pattern swap. `.default` / `.committed` / `.readOnly` / `.solo` / `.noSurvivor` each suppress different chrome (Home, ratify, reroll, breadcrumbs) and re-shape the CTA dock; the surface aspires to be 5 surfaces in one enum. Splitting is an IA decision.
    Grill seed:
      Conflict: hub says one screen = one intent; VerdictScreen carries 5 mode-specific layouts with mutually exclusive affordances (read-only suppresses Home + reroll; no-survivor suppresses ratify; solo suppresses ratify; committed suppresses ratify+reroll).
      Term to sharpen: is "verdict" one Focus surface, or is it Focus (default/committed/solo) + read-only-Focus (late-joiner/joined/history) + no-quorum-Focus (separate intent)?
      Starter question: which mode pairs collapse safely and which need to split out — and what does that mean for `VerdictRerollHost` callers?

2. [S1] [Route: grill] **web/app/page.tsx — placeholder "Coming soon" violates P-02 (Entry) before public launch**
    Foundation/Pattern: [[principles#P-02. Instant Gratification]], [[surfaces#Entry]], [[patterns#Clear Entry Points]]
    Why this route: pre-public-launch milestone scope decision. Replacing or holding the placeholder is a product call, not a pattern swap. Cross-references [[project_pre_public_launch_milestone]].
    Grill seed:
      Conflict: marketing root must deliver value or skip-to-app affordance before sign-up wall; current root is a static placeholder with no Clear Entry Points.
      Term to sharpen: is `/` an Entry surface (real landing) or a Redirect surface (Universal-Link fallback only)?
      Starter question: what does a first-time visitor on getttoit.app see before public launch — and does that change after launch?

3. [S1] [Route: grill] **PlanListScreen — no global navigation model, no [[patterns#Bottom Navigation]]**
    Foundation/Pattern: [[principles#P-09. Spatial Memory]], [[surfaces#Mobile overlay]], [[surfaces#Navigation models]]
    Why this route: navigation-model decision. Could be intentional "Flat" (per [[surfaces#Navigation models]]) for a single-purpose app; or could be a gap once Settings + Profile + Help land. Cannot pattern-swap without a model choice.
    Grill seed:
      Conflict: Mobile overlay flags Bottom Navigation as required for "top-level sections within thumb reach"; PlanList is the only post-sign-in surface and has none.
      Term to sharpen: is the app Hub-and-Spoke from PlanList, or Flat with one surface, or about-to-become Multilevel as Settings + History entries land?
      Starter question: which destinations need to be one tap from PlanList today vs in v1.1 — and which nav model fits that set?

4. [S1] [Route: grill] **PlanListScreen — no Feature/Search/Browse, no Dynamic Queries on a multi-section Overview**
    Foundation/Pattern: [[principles#P-03. Satisficing]], [[surfaces#Overview]], [[patterns#Feature, Search, and Browse]], [[patterns#Dynamic Queries]]
    Why this route: depends on expected list cardinality. With ~5 pending plans search is overkill; with 50+ history rows it's required. Re-scope, not swap.
    Grill seed:
      Conflict: Overview playbook lists Feature/Search/Browse as required; PlanList has 4 sections (Pending Created / Pending Joined / Decided / History) and no search, sort, or filter.
      Term to sharpen: what is the steady-state row count per section for a year-1 user — and at what threshold does History need Jump to Item / search?
      Starter question: should History be a separate Multilevel destination instead of a fourth section on PlanList?

5. [S1] [Route: grill] **WaitingScreen — no session-ended / verdict-fired-externally state handler**
    Foundation/Pattern: [[principles#P-04. Changes in Midstream]], [[surfaces#Focus]]
    Why this route: state-machine question. If another device fires the verdict, or the room is closed by the creator's delete (tb-WF-9), this surface needs an explicit transition. Decision affects QuizScreen + JoinScreen too.
    Grill seed:
      Conflict: tb-WF-9 introduced room-expire-on-delete; WaitingScreen has no documented error/closed boundary so a joiner mid-wait when the creator deletes the plan currently has undefined behaviour.
      Term to sharpen: who owns the "session ended while waiting" transition — coordinator, screen, or RootView precedence chain?
      Starter question: what does the joiner see at the millisecond the room flips to expired — and where does that copy live?

### S2 — Visual / System

6. [S2] [Route: issue] **SettingsScreen has no UI entry point anywhere in the app**
    Foundation/Pattern: [[principles#P-07. Habituation]], [[surfaces#Settings]] anti-pattern "Mobile app with no Settings screen at all", [[patterns#Sign-In Tools]]
    Why this route: one-pattern swap — wire a Sign-In Tools / chrome menu entry on PlanList. RootView.swift:71-79 already documents the gap.
    Issue draft:
      Title: Wire SettingsScreen entry from PlanList chrome
      Type: AFK
      Blocked by: None
      What to build: Add an account/gear chrome glyph to PlanListScreen top-trailing (or hamburger-style menu). Tap flips `showingSettings = true` on RootView. SettingsScreen continues to render via the existing precedence chain. No SettingsScreen body changes required.
      Acceptance criteria:
        - [ ] Top-trailing chrome glyph visible on PlanListScreen.
        - [ ] Tap routes to SettingsScreen via existing `showingSettings` state.
        - [ ] Done returns to PlanList.
        - [ ] Snapshot test on PlanListScreen covers chrome glyph render.
      Hub anchors: [[patterns#Sign-In Tools]], [[surfaces#Settings]], [[principles#P-07. Habituation]]

7. [S2] [Route: issue] **SettingsScreen — destructive DELETE button visually dominates DONE**
    Foundation/Pattern: [[principles#V-01. Visual hierarchy]], [[surfaces#Settings]] gate "destructive actions visually separated from cosmetic ones"
    Why this route: visual-hierarchy tweak; one button swap.
    Issue draft:
      Title: Demote SettingsScreen DELETE pill to destructive style
      Type: AFK
      Blocked by: None
      What to build: Restyle DELETE MY DATA from white-pill primary (line 127-129) to destructive style (red outline or text-only); promote DONE to primary pill. Keep existing two-step confirm alert.
      Acceptance criteria:
        - [ ] DELETE renders in destructive style per `design-system/components.md`.
        - [ ] DONE is the visually dominant primary.
        - [ ] Snapshot test on SettingsScreen render covers new hierarchy.
      Hub anchors: [[patterns#Settings Editor]], [[principles#V-01. Visual hierarchy]]

8. [S2] [Route: issue] **LocationPermissionScreen — two CTAs share equal visual weight**
    Foundation/Pattern: [[principles#V-01. Visual hierarchy]], [[principles#P-03. Satisficing]], [[surfaces#Entry]]
    Why this route: visual tweak.
    Issue draft:
      Title: Distinguish primary vs secondary CTA on LocationPermissionScreen
      Type: AFK
      Blocked by: None
      What to build: Promote "Share my location" to primary pill (existing white pill); demote "Enter manually" to secondary text button. Both CTAs currently render in the same pill style.
      Acceptance criteria:
        - [ ] Primary/secondary distinction visible.
        - [ ] Snapshot test covers both states.
      Hub anchors: [[principles#V-01. Visual hierarchy]], [[patterns#Clear Entry Points]]

9. [S2] [Route: issue] **SetupScreen — disabled CTA uses opacity only**
    Foundation/Pattern: [[principles#V-01. Visual hierarchy]], [[principles#V-02. Color]], [[surfaces#Form]]
    Why this route: a11y + visual tweak.
    Issue draft:
      Title: Add text+icon affordance to SetupScreen disabled CTA
      Type: AFK
      Blocked by: None
      What to build: When primary CTA is disabled (lines 628, 644, 656, 664), swap label to "Name required" or add a small disabled icon — opacity-only fails for low-vision and colorblind users.
      Acceptance criteria:
        - [ ] Disabled CTA carries a visible label change or icon.
        - [ ] Snapshot test covers disabled + enabled states.
      Hub anchors: [[principles#V-02. Color]], [[surfaces#Form]]

10. [S2] [Route: issue] **web/app/layout.tsx — no global footer, no Help affordance**
     Foundation/Pattern: [[principles#S-01. Consistency]], [[patterns#Help Systems]]
     Why this route: system-level consistency; one shared layout edit.
     Issue draft:
       Title: Add global footer with Privacy/Terms/Help links to web layout
       Type: AFK
       Blocked by: [[project_support_email_todo]]
       What to build: Add a global `<footer>` to `web/app/layout.tsx` with links to `/privacy`, `/terms`, and a `mailto:support@gettoit.app` (or whatever the resolved support address is). Footer renders on every page including legal pages and terminal join states.
       Acceptance criteria:
         - [ ] Footer visible on every web route.
         - [ ] Links resolve correctly on `/`, `/privacy`, `/terms`, `/join/[roomId]`, `/s/[sessionId]`, `/places-fallback`.
         - [ ] Footer collapses gracefully on mobile widths.
       Hub anchors: [[patterns#Help Systems]], [[principles#S-01. Consistency]]

11. [S2] [Route: issue] **PlanListScreen — no Loading/Progress Indicator on initial fetch + refresh**
     Foundation/Pattern: [[surfaces#Mobile overlay]], [[patterns#Loading or Progress Indicators]]
     Why this route: one-pattern add.
     Issue draft:
       Title: Add Loading/Progress signal to PlanListScreen sections
       Type: AFK
       Blocked by: None
       What to build: PlanListScreen renders empty rows during `refreshPlanList` (RootView line 576 `.task`). Add skeleton rows or section-level ProgressView while any of the four fetch tasks is in-flight on first mount.
       Acceptance criteria:
         - [ ] Skeleton / spinner renders during cold load.
         - [ ] No skeleton on hot reload (cached rows already on screen).
         - [ ] Snapshot test covers loading state.
       Hub anchors: [[patterns#Loading or Progress Indicators]], [[surfaces#Mobile overlay]]

### S3 — Pattern misuse / missing pattern

12. [S3] [Route: issue] **LockedScreen — no Escape Hatch from terminal state**
     Foundation/Pattern: [[patterns#Escape Hatch]], [[surfaces#Entry]], [[principles#P-01. Safe Exploration]]
     Why this route: one-pattern add.
     Issue draft:
       Title: Add Home/Back affordance to LockedScreen
       Type: AFK
       Blocked by: None
       What to build: LockedScreen renders the verdict-locked state with no path back to PlanList. Add a top-leading or footer "Home" affordance that routes to the post-sign-in PlanList.
       Acceptance criteria:
         - [ ] Home/Back affordance visible on LockedScreen.
         - [ ] Tap dismisses LockedScreen and returns to PlanList via the RootView precedence chain.
         - [ ] Snapshot test covers the new chrome.
       Hub anchors: [[patterns#Escape Hatch]], [[principles#P-01. Safe Exploration]]

13. [S3] [Route: issue] **PostQuizHostScreen — resolving spinner has no Escape Hatch**
     Foundation/Pattern: [[patterns#Escape Hatch]], [[surfaces#Do]]
     Why this route: one-pattern add on transient state.
     Issue draft:
       Title: Add Cancel affordance to PostQuizHost resolving phase
       Type: AFK
       Blocked by: None
       What to build: While the post-Q5 router polls `verdicts`, the user is trapped on a spinner. Add a "Cancel" or "Back to plan" affordance (top-trailing) that fires `host.teardown()` + clears `postQuizHost`.
       Acceptance criteria:
         - [ ] Cancel affordance visible during `.resolving` phase.
         - [ ] Tap returns to PlanList without firing the verdict.
         - [ ] Snapshot test covers the resolving phase with chrome.
       Hub anchors: [[patterns#Escape Hatch]], [[principles#P-01. Safe Exploration]]

14. [S3] [Route: issue] **JoinScreen — joining spinner has no Cancel; error state has no Back**
     Foundation/Pattern: [[patterns#Escape Hatch]], [[patterns#Error Messages]]
     Why this route: one-pattern add per phase.
     Issue draft:
       Title: Add Cancel to JoinScreen joining + Back to error phase
       Type: AFK
       Blocked by: None
       What to build: `.joining` phase shows a progress spinner with no abort path; `.error` phase shows a message with no back/retry link. Add a "Cancel" affordance during joining and a "Go back" link on error.
       Acceptance criteria:
         - [ ] Cancel affordance visible during `.joining`.
         - [ ] Back / "Try another link" visible on `.error`.
         - [ ] Cancel clears `deepLink` and returns to PlanList.
       Hub anchors: [[patterns#Escape Hatch]], [[patterns#Error Messages]]

15. [S3] [Route: issue] **CheckinScreen — no Cancel on choice surface**
     Foundation/Pattern: [[patterns#Escape Hatch]]
     Why this route: one-pattern add.
     Issue draft:
       Title: Add Cancel affordance to CheckinScreen choice phase
       Type: AFK
       Blocked by: None
       What to build: Before the user taps a checkin outcome, there is no path to abandon. Add a top-leading "Cancel" chrome glyph.
       Acceptance criteria:
         - [ ] Cancel visible on choice phase.
         - [ ] Tap dismisses without writing a checkin.
       Hub anchors: [[patterns#Escape Hatch]]

16. [S3] [Route: issue] **VerdictScreen `.readOnly` mode suppresses Home chrome**
     Foundation/Pattern: [[patterns#Escape Hatch]], [[surfaces#Focus]]
     Why this route: late-joiner deep-link arrival has nowhere to go. One-pattern add, partly entangled with finding #1 (mode-split).
     Issue draft:
       Title: Restore Escape affordance on VerdictScreen .readOnly
       Type: AFK
       Blocked by: 1
       What to build: `.readOnly` currently hides the Home chrome row (VerdictScreen.swift:391-413). Add a "Close" or "Done" affordance that fires the existing `onAdvance` callback — for the late-joiner branch this opens Solo Setup (the existing re-invite CTA), but the chrome should be visible regardless.
       Acceptance criteria:
         - [ ] `.readOnly` mode renders a Close/Done affordance.
         - [ ] Tap fires `onAdvance`.
         - [ ] Snapshot test covers `.readOnly` render with chrome.
       Hub anchors: [[patterns#Escape Hatch]], [[surfaces#Focus]]

17. [S3] [Route: issue] **WaitingScreen — initiator has no Leave affordance**
     Foundation/Pattern: [[patterns#Escape Hatch]]
     Why this route: one-pattern add (consider feasibility with state machine).
     Issue draft:
       Title: Add initiator Leave path on WaitingScreen
       Type: AFK
       Blocked by: 5
       What to build: Once the initiator has submitted Q5 and lands on Waiting, there is no path to back out. Add a chrome Leave button that triggers room-expire (existing `MemberLeaveStore` path) and returns to PlanList.
       Acceptance criteria:
         - [ ] Leave chrome visible on WaitingScreen for initiator role.
         - [ ] Tap expires the room and routes back to PlanList.
         - [ ] Snapshot test covers chrome present + tap behaviour.
       Hub anchors: [[patterns#Escape Hatch]], [[principles#P-01. Safe Exploration]]

18. [S3] [Route: issue] **Web — global logo not clickable as home link**
     Foundation/Pattern: [[patterns#Escape Hatch]], [[principles#P-07. Habituation]]
     Why this route: one-edit add in shared shell.
     Issue draft:
       Title: Wrap GTIMark logo as Link to /
       Type: AFK
       Blocked by: None
       What to build: Make the GTIMark / logo a `<Link href="/">` in the shared layout. Currently the logo is non-interactive on every web surface.
       Acceptance criteria:
         - [ ] Logo is a clickable link to `/` on every web route.
         - [ ] Visual style unchanged.
       Hub anchors: [[patterns#Escape Hatch]], [[principles#P-07. Habituation]]

19. [S3] [Route: issue] **web/app/privacy + terms — no in-page back-to-home**
     Foundation/Pattern: [[patterns#Escape Hatch]]
     Why this route: one-pattern add (overlaps with #18 — if the logo is a home link, this folds into that).
     Issue draft:
       Title: Add home link to privacy + terms pages
       Type: AFK
       Blocked by: 18
       What to build: If finding #18 ships, the global logo home link covers both. If shipping #18 is deferred, add an explicit "Back to home" link at the top of `web/app/privacy/page.tsx` and `web/app/terms/page.tsx`.
       Acceptance criteria:
         - [ ] Either logo-as-home-link or in-page home link is visible on both pages.
       Hub anchors: [[patterns#Escape Hatch]]

20. [S3] [Route: issue] **web/app/join terminal screens — no home link**
     Foundation/Pattern: [[patterns#Escape Hatch]]
     Why this route: one-pattern add on `PlanClosedTerminal` / `PlanLeftTerminal`.
     Issue draft:
       Title: Add home link to InviteShell terminal states
       Type: AFK
       Blocked by: 18
       What to build: After a join attempt resolves to closed/left, the user is stranded with no navigation. Add a "Back to GetToIt" link to terminal states inside `InviteShell`.
       Acceptance criteria:
         - [ ] Home link visible on closed terminal.
         - [ ] Home link visible on left terminal.
       Hub anchors: [[patterns#Escape Hatch]]

21. [S3] [Route: issue] **SignInScreen — claim-code affordance buried**
     Foundation/Pattern: [[patterns#Clear Entry Points]], [[principles#V-01. Visual hierarchy]]
     Why this route: one visual swap; secondary CTA promotion.
     Issue draft:
       Title: Promote claim-code affordance on SignInScreen
       Type: AFK
       Blocked by: None
       What to build: The claim-code path renders as a quiet eyebrow-token link under the Apple pill. Promote it to a clearly secondary action so users with an existing code can find it without scanning the page.
       Acceptance criteria:
         - [ ] Claim affordance renders as a labeled secondary button or chip.
         - [ ] Snapshot test covers both Apple-only and Apple+claim renders.
       Hub anchors: [[patterns#Clear Entry Points]]

22. [S3] [Route: issue] **QuizScreen — Progress Indicator capsules lack step labels**
     Foundation/Pattern: [[patterns#Progress Indicator]], [[surfaces#Do]]
     Why this route: one-pattern add.
     Issue draft:
       Title: Add Q1..Q5 labels to QuizScreen progress capsules
       Type: AFK
       Blocked by: None
       What to build: The progress strip (QuizScreen.swift:184-201) animates fill state but the capsules are visual-only. Add "Q1 of 5" / step-number labels adjacent to or inside the row so screen readers and sighted users get position.
       Acceptance criteria:
         - [ ] Step indicator carries human-readable text.
         - [ ] VoiceOver reads "Question N of 5".
         - [ ] Snapshot test covers Q1..Q5.
       Hub anchors: [[patterns#Progress Indicator]]

23. [S3] [Route: issue] **QuizScreen — Q5 final CTA label is the generic "Next"**
     Foundation/Pattern: [[patterns#Prominent "Done" Button or Assumed Next Step]]
     Why this route: one-string + visual swap.
     Issue draft:
       Title: Label Q5 final CTA as "Get Verdict" / "Submit"
       Type: AFK
       Blocked by: None
       What to build: On Q5 the primary CTA renders the same Next button as Q1..Q4. Switch to a finish-shaped label ("Get Verdict" or copy from `40_marketing_branding/`) so the final step reads as terminal.
       Acceptance criteria:
         - [ ] Q5 primary CTA copy differs from Q1..Q4.
         - [ ] Copy reviewed against marketing voice doc.
         - [ ] Snapshot test covers Q5 CTA render.
       Hub anchors: [[patterns#Prominent "Done" Button or Assumed Next Step]]

24. [S3] [Route: issue] **SetupScreen — Form Input Hints missing on name, distance, location**
     Foundation/Pattern: [[patterns#Input Hints]], [[surfaces#Form]]
     Why this route: one-pattern add across three fields.
     Issue draft:
       Title: Add Input Hints to SetupScreen name, distance, location
       Type: AFK
       Blocked by: None
       What to build:
         - Name field: visible character limit (e.g., "40 chars").
         - Distance slider: unit suffix ("mi") on the value label.
         - Location field: mark optional with a hint ("Optional - we'll prompt later").
       Acceptance criteria:
         - [ ] Each field carries a visible hint without focus.
         - [ ] Hints persist after the user types.
       Hub anchors: [[patterns#Input Hints]]

25. [S3] [Route: issue] **SetupScreen — errors rendered top-of-dock, not field-local**
     Foundation/Pattern: [[patterns#Error Messages]], [[surfaces#Form]]
     Why this route: one-pattern correction.
     Issue draft:
       Title: Move SetupScreen errors to field-level
       Type: AFK
       Blocked by: None
       What to build: SetupScreen.swift:616-621 renders a single error string at the top of the dock for both Save and Launch failures. Render errors inline beneath the field that failed, or scroll the failing field into view with localised copy.
       Acceptance criteria:
         - [ ] Field-local error rendering on invalid name, invalid distance.
         - [ ] Top-of-dock error reserved for cross-field / network failures.
         - [ ] Snapshot test covers error placement.
       Hub anchors: [[patterns#Error Messages]]

26. [S3] [Route: issue] **SetupScreen — name field uses placeholder-as-label (anti-pattern)**
     Foundation/Pattern: [[patterns#Input Prompt]], [[surfaces#Form]] anti-pattern "Placeholder text used as the only label"
     Why this route: anti-pattern hit; one fix.
     Issue draft:
       Title: Add persistent label to SetupScreen name field
       Type: AFK
       Blocked by: None
       What to build: SetupScreen.swift:484-502 uses the prompt as the only label. Once the user starts typing the label disappears. Add a persistent floating label or a static label above the field.
       Acceptance criteria:
         - [ ] Label persists during and after typing.
         - [ ] VoiceOver reads the label.
         - [ ] Snapshot test covers empty + typed states.
       Hub anchors: [[patterns#Input Prompt]]

27. [S3] [Route: issue] **WaitingScreen — no Loading/Progress signal during initial chip-phase load**
     Foundation/Pattern: [[patterns#Loading or Progress Indicators]], [[surfaces#Mobile overlay]]
     Why this route: one-pattern add.
     Issue draft:
       Title: Add Loading indicator to WaitingScreen chip-phase load
       Type: AFK
       Blocked by: None
       What to build: The `.loading` chip phase (WaitingScreen.swift:100-151) currently renders nothing. Add a ProgressView or subtle skeleton so the surface signals "data coming" instead of looking dead.
       Acceptance criteria:
         - [ ] ProgressView or skeleton visible during `.loading`.
         - [ ] Snapshot test covers loading state.
       Hub anchors: [[patterns#Loading or Progress Indicators]]

28. [S3] [Route: issue] **PlanListScreen — Action Dot Menu has no discoverability affordance**
     Foundation/Pattern: [[patterns#Touch Tools]], [[surfaces#Mobile overlay]]
     Why this route: one-pattern add or visual hint.
     Issue draft:
       Title: Improve Action Dot Menu discoverability on PlanListScreen
       Type: AFK
       Blocked by: None
       What to build: The Action Dot Menu (three-dot affordance on Pending Created cards) is currently invisible until tapped. Either raise its visual weight (slightly higher contrast / dedicated chrome glyph), or add a long-press affordance with a visible hint on first launch.
       Acceptance criteria:
         - [ ] Dot menu visually distinct on every Created card.
         - [ ] First-launch hint or improved icon contrast.
       Hub anchors: [[patterns#Touch Tools]]

29. [S3] [Route: issue] **SettingsScreen — "DONE" label + center placement breaks iOS habituation**
     Foundation/Pattern: [[principles#P-07. Habituation]], [[surfaces#Settings]]
     Why this route: one-pattern correction.
     Issue draft:
       Title: Switch SettingsScreen DONE to iOS top-left close convention
       Type: AFK
       Blocked by: 6, 7
       What to build: Replace the bottom-center plain-text "DONE" with a top-leading X icon (or "Close") matching iOS sheet dismissal convention. Combine with #7 (DELETE demotion).
       Acceptance criteria:
         - [ ] Top-leading close affordance.
         - [ ] Tap dismisses sheet.
         - [ ] Bottom-center DONE removed.
       Hub anchors: [[principles#P-07. Habituation]], [[surfaces#Settings]]

30. [S3] [Route: issue] **web/app/join — no Help Systems / FAQ on name entry**
     Foundation/Pattern: [[patterns#Help Systems]]
     Why this route: one-pattern add.
     Issue draft:
       Title: Add Help affordance to InviteShell name entry
       Type: AFK
       Blocked by: 10
       What to build: New invitees arriving at `/join/[roomId]` see only a name field + Join button. Add a "What is GetToIt?" or "Help" inline link near the form. Folds into #10 if the global footer ships.
       Acceptance criteria:
         - [ ] Help affordance visible on NameEntry surface.
       Hub anchors: [[patterns#Help Systems]]

31. [S3] [Route: issue] **web/app/places-fallback — "open the app on iOS" copy without App Store link**
     Foundation/Pattern: [[patterns#Help Systems]], [[patterns#Richly Connected Apps]]
     Why this route: one-link add.
     Issue draft:
       Title: Add App Store link to places-fallback install copy
       Type: AFK
       Blocked by: None
       What to build: places-fallback page line ~35 mentions "open the GetToIt app on iOS" but does not link to the App Store. Add the App Store URL inline.
       Acceptance criteria:
         - [ ] App Store link is the "iOS" word or a dedicated CTA.
         - [ ] Link opens the App Store on mobile, the App Store web page on desktop.
       Hub anchors: [[patterns#Help Systems]], [[patterns#Richly Connected Apps]]

### B-tier (beyond-the-screen)

32. [B] [Route: grill] **SignInScreen — claim-code field keyboard focus indicator**
     Foundation/Pattern: [[principles#B-04. Natural user interfaces]], [[principles#P-12. Keyboard Only]]
     Why this route: keyboard-only behaviour on iOS hardware-keyboard / iPad is rare today but covered by hub gate. Decision: does v1 need keyboard-only path or punt to post-launch?
     Grill seed:
       Conflict: hub Form gate P-12 requires every field reachable + visible focus ring; SignInScreen claim-code field has no documented focus ring.
       Term to sharpen: scope — is the iOS app expected to support a hardware keyboard before public launch?
       Starter question: which iPad / hardware-keyboard scenarios are in scope for v1.1, if any?

---

## Summary

**Systemic vs one-off**

- *Systemic — Escape Hatch missing.* Findings #12, #13, #14, #15, #16, #17, #18, #19, #20 all hit the same anti-pattern across LockedScreen, PostQuizHost, JoinScreen, CheckinScreen, VerdictScreen `.readOnly`, WaitingScreen, plus three web surfaces. The app systematically traps users on transient and terminal screens. Issue #18 (clickable logo) folds #19 and #20 into one fix on the web side; the iOS instances are individual screen-by-screen wires.
- *Systemic — multi-intent collapse.* Findings #1 (VerdictScreen 5 modes) and to a lesser extent SetupScreen's Do+Form blend show one screen carrying multiple intents. Likely needs explicit splits, not pattern swaps.
- *Systemic — Mobile overlay loading/progress.* Findings #11 (PlanList) and #27 (WaitingScreen) both miss the required Loading pattern.
- *One-off — Settings discoverability.* Finding #6 is the load-bearing system-level gap (mobile app with no Settings entry).
- *One-off — web placeholder.* Finding #2 (`/` is "Coming soon") is a pre-launch product decision distinct from the rest.

**Routing counts**

- 7 grill / 25 issue (32 total). 24 issue findings carry a draft; finding #19 is conditional on #18.

---

## Hand off

Hand this file path to a new session running:

- `/grill-with-docs` for findings #1, #2, #3, #4, #5, #32 (the cognition + nav-model + state-machine + scope grills).
- `/to-issues` for findings #6..#31 (the 24 pattern-swap issues; the 25th is conditional via the `Blocked by` chain).
