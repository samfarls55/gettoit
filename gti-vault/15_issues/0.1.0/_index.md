---
folder: 15_issues/0.1.0
purpose: 0.1.0 pre-launch development cycle — every issue, PRD slice, dogfood follow-up, and workflow-overhaul deliverable shipped before the first public launch (0.1.0)
---

# 0.1.0 — Pre-launch development cycle

All issues, build slices, bugs, and design-system spec-gaps shipped during the pre-launch build of GetToIt. This folder collapses what was previously labeled the `v1` PRD batch, the `v1.1` dogfood batch, and the `workflow-overhaul` phase into a single `0.1.0` cycle, since `v1` is now reserved for the first public-launch release.

The phases below are organizational only — same cycle, distinct decomposition sessions.

## Phases

- [[prd-phase|PRD phase (formerly the "v1" batch)]] — 18 tracer-bullet build slices (TB-00 → TB-17) decomposed from the [[../../10_prds/0.1.0-prd|0.1.0 PRD]] plus 5 design-system spec-gap issues. All merged 2026-05-12 → 2026-05-14.
- [[dogfood-phase|Dogfood follow-ups (formerly the "v1.1" batch)]] — first-install TestFlight feedback (2026-05-14), the quiz-redesign + verdict-engine PRD ([[../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign PRD]]), Q5-wiring fix, premium-data follow-ups, post-Q5 router fix, verdict-pipeline integration, candidate-pool floor, verdict-spinner diagnosis, solo-session post-mortem, AFK-run follow-ups, UI dogfood batch.
- [[workflow-overhaul-phase|Workflow overhaul (formerly "workflow-overhaul")]] — Plans as persistent named items, list-as-landing, collapsed Setup screen, three nav verbs (Back/Exit/Delete), web invitee shell + account-claim bridge.

All `tb-NN-*` / `bug-NN-*` / `sg-NN-*` / `tb-wf-N-*` / `sg-wf-N-*` issue files live flat in [[issues|0.1.0/issues/]].

## Loose-leaf phase notes

Diagnostic notes captured outside the issue files themselves but still relevant to the 0.1.0 cycle:

- [[testflight-first-dogfood-2026-05-14|testflight-first-dogfood-2026-05-14]] — raw note from the first real-device install.
- [[placesproxy-empty-foursquare-results|placesproxy-empty-foursquare-results]] — 2026-05-16 PlacesProxy returns empty `places` even after deploy; root-caused to category-id legacy numerics + missing API credits.
- [[service-shape-attributes-unbacked|service-shape-attributes-unbacked]] — Foursquare `attributes` adjacency for the service-shape session parameter.
- [[ios-integration-tests-flaky-on-shared-db|ios-integration-tests-flaky-on-shared-db]] — flaky integration tests against the shared live Supabase DB.
- [[verdict-pipeline-pool-manager-unwired|verdict-pipeline-pool-manager-unwired]] — `RunningUnionPoolManager` not-wired-in smell on the verdict side.
