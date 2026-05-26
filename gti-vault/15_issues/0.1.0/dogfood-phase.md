---
folder: 15_issues/0.1.0
purpose: 0.1.0 dogfood phase (formerly the "v1.1" batch) — 2026-05-14 TestFlight dogfood follow-ups (bugs, spec-gaps, surface wiring) + the 2026-05-15 quiz-redesign & verdict-engine PRD build slices
status: see entries below — phase contains the dogfood batch, quiz-redesign batch, Q5-wiring batch, premium-data follow-ups, post-Q5 router fix, verdict-pipeline integration, candidate-pool floor, verdict-spinner diagnosis, solo-session post-mortem, AFK-run follow-ups, and UI dogfood batch
---

# 0.1.0 dogfood phase — Dogfood follow-ups

> Previously labeled the `v1.1` batch. Renamed 2026-05-25 — collapsed into the 0.1.0 pre-launch cycle.

Post-build feedback against the 0.1.0 TestFlight build, captured during the first real-device install on 2026-05-14. Source raw note: [[testflight-first-dogfood-2026-05-14|testflight-first-dogfood-2026-05-14]] (lives in the 0.1.0/ folder after compile).

## Framing

These items are follow-ups to the PRD phase, not part of the original [[../../10_prds/0.1.0-prd|0.1.0 PRD]]. The PRD phase is feature-complete (TB-00 → TB-17 ✅); the dogfood phase captures defects and gaps surfaced once the build was on a real device.

**State as of 2026-05-14:** the original 11 candidates were grilled, split, and published. Three artifact kinds in the dogfood phase (`bug` is new; `spec-gap` and `tracer-bullet` carry over from the PRD phase). Three candidates do not appear as dogfood issues — #2b and #10 deferred to the pre-public-launch milestone, #11 withdrawn (folded into [[issues/sg-02-landing-page-surface|sg-02]]).

## Published issues

