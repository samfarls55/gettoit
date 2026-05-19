---
folder: 15_issues/v1.1
purpose: v1.1 issues — 2026-05-14 TestFlight dogfood follow-ups (bugs, spec-gaps, surface wiring) + the 2026-05-15 quiz-redesign & verdict-engine PRD build slices
status: dogfood batch — 13 issues (6 bug / 4 spec-gap / 3 tracer-bullet), all closed except bug-05 (fixed-in-branch, never filed to GitHub); quiz-redesign batch — 11 issues (research-01 + tb-04–tb-13, GitHub #64–#74), all closed; Q5-wiring batch — 4 tracer-bullets (tb-14–tb-17, GitHub #91–#94), all closed; premium-data follow-ups (2026-05-17) — category-id fix shipped (PR #101); research-02 allowlist spike done (PR #113) + tb-18 Q4-vibe `tastes`-nudge shipped (PR #114) — Q4 vibe now off its free-tier-era workaround (GitHub #102, #108); dogfood 2026-05-18 — bug-07 post-Q5 router unwired closed, decomposed into AFK slices tb-19/tb-20 (GitHub #106, #107); tb-19 post-Q5 router skeleton shipped (PR #110); tb-20 group S04 Waiting route shipped (PR #111) — bug-07 backlog fully cleared; verdict-pipeline diagnosis 2026-05-18 — 3 bugs filed (bug-08–bug-10, GitHub #116–#118): the verdict path has never produced a row — candidate-pool integration unwired (bug-08), fire dispatch no-ops on unset GUCs (bug-09), resolving poll never times out (bug-10); bug-08 fork decided 2026-05-18 (Option 2, server-side) and decomposed into AFK slices tb-21–tb-23 (GitHub #119–#121); verdict pipeline wired end to end 2026-05-18 — tb-21/tb-22/tb-23 + bug-10 + bug-09 (re-scoped to an `app_config` table) all merged; tb-24 (iOS Q5 factorial-ratings write-path adjacency) merged 2026-05-18 (PR #131) — iOS now emits `votes.q5.answer.ratings`, the per-member Q5 re-weight is no longer dark; candidate-pool floor (2026-05-19) — a `/grill-with-docs` session ratified [[../../60_engineering/adr/0012-candidate-pool-floor|ADR 0012]] and filed tb-25 (GitHub #133, ready-for-agent) to floor every Foursquare call to an 8-category venue-type allowlist; remove-fictitious-venues batch (2026-05-19) — `/to-issues` decomposed the dummy-venue removal into sg-05 + tb-26 (GitHub #136, #137, both ready-for-agent): Q5 gets a `no-results` mode in place of the `QuizDummyCandidates` fixture so the app never surfaces a fictitious place
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
| bug-01 | [[issues/bug-01-invite-link-404\|Invite link 404 + AASA regression test]] ✅ done | AFK | [#41](https://github.com/samfarls55/gettoit/issues/41) | — |
| bug-02 | [[issues/bug-02-static-og-image-placeholder\|Static placeholder OG image + meta tags]] ✅ done | AFK | [#42](https://github.com/samfarls55/gettoit/issues/42) | — |
| bug-03 | [[issues/bug-03-q5-placeholder-no-foursquare-calls\|Q5 placeholders, zero Foursquare calls — wire PlacesService into Q5]] ✅ done | AFK | [#43](https://github.com/samfarls55/gettoit/issues/43) | — |
| bug-04 | [[issues/bug-04-question-transition-motion-lag\|Question transition motion lag]] ✅ done | AFK | [#44](https://github.com/samfarls55/gettoit/issues/44) | — |
| bug-05 | [[issues/bug-05-info-plist-missing-location-purpose-string\|Info.plist missing NSLocationWhenInUseUsageDescription — ITMS-90683 on build 125]] — fixed-in-branch (not filed to GitHub) | AFK | — | — |
| bug-06 | [[issues/bug-06-legacy-anon-bypasses-s00a-gate\|Legacy v1 anonymous session bypasses S00a sign-in gate on launch]] ✅ done | AFK | [#63](https://github.com/samfarls55/gettoit/issues/63) | — |
| bug-07 | [[issues/bug-07-post-q5-router-unwired\|Quiz submit dead-ends to landing — post-Q5 router (S04/S05) unwired]] ✅ closed — decomposed into tb-19/tb-20; fix tracked there | HITL | [#109](https://github.com/samfarls55/gettoit/issues/109) | — |
| bug-08 | [[issues/bug-08-verdict-pipeline-integration-unwired\|Verdict never computes — candidate-pool + preference-scoring integration (modules A/E/G) never wired]] ✅ closed — fork decided (Option 2, server-side); decomposed into tb-21/tb-22/tb-23; fix tracked there | HITL | [#116](https://github.com/samfarls55/gettoit/issues/116) | — |
| bug-09 | [[issues/bug-09-verdict-fire-dispatch-guc-noop\|Verdict engine never auto-invoked — dispatch no-ops on unset app.* DB GUCs]] ✅ done — `app_config` table replaces the `app.*` GUCs; both `dispatch_compute_verdict` overloads rewritten, applied live + CI-seeded | AFK | [#117](https://github.com/samfarls55/gettoit/issues/117) | — |
| bug-10 | [[issues/bug-10-verdict-poll-no-timeout\|Post-Q5 "Lining Up the Verdict" spinner hangs forever — poll has no timeout]] ✅ done — `VerdictPoller` bounded, PR #122 | AFK | [#118](https://github.com/samfarls55/gettoit/issues/118) | — |

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
| TB-01 (v1.1) | [[issues/tb-01-landing-page-wire\|Wire landing surface into iOS]] ✅ done | AFK | [#49](https://github.com/samfarls55/gettoit/issues/49) | sg-02 |
| TB-02 (v1.1) | [[issues/tb-02-account-creation-wire\|Wire forced sign-in (iOS) + waiting-screen CTA (web)]] ✅ done | AFK | [#50](https://github.com/samfarls55/gettoit/issues/50) | sg-03 |
| TB-03 (v1.1) | [[issues/tb-03-geo-permission-and-location-selector-wire\|Wire geo permission + location selector]] ✅ done | AFK | [#51](https://github.com/samfarls55/gettoit/issues/51) | sg-04 |

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
- `research` *(new)* — research spike that ships a vault doc, not code.

## Quiz redesign & verdict engine (PRD 2026-05-15)

Build slices decomposed from [[../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] via `/to-issues` on 2026-05-15. Vertical capability slices — all AFK. Canonical design record: [[../../50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]].

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

Build order: research-01 first (blocks all Foursquare work), then tb-04 → tb-13 along the dependency graph above.

## Q5 wiring + PlacesProxy fix (2026-05-16)

Decomposed via `/to-issues` after a Q5 diagnosis session. Symptom: Q5 rendered location-generic options and the Foursquare API was never hit. Two faults:

1. **PlacesProxy is dark.** The `places-proxy` Edge Function is invoked by the live quiz but never reaches Foursquare — every call falls through to the on-device MapKit fallback. A deployment / secrets gap, not a credentials problem (the Foursquare key is known-good from one v1-dev call).
2. **The v1.1 Q5 pipeline was built but never wired in.** tb-07 (`FoursquareFetchPlanner` / `FoursquareFetchExecutor`), tb-08 (`Q5FactorialCardGenerator`), tb-09 (axis scorers) and tb-10 (`RunningUnionPoolManager`) all shipped as unit-tested components, but each issue flagged "not wired into the live quiz" as an adjacency and named the *next* issue as the home for the wiring. The wiring never happened — the live quiz still runs the bug-03 tracer-bullet bridge (`Q5CandidatesLoader`): one fetch, early, with empty filters, truncated to three.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-14 (v1.1) | [[issues/tb-14-restore-placesproxy-foursquare-path\|Restore the PlacesProxy Foursquare path — deploy + secrets]] ✅ done | AFK | [#91](https://github.com/samfarls55/gettoit/issues/91) | — |
| TB-15 (v1.1) | [[issues/tb-15-wire-answer-tailored-fetch\|Wire the answer-tailored Foursquare fetch into the live quiz]] ✅ done | AFK | [#92](https://github.com/samfarls55/gettoit/issues/92) | — |
| TB-16 (v1.1) | [[issues/tb-16-q5-factorial-card-selection\|Q5 factorial card selection in the live quiz]] ✅ done | AFK | [#93](https://github.com/samfarls55/gettoit/issues/93) | TB-15 |
| TB-17 (v1.1) | [[issues/tb-17-edge-function-cuisine-tag\|Edge Function honors the cuisine advisory tag]] ✅ done | AFK | [#94](https://github.com/samfarls55/gettoit/issues/94) | — |

Build order: tb-14, tb-15, tb-17 can start immediately; tb-16 after tb-15. tb-15's end-to-end verification against live Foursquare data depends on tb-14, but its boundary tests do not.

**Adjacency flagged, not filed.** `RunningUnionPoolManager` (tb-10) shows the same not-wired-in smell on the *verdict* side — see [[verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]]. Out of scope for the Q5 fix; needs its own diagnosis pass before it becomes an issue.

**Follow-up surfaced by tb-14 (2026-05-16) — RESOLVED 2026-05-17.** tb-14 closed the deploy gap, but the deployed function returned an *empty* `places` array. Diagnosed against the live API: two faults, not the hypothesised bad-key/version-pin — (1) the Foursquare account had no API credits, so every premium-field call 429'd; (2) the cuisine/dietary category ids were legacy short numerics the post-2025 surface rejects with 400. Both were swallowed by a silent-4xx handler path. Resolved: operator added Foursquare credits + PR #101 (correct hex ids, handler now surfaces the error). See [[placesproxy-empty-foursquare-results|placesproxy-empty-foursquare-results]] §Resolution.

**Adjacency flagged during the tb-14 run (2026-05-16).** The `ios` CI lane's integration tests (`RoomStore` / `Verdict` / `Votes` `IntegrationTests`) flake against the shared live Supabase DB — same commit passed and failed on re-run across the rapid tb-14 PR cadence. Pre-existing, not a tb-14 regression (tb-14 changed no Swift). Flagged in [[ios-integration-tests-flaky-on-shared-db|ios-integration-tests-flaky-on-shared-db]]; needs CI-hardening triage.

## Premium-data follow-ups (2026-05-17)

After the Foursquare account moved to a paid (credit-backed) plan, a session diagnosed the empty-`places` follow-up and audited whether the premium fields could retrieve the Q1-Q4 quiz inputs better than the free-tier-era workarounds.

**Shipped — category-id fix (PR [#101](https://github.com/samfarls55/gettoit/pull/101)).** The cuisine + dietary category ids were legacy short numerics the post-2025 Foursquare surface rejects with HTTP 400; replaced with live-probed hex ids, `FoursquareCategory.id` → `fsq_category_id`, and the handler now surfaces a `foursquare_upstream_<status>` error instead of a silent empty 200. Closes the [[placesproxy-empty-foursquare-results|placesproxy-empty-foursquare-results]] follow-up (with the operator's Foursquare credit top-up). Not filed as a tracked issue — fixed directly. ADR 0002 corrected.

**Audit result — only Q4 still on a workaround.** Q1 cuisine (category-id filter), Q2 spend cap (`max_price` + `price`), Q3 reputation (`rating`/`stats`/`date_created`, already migrated by tb-16) are all on the right mechanism. Q4 vibe is the only quiz axis still inferred from a free-tier-era workaround (category archetype + price tie-break).

| # | Title | Type | GitHub | Status |
|---|---|---|---|---|
| research-02 (v1.1) | [[issues/research-02-tastes-vibe-token-allowlist\|Foursquare tastes vibe-token allowlist — sample + curate]] ✅ done | AFK | [#108](https://github.com/samfarls55/gettoit/issues/108) | done — PR #113; allowlist in [[../../60_engineering/research/foursquare-tastes-vibe-2026-05/report\|foursquare-tastes-vibe-2026-05]] |
| TB-18 (v1.1) | [[issues/tb-18-q4-vibe-tastes-signal\|Q4 vibe energy from the Foursquare tastes signal]] ✅ done | AFK | [#102](https://github.com/samfarls55/gettoit/issues/102) | done — PR #114; `tastes` decoded onto `ShapedPlace`, `Q5VenueClassifier` blends a ±1 allowlist-token nudge into the Q4 vibe baseline |
| research-03 (v1.1) | [[issues/research-03-vibe-nudge-hit-rate\|Measure the vibe-token nudge hit-rate against the research-02 sample]] ✅ done | AFK | [#115](https://github.com/samfarls55/gettoit/issues/115) | done — fire-rate **46.3%** (505/1090), below the 66.8% ceiling; §7 of [[../../60_engineering/research/foursquare-tastes-vibe-2026-05/report\|foursquare-tastes-vibe-2026-05]]; verdict: keep nudge as specified |

**research-02 done 2026-05-18 (PR #113).** The live-data spike is filed at [[../../60_engineering/research/foursquare-tastes-vibe-2026-05/_index|foursquare-tastes-vibe-2026-05]]: a 1090-venue sample of the live Foursquare `tastes` field, a 2732-token frequency table, and a curated **30-token vibe-token allowlist** (16 `+1` / 14 `-1`). Measured `tastes` coverage is **66.8%**, correcting the ~76% estimate the tb-18 ticket and research-01 carried. tb-18 (#102) is now unblocked — it transcribes the allowlist verbatim.

**Triaged 2026-05-18.** A `/triage` + `/grill-with-docs` session resolved tb-18's three design questions (vibe = category-archetype baseline + bounded ±1 `tastes` nudge; price tie-break demoted to last-resort; graded-axis already closed by [[research-01-foursquare-filter-surface|research-01]] §6). The live-data allowlist build was split out as `research-02`. tb-18 is now the implementation tracer-bullet, blocked by it. The research-01 report §5 was corrected — the 2026-05-17 audit reversed its `attributes`/`tastes` ranking.

**research-03 done 2026-05-18.** Reviewing research-02's headline finding surfaced that the **66.8% `tastes` coverage is only the ceiling** on the Q4 nudge, not its fire-rate — a venue inside that 66.8% still gets no nudge if its tokens are all noise or net to zero. research-03 replayed the merged tb-18 `Q5VenueClassifier.tastesNudge` logic offline over the research-02 sample (no new API calls) and measured the real **fire-rate at 46.3%** (505 of 1090). Funnel: 1090 sampled → 728 tastes-bearing → 571 token-matched → 505 non-zero net. The nudge is restaurant/bar-shaped (fire-rate ~60%), near-dead for cafes (22.7%), and strongly loud-skewed (82% of fires push louder); only 66 venues net-zero cancel. Verdict: **keep the nudge as specified** — it moves nearly half of every pool at trivial complexity cost. A future lever, if quiet verdicts under-serve, is a wider cafe-and-quiet-aware allowlist, not removal. Written up in §7 of [[../../60_engineering/research/foursquare-tastes-vibe-2026-05/report\|foursquare-tastes-vibe-2026-05]].

**Adjacency flagged, not filed.** Foursquare's `attributes` field (`outdoor_seating`, `delivery`, `reservations`) could back the service-shape session parameter (PRD story 8), which currently has no Foursquare backing — see [[service-shape-attributes-unbacked|service-shape-attributes-unbacked]]. A parameter, not a quiz question; needs a triage decision before it becomes an issue.

## Post-Q5 router fix (2026-05-18)

Decomposed via `/to-issues` after a dogfood session surfaced [[issues/bug-07-post-q5-router-unwired|bug-07]] — submitting Q5 on iOS dead-ends to the S00 Landing screen because the post-Q5 router (S04 Waiting → S05 Verdict) was never wired into `RootView`. The S04/S05 surfaces and stores exist and are unit-tested but are constructed nowhere in production. Two vertical slices; verdict-ready detection is by polling, not Realtime (a few-seconds delay after the final answer is acceptable — see bug-07 §Fix scope).

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-19 (v1.1) | [[issues/tb-19-solo-verdict-route\|Solo session reaches the verdict — post-Q5 router skeleton]] ✅ done | AFK | [#106](https://github.com/samfarls55/gettoit/issues/106) | — |
| TB-20 (v1.1) | [[issues/tb-20-group-waiting-route\|Group session shows S04 Waiting and advances to S05]] ✅ done | AFK | [#107](https://github.com/samfarls55/gettoit/issues/107) | TB-19 |

Build order: tb-19 first (stands up the post-quiz host + `RootView` wiring on the solo path), then tb-20 (adds the group S04 Waiting surface on the same host).

**Adjacencies flagged on bug-07, not filed.** Realtime upgrade for live S04 peer updates; S06 Locked / S07 Reroll / S08 Check-in routing — the same unwired-surface pattern, separate follow-ups.

## Verdict-pipeline integration fix (2026-05-18)

Decomposed via `/to-issues` from [[issues/bug-08-verdict-pipeline-integration-unwired|bug-08]] — the verdict candidate-pool + preference-scoring integration (PRD modules A/E/G) was never wired; `options` is empty across all 2587 rooms and the verdict path has never produced a row. bug-08's architecture fork was decided 2026-05-18: **Option 2 (server-side)** — the union + preference-scoring runs server-side at verdict fire time; iOS writes only raw fetch results. Three vertical slices.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-21 (v1.1) | [[issues/tb-21-persist-fetch-server-union\|Persist raw per-member fetch; server unions it into `options` at fire time]] ✅ done — `member_fetches` table + server-side union shipped | AFK | [#119](https://github.com/samfarls55/gettoit/issues/119) | — |
| TB-22 (v1.1) | [[issues/tb-22-port-preference-function-ts\|Port the preference function (PRD modules A/E) Swift → TypeScript]] ✅ done — `supabase/functions/_shared/preference-function.ts` ported; Swift test vectors reproduced exactly (PR #126) | AFK | [#120](https://github.com/samfarls55/gettoit/issues/120) | — |
| TB-23 (v1.1) | [[issues/tb-23-server-prefn-scoring\|Server-side prefFn scoring over the full union, into the verdict engine]] ✅ done — handler builds each member's `prefFn` from quiz answers + Q5 ratings, classifies the full pool (`_shared/venue-classifier.ts`), scores the union; winner can be an unseen venue (PR #129) | AFK | [#121](https://github.com/samfarls55/gettoit/issues/121) | TB-21, TB-22 |
| TB-24 (v1.1) | [[issues/tb-24-ios-q5-factorial-ratings-wire\|Wire the iOS Q5 write path to emit factorial `{droppedAxis, score}` ratings]] ✅ done — iOS Q5 write emits `votes.q5.answer.ratings` (the factorial probe); `buildVotesSlotsFromLegacyAnswers` cut over to `answer.ratings`; `VerdictStore` decoder made tolerant of the new shape (PR #131) | AFK | [#130](https://github.com/samfarls55/gettoit/issues/130) | — |

Build order: tb-21 and tb-22 run in parallel (both unblocked); tb-23 after both. tb-22 is a deliberate horizontal slice — a pure Swift→TS port verified by its ported test vectors — kept separate for parallelism and a focused port-vs-wiring review split. The group path is folded into tb-21/tb-23 acceptance criteria, not its own slice: Option 2's server-side union has no solo/group special case. Full *auto*-fire end-to-end also needs [[issues/bug-09-verdict-fire-dispatch-guc-noop|bug-09]] (GUCs); the slices stay verifiable without it via direct `compute-verdict` invoke.

tb-21/tb-22/tb-23 + bug-09 all merged 2026-05-18 — the verdict pipeline is now wired end to end. tb-24 (the tb-23 adjacency — iOS Q5 write path) merged 2026-05-18 (PR #131): the iOS quiz now emits `votes.q5.answer.ratings` as the factorial `[{droppedAxis, score}]` probe, so the per-member preference re-weight is no longer a no-op. The verdict pipeline's Q5 producer side is now fully wired to the server contract.

## Candidate-pool floor (2026-05-19)

A `/grill-with-docs` session pinned down a leak found in an earlier undocumented diagnosis: the per-member Foursquare fetch's general call carried no category scope, so non-restaurant venues (parks, gyms, retail) leaked into both the Q5 candidate pool and the verdict candidate set. The session produced [[../../60_engineering/adr/0012-candidate-pool-floor|ADR 0012]] — the **candidate-pool floor**, a named eight-category `Dining and Drinking` allowlist applied as a fetch-time hard filter on every call. `CONTEXT.md` gained the **Candidate pool** + **Candidate-pool floor** terms; `v1.1-quiz-amendments` §5 carries an amendment note.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-25 (v1.1) | [[issues/tb-25-candidate-pool-floor\|Apply the candidate-pool floor — Restaurant + Sports Bar allowlist on every Foursquare call]] ✅ done — `buildFoursquareQuery` seeds the eight-id `CANDIDATE_POOL_FLOOR_CATEGORY_IDS` constant when the category set is empty (fallback, never an OR-addition); `fsq_category_ids` is never emitted empty; `MapKitPlacesFallback` POI filter tightened to `[.restaurant]`; eight floor ids live-probed (all HTTP 200, `Restaurant` parent confirmed descendant-inclusive) — ADR 0012 Open items resolved (PR #135) | AFK | [#133](https://github.com/samfarls55/gettoit/issues/133) | — |

## Remove fictitious fallback venues (2026-05-19)

Decomposed via `/to-issues` from a design session. The iOS app papers over an
empty Q5 candidate pool with three hardcoded fictitious restaurants
(`QuizDummyCandidates` — Pico's Taqueria / Ren Soba House / Bar Pastoral), a
tb-04-era scaffold. Decision: remove all fictitious venues — the app must never
surface a made-up place to a user. Q5 instead renders a `no-results` mode with a
forward CTA so the member is never stranded ("skip ahead"). Two slices, the
established spec-gap → tracer-bullet pairing (cf. `sg-02`→`tb-01`).

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| sg-05 | [[issues/sg-05-q5-no-results-mode\|Q5 no-results mode — design-system surface spec]] ✅ done | AFK | [#136](https://github.com/samfarls55/gettoit/issues/136) | — |
| TB-26 (v1.1) | [[issues/tb-26-remove-fictitious-fallback-venues\|Remove fictitious fallback venues; render the Q5 no-results screen]] ✅ done — `QuizDummyCandidates` deleted from the iOS app target; the four no-results paths resolve the candidate fetch to a `.noResults` source with an empty candidate list; new `QuizQ5NoResults` view renders sg-05's `no-results` mode (locked copy) with a forward CTA that submits Q1–Q4 + an empty Q5; `compute-verdict` already tolerated the empty `votes.q5.answer.ratings` array (equal-weight prior) — confirmed by a Deno test, no server change; decision in [[../../60_engineering/adr/0013-no-fictitious-fallback-venues\|ADR 0013]] | AFK | [#137](https://github.com/samfarls55/gettoit/issues/137) | sg-05 |

Build order: sg-05 first (specs the `no-results` Q5 mode in `design-system/`),
then tb-26 (deletes `QuizDummyCandidates`, renders the no-results screen against
the spec, wires the skip-ahead submit path, files the decision as an ADR).

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
- 11 issues published to vault + GitHub (#41–#51) in the initial 2026-05-14 batch. `bug-05` (ITMS-90683, never filed to GitHub) and `bug-06` (#63) were filed afterward — see [[#Published issues]] for the full 13-issue table.
