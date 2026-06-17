---
folder: 15_issues/0.1.0
purpose: 0.1.0 pre-launch development cycle â€” every issue, PRD slice, dogfood follow-up, and workflow-overhaul deliverable shipped before the first public launch (0.1.0)
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0.1.0 â€” Pre-launch development cycle


The phases below are organizational only â€” same cycle, distinct decomposition sessions.

## Phases

- [[dogfood-phase|Dogfood follow-ups (formerly the "v1.1" batch)]] â€” first-install TestFlight feedback (2026-05-14), the quiz-redesign + verdict-engine PRD ([[../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign PRD]]), Q5-wiring fix, premium-data follow-ups, post-Q5 router fix, verdict-pipeline integration, candidate-pool floor, verdict-spinner diagnosis, solo-session post-mortem, AFK-run follow-ups, UI dogfood batch.
- [[workflow-overhaul-phase|Workflow overhaul (formerly "workflow-overhaul")]] â€” Plans as persistent named items, list-as-landing, collapsed Setup screen, three nav verbs (Back/Exit/Delete), web invitee shell + account-claim bridge.
- [[search-area-picker-prd|Search area picker PRD]] (GH [#316](https://github.com/samfarls55/gettoit/issues/316)) â€” replace active Setup `Where to` + `How far` controls with C-28 SearchAreaPicker.

All `tb-NN-*` / `bug-NN-*` / `sg-NN-*` / `tb-wf-N-*` / `sg-wf-N-*` / `wfr-NN-*` issue files live flat in [[issues|0.1.0/issues/]].

## Loose-leaf phase notes

Diagnostic notes captured outside the issue files themselves but still relevant to the 0.1.0 cycle:

- [[testflight-first-dogfood-2026-05-14|testflight-first-dogfood-2026-05-14]] â€” raw note from the first real-device install.
- [[placesproxy-empty-foursquare-results|placesproxy-empty-foursquare-results]] â€” 2026-05-16 PlacesProxy returns empty `places` even after deploy; root-caused to category-id legacy numerics + missing API credits.
- [[service-shape-attributes-unbacked|service-shape-attributes-unbacked]] â€” Foursquare `attributes` adjacency for the service-shape session parameter.
- [[ios-integration-tests-flaky-on-shared-db|ios-integration-tests-flaky-on-shared-db]] â€” flaky integration tests against the shared live Supabase DB.
- [[verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]] â€” `RunningUnionPoolManager` not-wired-in smell on the verdict side.

## Search area picker issues

Decomposed from [[search-area-picker-prd|Search area picker PRD]] on 2026-06-03 after splitting the original iOS core slice into smaller vertical slices.

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|
| tb-SA-1 | [[issues/tb-sa-1-search-area-chip-persistence-foundation|Search area chip + persistence foundation]] | AFK | [#318](https://github.com/samfarls55/gettoit/issues/318) | sg-SA-1 |
| tb-SA-2 | [[issues/tb-sa-2-map-viewport-selection-editor|Map viewport selection editor]] | AFK | [#319](https://github.com/samfarls55/gettoit/issues/319) | tb-SA-1 |
| tb-SA-3 | [[issues/tb-sa-3-search-area-jumps|Search area jumps]] | AFK | [#320](https://github.com/samfarls55/gettoit/issues/320) | tb-SA-2 |
| tb-SA-4 | [[issues/tb-sa-4-density-preview-pins|Density preview pins]] | AFK | [#321](https://github.com/samfarls55/gettoit/issues/321) | tb-SA-2 |
| tb-SA-5 | [[issues/tb-sa-5-retire-active-c23-setup-semantics|Retire active C-23 Setup semantics]] | AFK | [#322](https://github.com/samfarls55/gettoit/issues/322) | tb-SA-1, tb-SA-2, tb-SA-3, tb-SA-4 |

## Architecture deepening issues

Decomposed from the 2026-06-17 architecture review after comparing active code against [[../../60_engineering/adr/0022-google-places-primary-provider|ADR 0022]], [[../../60_engineering/adr/0023-transient-vibe-embeddings-in-scoring|ADR 0023]], and the Q5/Verdict domain language in [[../../../CONTEXT|CONTEXT]].

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| tb-27 | [[issues/tb-27-server-assigned-q5-card-sets|Server-assigned Q5 card sets]] | AFK | [#367](https://github.com/samfarls55/gettoit/issues/367) | None |
| tb-28 | [[issues/tb-28-move-web-mobile-q5-to-assigned-card-sets|Move web and mobile Q5 onto assigned card sets]] | AFK | [#368](https://github.com/samfarls55/gettoit/issues/368) | tb-27 |
| tb-29 | [[issues/tb-29-canonical-q5-axis-language|Make active Q5 axis language canonical]] | AFK | [#369](https://github.com/samfarls55/gettoit/issues/369) | tb-28 |
| tb-30 | [[issues/tb-30-centralize-google-provider-runtime-policy|Centralize Google provider runtime policy]] | AFK | [#370](https://github.com/samfarls55/gettoit/issues/370) | None |
| tb-31 | [[issues/tb-31-remove-active-foursquare-display-payload-compat|Remove active Foursquare and display payload compatibility]] | AFK | [#371](https://github.com/samfarls55/gettoit/issues/371) | tb-30 |
| tb-32 | [[issues/tb-32-shared-hard-eligibility-core|Share hard eligibility between Vibe Fit and Verdict]] | AFK | [#372](https://github.com/samfarls55/gettoit/issues/372) | None |
| tb-33 | [[issues/tb-33-deepen-verdict-run-execution|Deepen Verdict Run execution]] | AFK | [#373](https://github.com/samfarls55/gettoit/issues/373) | tb-32 |

## Founder pre-launch HITL bucket

Founder-flagged pre-launch must-addresses captured 2026-05-26. All `status: needs-triage`, `type: HITL`, deferred to future grills.

- [[issues/bug-39-design-ui-tweaks|bug-39]] (GH #311) â€” Design/UI tweaks, founder polish pass.
- [[issues/bug-40-im-in-button-broken|bug-40]] (GH #312) â€” "I'm In" button doesn't work correctly.
- [[issues/bug-41-additional-user-settings|bug-41]] (GH #313) â€” Additional user settings on SettingsScreen.
- [[issues/bug-42-app-rename-and-logo|bug-42]] (GH #314) â€” App rename and logo before v1.
- [[issues/bug-43-marketing-and-messaging|bug-43]] (GH #315) â€” Marketing and messaging (positioning, voice, copy).

## Workflow-review batches

- [[../_runs/2026-05-26-0958-workflow-review|2026-05-26 whole-app workflow-review]] â€” 32 findings against `gti-vault/30_design/interaction-patterns/`. Issue bucket #6..#31 published as `wfr-06`..`wfr-31` (GitHub #247-#272). Grill bucket FULLY CLOSED 2026-05-26: #1 â†’ [[../../60_engineering/adr/0018-verdict-surface-three-way-split|ADR-0018]] + [[issues/bug-34-verdict-surface-three-way-split|bug-34]] (GH #273), re-scopes finding #16. #2 â†’ [[../../40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] + [[issues/bug-35-landing-page-pre-launch|bug-35]] (GH #276) HITL deferred. #3 â†’ Hub-and-Spoke locked; wfr-06 already shipped (PR #274). #4 â†’ threshold-gated History search at 10 rows, [[issues/bug-36-planlist-history-threshold-search|bug-36]] (GH #279). #5 â†’ [[../../60_engineering/adr/0019-surface-owned-session-ended-ownership|ADR-0019]] + [[issues/bug-37-waitingscreen-session-ended-handler|bug-37]] (GH #280) + [[issues/bug-38-quizscreen-session-ended-handler|bug-38]] (GH #281), unblocks finding #17. #32 â†’ deferred to [[../../20_plan/post-launch-considerations|post-launch]] (iPhone-only, no hardware-keyboard QA path).