### Bugs

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| bug-01 | [[issues/bug-01-invite-link-404\|Invite link 404 + AASA regression test]] ✅ done | AFK | [#41](https://github.com/samfarls55/gettoit/issues/41) | — |
| bug-02 | [[issues/bug-02-static-og-image-placeholder\|Static placeholder OG image + meta tags]] ✅ done | AFK | [#42](https://github.com/samfarls55/gettoit/issues/42) | — |
| bug-03 | [[issues/bug-03-q5-placeholder-no-foursquare-calls\|Q5 placeholders, zero Foursquare calls — wire PlacesService into Q5]] ✅ done | AFK | [#43](https://github.com/samfarls55/gettoit/issues/43) | — |
| bug-04 | [[issues/bug-04-question-transition-motion-lag\|Question transition motion lag]] ✅ done | AFK | [#44](https://github.com/samfarls55/gettoit/issues/44) | — |
| bug-05 | [[issues/bug-05-info-plist-missing-location-purpose-string\|Info.plist missing NSLocationWhenInUseUsageDescription — ITMS-90683 on build 125]] — fixed-in-branch (not filed to GitHub) | AFK | — | — |
| bug-06 | [[issues/bug-06-legacy-anon-bypasses-s00a-gate\|Legacy anonymous session bypasses S00a sign-in gate on launch]] ✅ done | AFK | [#63](https://github.com/samfarls55/gettoit/issues/63) | — |
| bug-07 | [[issues/bug-07-post-q5-router-unwired\|Quiz submit dead-ends to landing — post-Q5 router (S04/S05) unwired]] ✅ closed — decomposed into tb-19/tb-20 | HITL | [#109](https://github.com/samfarls55/gettoit/issues/109) | — |
| bug-08 | [[issues/bug-08-verdict-pipeline-integration-unwired\|Verdict never computes — candidate-pool + preference-scoring integration unwired]] ✅ closed — fork decided (Option 2, server-side); decomposed into tb-21/tb-22/tb-23 | HITL | [#116](https://github.com/samfarls55/gettoit/issues/116) | — |
| bug-09 | [[issues/bug-09-verdict-fire-dispatch-guc-noop\|Verdict engine never auto-invoked — dispatch no-ops on unset app.* DB GUCs]] ✅ done — `app_config` table replaces the `app.*` GUCs | AFK | [#117](https://github.com/samfarls55/gettoit/issues/117) | — |
| bug-10 | [[issues/bug-10-verdict-poll-no-timeout\|Post-Q5 "Lining Up the Verdict" spinner hangs forever — poll has no timeout]] ✅ done — `VerdictPoller` bounded, PR #122 | AFK | [#118](https://github.com/samfarls55/gettoit/issues/118) | — |
| bug-11 | [[issues/bug-11-fixture-factories-in-app-target\|Move snapshot/preview fixture factories out of the iOS app target]] ✅ done | AFK | [#140](https://github.com/samfarls55/gettoit/issues/140) | — |
| bug-16 | [[issues/bug-16-checkin-snooze-terminal-row\|Check-in "Ask me later" writes a terminal row; the real outcome can never be reported]] — needs-triage | HITL | [#197](https://github.com/samfarls55/gettoit/issues/197) | — |

(bug-12–bug-15 and bug-17–bug-19 are filed in dated sections below — Verdict-spinner diagnosis, Solo-session post-mortem, AFK-run follow-ups.)

### Spec gaps

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| sg-01 | [[issues/sg-01-on-gradient-subheader-contrast\|On-gradient subheader contrast token fix]] ✅ done | AFK | [#45](https://github.com/samfarls55/gettoit/issues/45) | — |
| sg-02 | [[issues/sg-02-landing-page-surface\|Landing page surface (two-button)]] ✅ done | AFK | [#46](https://github.com/samfarls55/gettoit/issues/46) | — |
| sg-03 | [[issues/sg-03-account-creation-surfaces\|Forced first-launch sign-in + waiting-screen download CTA]] ✅ done | AFK | [#47](https://github.com/samfarls55/gettoit/issues/47) | — |
| sg-04 | [[issues/sg-04-geo-permission-and-location-selector\|Geo permission + location selector — C-23 LocationPicker]] ✅ done | AFK | [#48](https://github.com/samfarls55/gettoit/issues/48) | — |

### Tracer-bullet build slices

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-01 (dogfood) | [[issues/tb-01-landing-page-wire\|Wire landing surface into iOS]] ✅ done | AFK | [#49](https://github.com/samfarls55/gettoit/issues/49) | sg-02 |
| TB-02 (dogfood) | [[issues/tb-02-account-creation-wire\|Wire forced sign-in (iOS) + waiting-screen CTA (web)]] ✅ done | AFK | [#50](https://github.com/samfarls55/gettoit/issues/50) | sg-03 |
| TB-03 (dogfood) | [[issues/tb-03-geo-permission-and-location-selector-wire\|Wire geo permission + location selector]] ✅ done | AFK | [#51](https://github.com/samfarls55/gettoit/issues/51) | sg-04 |

## Quiz redesign & verdict engine (PRD 2026-05-15)

Build slices decomposed from [[../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] via `/to-issues` on 2026-05-15. Vertical capability slices — all AFK. Canonical design record: [[../../50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]].

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| research-01 | [[issues/research-01-foursquare-filter-surface\|Foursquare filter-surface + venue-metadata research]] ✅ done | AFK | [#64](https://github.com/samfarls55/gettoit/issues/64) | — |
| tb-04 | [[issues/tb-04-votes-jsonb-schema\|Generic votes Q1..Q5 jsonb schema + engine mapping layer]] ✅ done | AFK | [#65](https://github.com/samfarls55/gettoit/issues/65) | — |
| tb-05 | [[issues/tb-05-pre-quiz-parameters-surface\|Pre-quiz parameters setup surface]] ✅ done | AFK | [#66](https://github.com/samfarls55/gettoit/issues/66) | tb-04 |
| tb-06 | [[issues/tb-06-quiz-q1-q4-rework\|Quiz Q1-Q4 rework — four new input surfaces]] ✅ done | AFK | [#67](https://github.com/samfarls55/gettoit/issues/67) | tb-04 |
| tb-07 | [[issues/tb-07-per-member-foursquare-fetch\|Per-member real Foursquare fetch + Q1-Q4 trigger]] ✅ done | AFK | [#68](https://github.com/samfarls55/gettoit/issues/68) | research-01, tb-04, tb-06 |
| tb-08 | [[issues/tb-08-q5-factorial-probe\|Q5 factorial preference probe over real venues]] ✅ done | AFK | [#69](https://github.com/samfarls55/gettoit/issues/69) | research-01, tb-04, tb-07 |
| tb-09 | [[issues/tb-09-preference-function-axis-scorers\|Preference function + axis scorers]] ✅ done | AFK | [#70](https://github.com/samfarls55/gettoit/issues/70) | research-01, tb-08 |
| tb-10 | [[issues/tb-10-running-union-pool-manager\|Running-union candidate pool manager]] ✅ done | AFK | [#71](https://github.com/samfarls55/gettoit/issues/71) | tb-07, tb-09 |
| tb-11 | [[issues/tb-11-verdict-engine-rewrite\|Worst-off-protecting verdict engine rewrite]] ✅ done | AFK | [#72](https://github.com/samfarls55/gettoit/issues/72) | tb-04, tb-10 |
| tb-12 | [[issues/tb-12-profile-vetoes\|Profile vetoes — account allergy/dietary/NEVERS storage]] ✅ done | AFK | [#73](https://github.com/samfarls55/gettoit/issues/73) | tb-11 |
| tb-13 | [[issues/tb-13-verdict-firing-q5-complete\|Verdict firing on the new Q5-complete signal]] ✅ done | AFK | [#74](https://github.com/samfarls55/gettoit/issues/74) | tb-08, tb-11 |

## Q5 wiring + PlacesProxy fix (2026-05-16)

Decomposed via `/to-issues` after a Q5 diagnosis session. Two faults: PlacesProxy dark (deploy/secrets gap) and the new Q5 pipeline never wired in.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-14 (dogfood) | [[issues/tb-14-restore-placesproxy-foursquare-path\|Restore the PlacesProxy Foursquare path — deploy + secrets]] ✅ done | AFK | [#91](https://github.com/samfarls55/gettoit/issues/91) | — |
| TB-15 (dogfood) | [[issues/tb-15-wire-answer-tailored-fetch\|Wire the answer-tailored Foursquare fetch into the live quiz]] ✅ done | AFK | [#92](https://github.com/samfarls55/gettoit/issues/92) | — |
| TB-16 (dogfood) | [[issues/tb-16-q5-factorial-card-selection\|Q5 factorial card selection in the live quiz]] ✅ done | AFK | [#93](https://github.com/samfarls55/gettoit/issues/93) | TB-15 |
| TB-17 (dogfood) | [[issues/tb-17-edge-function-cuisine-tag\|Edge Function honors the cuisine advisory tag]] ✅ done | AFK | [#94](https://github.com/samfarls55/gettoit/issues/94) | — |

## Premium-data follow-ups (2026-05-17)

After the Foursquare account moved to a paid (credit-backed) plan, a session diagnosed the empty-`places` follow-up and audited whether premium fields could retrieve the Q1-Q4 quiz inputs better than the free-tier-era workarounds.

| # | Title | Type | GitHub | Status |
|---|---|---|---|---|
| research-02 (dogfood) | [[issues/research-02-tastes-vibe-token-allowlist\|Foursquare tastes vibe-token allowlist — sample + curate]] ✅ done | AFK | [#108](https://github.com/samfarls55/gettoit/issues/108) | done — PR #113 |
| TB-18 (dogfood) | [[issues/tb-18-q4-vibe-tastes-signal\|Q4 vibe energy from the Foursquare tastes signal]] ✅ done | AFK | [#102](https://github.com/samfarls55/gettoit/issues/102) | done — PR #114 |
| research-03 (dogfood) | [[issues/research-03-vibe-nudge-hit-rate\|Measure the vibe-token nudge hit-rate against the research-02 sample]] ✅ done | AFK | [#115](https://github.com/samfarls55/gettoit/issues/115) | done — fire-rate **46.3%** (505/1090) |

## Post-Q5 router fix (2026-05-18)

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-19 (dogfood) | [[issues/tb-19-solo-verdict-route\|Solo session reaches the verdict — post-Q5 router skeleton]] ✅ done | AFK | [#106](https://github.com/samfarls55/gettoit/issues/106) | — |
| TB-20 (dogfood) | [[issues/tb-20-group-waiting-route\|Group session shows S04 Waiting and advances to S05]] ✅ done | AFK | [#107](https://github.com/samfarls55/gettoit/issues/107) | TB-19 |

## Verdict-pipeline integration fix (2026-05-18)

Option 2 (server-side) — the union + preference-scoring runs server-side at verdict fire time; iOS writes only raw fetch results.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-21 (dogfood) | [[issues/tb-21-persist-fetch-server-union\|Persist raw per-member fetch; server unions it into `options` at fire time]] ✅ done | AFK | [#119](https://github.com/samfarls55/gettoit/issues/119) | — |
| TB-22 (dogfood) | [[issues/tb-22-port-preference-function-ts\|Port the preference function Swift → TypeScript]] ✅ done | AFK | [#120](https://github.com/samfarls55/gettoit/issues/120) | — |
| TB-23 (dogfood) | [[issues/tb-23-server-prefn-scoring\|Server-side prefFn scoring over the full union]] ✅ done | AFK | [#121](https://github.com/samfarls55/gettoit/issues/121) | TB-21, TB-22 |
| TB-24 (dogfood) | [[issues/tb-24-ios-q5-factorial-ratings-wire\|Wire iOS Q5 write path to emit factorial `{droppedAxis, score}` ratings]] ✅ done | AFK | [#130](https://github.com/samfarls55/gettoit/issues/130) | — |

## Candidate-pool floor (2026-05-19)

[[../../60_engineering/adr/0012-candidate-pool-floor|ADR 0012]] — the candidate-pool floor.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-25 (dogfood) | [[issues/tb-25-candidate-pool-floor\|Apply the candidate-pool floor — Restaurant + Sports Bar allowlist on every Foursquare call]] ✅ done | AFK | [#133](https://github.com/samfarls55/gettoit/issues/133) | — |

## Remove fictitious fallback venues (2026-05-19)

Decision: the app must never surface a made-up place. Q5 instead renders a `no-results` mode.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| sg-05 | [[issues/sg-05-q5-no-results-mode\|Q5 no-results mode — design-system surface spec]] ✅ done | AFK | [#136](https://github.com/samfarls55/gettoit/issues/136) | — |
| TB-26 (dogfood) | [[issues/tb-26-remove-fictitious-fallback-venues\|Remove fictitious fallback venues; render the Q5 no-results screen]] ✅ done | AFK | [#137](https://github.com/samfarls55/gettoit/issues/137) | sg-05 |

## Verdict-spinner diagnosis (2026-05-19)

`/diagnose` against TestFlight build 267 split "stuck at verdict" into **two independent defects** + a re-fire ops slice.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| bug-12 | [[issues/bug-12-verdict-spinner-orphaned-host\|Verdict screen never renders — double onSubmitted orphans the polling host]] — done (PR #147) | AFK | [#142](https://github.com/samfarls55/gettoit/issues/142) | — |
| bug-13 | [[issues/bug-13-engine-no-survivor-on-empty-pool\|Engine wedges the room on an empty candidate pool]] — done (PR #146) | AFK | [#143](https://github.com/samfarls55/gettoit/issues/143) | — |
| bug-14 | [[issues/bug-14-ios-verdict-fires-before-fetch-persisted\|iOS fires the verdict before the member's candidate fetch is persisted]] — done (PR #150) | AFK | [#144](https://github.com/samfarls55/gettoit/issues/144) | — |
| ops-01 | [[issues/ops-01-wedged-firing-rooms-cleanup\|Re-fire the rooms wedged in status='firing']] — done (PR #151) | AFK | [#145](https://github.com/samfarls55/gettoit/issues/145) | bug-13 |

### Solo-session post-mortem (2026-05-19 evening)

The ADR 0012 candidate-pool floor is a query-time OR allowlist; it cannot exclude a venue that *also* carries a floor-eligible category.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| bug-15 | [[issues/bug-15-pool-floor-allows-multicategory-bars\|Pool-floor allows multi-category bars; primary "Bar" leaks into verdict]] — done | AFK | [#152](https://github.com/samfarls55/gettoit/issues/152) | — |

## AFK-run follow-ups (2026-05-21)

The 2026-05-21-1812 AFK execution run surfaced three adjacencies its subagents flagged but did not fix:

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| bug-17 | [[issues/bug-17-web-verdict-surface-conformance\|Web verdict surface does not conform to locked web-01-invitee-shell §C]] ✅ done (PR #219) | AFK | [#207](https://github.com/samfarls55/gettoit/issues/207) | — |
| bug-18 | [[issues/bug-18-web-quiz-test-tsc-type-error\|tsc --noEmit type error in web/lib/quiz.test.ts is not CI-gated]] — done (PR #213) | AFK | [#208](https://github.com/samfarls55/gettoit/issues/208) | — |
| bug-19 | [[issues/bug-19-dead-code-invitewebcard\|Retire dead code web/components/InviteWebCard.tsx]] — done (PR #212) | AFK | [#209](https://github.com/samfarls55/gettoit/issues/209) | — |

## bug-17 grill follow-up (2026-05-22)

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| bug-20 | [[issues/bug-20-web-verdict-live-update-unwired\|Web verdict surface does not live-update on a reroll]] ✅ done | AFK | [#216](https://github.com/samfarls55/gettoit/issues/216) | — |

## UI dogfood batch (2026-05-24)

Eight UI-specific issues from a post-tb-WF-9 dogfood pass. `/grill-with-docs` classified seven of eight as `ready-for-agent` (AFK); `bug-27` initially deferred to a `/diagnose` session at `needs-info` (2026-05-25 follow-up reclassified it AFK-ready after the diagnosis pinned the root cause as "reroll feature unplumbed at the two live VerdictScreen sites" — see PR #237).

| # | Title | Status | Type | GitHub | Blocked by |
|---|---|---|---|---|---|
| bug-21 | [[issues/bug-21-plan-list-action-dot-hitbox-too-small\|Plan list ⋯ trigger hitbox too small — taps open the verdict by accident]] | done (bug) — PR #229 | AFK | [#221](https://github.com/samfarls55/gettoit/issues/221) | — |
| bug-22 | [[issues/bug-22-verdict-start-over-reposition-as-home\|Verdict "Start over" → text "Home" in top-leading chrome row]] | done (spec-gap) — PR #230 | AFK | [#222](https://github.com/samfarls55/gettoit/issues/222) | — |
| bug-23 | [[issues/bug-23-plan-list-fab-design-system-fit\|Plan list FAB rework — T1 ink-fill, new `shadow.fab` token]] | done (spec-gap) — PR #231 | AFK | [#223](https://github.com/samfarls55/gettoit/issues/223) | — |
| bug-24 | [[issues/bug-24-bottom-sheet-ios-shape\|Split sheet primitive — keep C-16; add C-27 native-iOS Action Sheet]] | done (spec-gap) — PR #232 | AFK | [#224](https://github.com/samfarls55/gettoit/issues/224) | — |
| bug-25 | [[issues/bug-25-quiz-progress-strip-layout-regression\|topBar trailing-spacer fix + Q1 chrome-row height-invariance audit]] | done (bug) — PR #233 | AFK | [#225](https://github.com/samfarls55/gettoit/issues/225) | — |
| bug-26 | [[issues/bug-26-verdict-cuts-drawer-removal\|Full removal of the cuts drawer — collapse `cuts` mode into `default`]] | done (spec-gap) — PR #235 | AFK | [#226](https://github.com/samfarls55/gettoit/issues/226) | — |
| bug-27 | [[issues/bug-27-reroll-broken\|Reroll feature unplumbed — S05 tertiary CTA is dead, S07 sheet never presented]] | done (bug) — PR #237 | AFK | [#227](https://github.com/samfarls55/gettoit/issues/227) | — |
| bug-28 | [[issues/bug-28-solo-time-badge-audience-copy\|Drop solo audience subtitle entirely]] | done (spec-gap) | AFK | [#228](https://github.com/samfarls55/gettoit/issues/228) | — |

## Swift code-review batch (2026-05-26)

First `/swift-code-review` sweep against `CODING_STANDARDS.md` (just added). Run note: [[../_runs/2026-05-26-0030-swift-code-review|2026-05-26-0030-swift-code-review]]. Four issues filed — all S1 / S2, AFK-ready, independent.

| # | Title | Status | Type | GitHub | Blocked by |
|---|---|---|---|---|---|
| bug-30 | [[issues/bug-30-setupscreen-snapdistance-force-unwraps\|Replace force-unwraps in `SetupScreen.snapDistance` (OPT-001)]] | done (bug) — PR #244 | AFK | [#239](https://github.com/samfarls55/gettoit/issues/239) | — |
| bug-31 | [[issues/bug-31-rerollscreen-reason-switch-exhaustive\|Enumerate `Reason` cases in `RerollScreen.handleSubmit` (ENUM-002)]] | done (bug) — PR #243 | AFK | [#240](https://github.com/samfarls55/gettoit/issues/240) | — |
| bug-32 | [[issues/bug-32-verdictscreen-mode-switch-exhaustive\|Enumerate mode-snapshot cases in `VerdictScreen.modeSnapshot` (ENUM-002)]] | done (bug) — PR #245 | AFK | [#241](https://github.com/samfarls55/gettoit/issues/241) | — |
| bug-33 | [[issues/bug-33-locationcoordinator-dispatchqueue-mainactor\|Swap `DispatchQueue.main.async` for `Task { @MainActor in ... }` in `LocationCoordinator` (CONC-010)]] | ready-for-agent | AFK | [#242](https://github.com/samfarls55/gettoit/issues/242) | — |

## Cross-references

- [[testflight-first-dogfood-2026-05-14|Source raw note]] — original first-impression observations
- [[prd-phase|0.1.0 PRD phase]] — the build these issues are against
- [[workflow-overhaul-phase|0.1.0 workflow-overhaul phase]] — the next decomposition batch
- [[../../10_prds/0.1.0-prd|0.1.0 PRD]] — context for what "shipped the PRD phase" means
- [[../../60_engineering/adr|ADRs]] — for any decision that lands during triage

---

## Pre-public-launch milestone handoff

Items deferred out of the 0.1.0 cycle that must land before the first non-self user joins the platform:

- **#2b** — branded OG image
- **#10** — allergy / dietary capture (anon 6th question + persistent profile-edit surface — land as a pair)
- **Profile-edit surface** — cuisine likes/dislikes editor
- **Distance + time inputs** — re-enter scope when multi-geo decisions become a thing
- **`support@gettoit.app` mailbox / forwarding** — deferred 2026-05-14 from [[issues/tb-16-privacy-legal-delete|TB-16]]; must land before the App Store public listing or any non-friend invitee joins
