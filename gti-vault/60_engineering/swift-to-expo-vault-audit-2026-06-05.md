---
title: Swift to Expo vault audit
description: Audit of vault references that still treat the legacy ios Swift app as active after the mobile Expo React Native cutover.
type: audit
status: done
created: 2026-06-05
related:
  - "[[adr/0021-expo-managed-mobile-rewrite]]"
  - "[[expo-release-cutover]]"
  - "[[../15_issues/expo-mobile-rewrite/PRD]]"
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Swift to Expo vault audit - 2026-06-05

## Scope

Audit target: `gti-vault/` references to the legacy Swift app in `ios/` after the active iOS client moved to the Expo managed React Native app in `mobile/`.

Cutover source of truth:

- [[adr/0021-expo-managed-mobile-rewrite]] - `mobile/` is the active future iOS client; `ios/` is legacy/frozen.
- [[expo-release-cutover]] - TB-18 swaps active release ownership to `mobile/`; Swift TestFlight is disabled.
- [[../15_issues/expo-mobile-rewrite/PRD]] - Expo rewrite PRD and issue family.

## Findings

### P0 - Agent-risk live docs still point at Swift

These are most likely to misdirect future agents.

1. [[stack-patterns]]
   - Status: active implementation-pattern doc.
   - Conflict: still says the stack is "Swift + SwiftUI + Supabase" and explicitly says 0.1.0 is not doing React Native.
   - Recommended fix: update header and "What we are explicitly not doing" to reflect ADR 0021. Keep Supabase, RLS, Realtime, verdict, and backend patterns, but move Swift-specific sections into a "legacy Swift reference" subsection or a separate archive note.

2. [[../10_prds/0.1.0-prd]]
   - Status: `ready-for-agent`.
   - Conflict: frames 0.1.0 as a native SwiftUI app, lists `ios/` modules (`SessionStore`, `AuthCoordinator`, SwiftUI screens), future `GTITokens.swift`, and `xcodebuild test` as active CI.
   - Recommended fix: mark as superseded for mobile implementation by the Expo rewrite PRD. Preserve product requirements, but add a top banner: product behavior remains relevant; implementation stack sections are historical/overridden by ADR 0021.

3. [[../10_prds/0.1.0-quiz-redesign-prd]]
   - Status: `ready-for-agent`.
   - Conflict: still has "iOS surfaces" and points to `ios/Tests/*.swift` as prior-art patterns.
   - Recommended fix: same banner model as 0.1.0 PRD. Product/engine contracts survive; Swift test prior-art is legacy evidence only.

4. [[github-actions-secrets]]
   - Status: active runbook.
   - Conflict: secret roster says App Store Connect keys are for "TestFlight archive/export/upload" and Supabase public env is for "iOS tests"; cutover says EAS owns TestFlight.
   - Recommended fix: replace Swift TestFlight language with EAS/TestFlight language and add any EAS token/Expo account secret expectations if they are now used by CI.

5. [[codex-project-memory]]
   - Status: active reference.
   - Conflict: stack memory says "v1 stack was Swift, SwiftUI, Supabase" and links ADR 0001/stack-patterns as canonical. It has a conflict disclaimer, but the quick-orientation bullets are now stale.
   - Recommended fix: add a top "current mobile stack" correction pointing to ADR 0021 and `mobile/`, then demote Swift details to legacy memory.

### P1 - Open old Swift issues should be closed, retitled, or cross-linked to Expo equivalents

These are dangerous because frontmatter still makes them look executable.

1. [[../15_issues/0.1.0/issues/tb-sa-1-search-area-chip-persistence-foundation]]
2. [[../15_issues/0.1.0/issues/tb-sa-2-map-viewport-selection-editor]]
3. [[../15_issues/0.1.0/issues/tb-sa-3-search-area-jumps]]
4. [[../15_issues/0.1.0/issues/tb-sa-4-density-preview-pins]]
5. [[../15_issues/0.1.0/issues/tb-sa-5-retire-active-c23-setup-semantics]]

Current problem:

- All are still in the 0.1.0 Search Area issue table as active AFK work.
- Several say to build Apple MapKit / update active iOS tests / replace Swift Setup controls.
- Expo rewrite already has Search Area coverage in [[../15_issues/expo-mobile-rewrite/issues/tb-07-search-area-picker-feasibility-build]] and Setup coverage in [[../15_issues/expo-mobile-rewrite/issues/tb-08-setup-create-edit-plan]].
- TB-17/TB-18 accepted Search Area native feel as residual Expo runtime risk, not as Swift work.

Recommended fix:

- Mark old `tb-SA-*` Swift implementation issues `status: superseded` or `wontfix`.
- Add `superseded_by:` links to relevant Expo issues, especially TB-07/TB-08 and any future native Search Area follow-up.
- Update [[../15_issues/0.1.0/_index]] Search Area table so it cannot be read as current AFK queue.
- If GitHub issues #318-#322 are still open, close or relabel them against the Expo rewrite/cutover.

### P1 - Engineering runbooks should be marked legacy, not live

1. [[ios-ci-setup]]
   - Conflict: describes live `.github/workflows/ci.yml` iOS lane with XcodeGen and Xcode 15.4. Cutover says legacy Swift `ios` CI and Swift TestFlight jobs are disabled.
   - Recommended fix: add `status: legacy` and a top banner pointing to `mobile/README.md`, `docs/agents/verification.md`, and [[expo-release-cutover]].

2. [[auth-apple-link-testing]]
   - Conflict: test split is Swift/XCTest and TestFlight specific.
   - Recommended fix: mark as legacy Swift test strategy. Keep as behavior evidence for Account claim / Apple auth semantics.

3. [[ratification-push-hardclose]]
4. [[checkin-telemetry]]
5. [[waiting-fire-trigger]]
   - Conflict: implementation sections name Swift modules (`PushCoordinator.swift`, `CheckinScreen.swift`, `WaitingScreen.swift`, etc.).
   - Recommended fix: keep backend/product mechanics, but add "Swift implementation section is legacy; active client implementation belongs in `mobile/`."

### P2 - Product/design notes with Swift wording are mostly historical but need banners

These should not be rewritten deeply unless the product decision changed. Add supersession notes where they are still "decisions-locked" or otherwise likely to be consulted.

1. [[../50_product/0.1.0-search-area-picker]]
   - Conflict: says active editor is full-screen Apple MapKit and follow-up is "Update iOS".
   - Nuance: Product language for Search Area still applies; exact MapKit implementation changed to Expo/native abstraction.
   - Recommended fix: add an amendment pointing to ADR 0021/TB-17: C-28 behavior remains, but active implementation target is `mobile/`, not Swift.

2. [[../50_product/0.1.0-workflow-overhaul-plan-setup]]
   - Conflict: "Plan creators are always Account members (iOS-only creation)" and "iOS does not subscribe plans to Realtime"; Setup inventory still has older C-23/distance-slider language before later amendment.
   - Recommended fix: add a current-stack note and point C-23/distance supersession to C-28/Search Area. Product semantics remain useful.

3. [[../50_product/0.1.0-workflow-overhaul-plan-list]]
   - Conflict: references iOS-native disclosure/context conventions in locked decisions.
   - Recommended fix: keep as product/design rationale; add note that active UI implementation is Expo React Native and platform conventions should be adapted, not copied as SwiftUI.

4. [[../50_product/0.1.0-scope]]
   - Conflict: draft still says external source is Yelp or Google, iOS push only, timer/radius PRD-grill items. Some of this is older than later product locks.
   - Recommended fix: mark superseded or add a "historical draft" banner to avoid conflict with newer PRDs/ADRs.

5. [[../30_design/0.1.0-directions]]
6. [[../30_design/sunset-pop-handover]]
   - Status already `superseded`.
   - Conflict: "translate to SwiftUI later."
   - Recommended fix: low priority. Existing status is enough unless agents keep citing them.

### P2 - ADR index is mostly correct, but ADR 0001 frontmatter should reflect supersession

[[adr/_index]] correctly says ADR 0021 updates ADR 0001. But [[adr/0001-ios-tech-stack-supabase]] still has:

- `status: accepted`
- `superseded_by: null`

Recommended fix:

- Set `superseded_by: 0021` or add an explicit top note that only the Swift client portion is superseded; Supabase/backend choice remains accepted.
- Do not rewrite ADR 0001 itself. Preserve decision history.

## Leave alone as historical/archive

These have Swift references but should mostly stay untouched unless being reorganized:

- Completed `gti-vault/15_issues/0.1.0/issues/*` notes with `status: done`.
- AFK run logs in `gti-vault/15_issues/_runs/`.
- Research bundles such as `60_engineering/research/ios-stack-2026-05/`.
- Superseded design direction docs, if already clearly marked `status: superseded`.
- Swift implementation postmortems/diagnostics where the point is historical root cause.

## Suggested cleanup order

1. Fix agent-risk docs: [[stack-patterns]], [[../10_prds/0.1.0-prd]], [[../10_prds/0.1.0-quiz-redesign-prd]], [[github-actions-secrets]], [[codex-project-memory]].
2. Supersede old Search Area Swift issues and update [[../15_issues/0.1.0/_index]].
3. Mark Swift runbooks legacy: [[ios-ci-setup]], [[auth-apple-link-testing]], [[ratification-push-hardclose]], [[checkin-telemetry]], [[waiting-fire-trigger]].
4. Add light amendment banners to product/design decision notes whose behavior survives but implementation target changed.
5. Update ADR 0001 frontmatter/top note to point at ADR 0021 for client-stack supersession.

## Bottom line

The vault has the correct cutover records, but older high-authority docs still read as live Swift instructions. Biggest risk is not historical clutter; it is future agents pulling from `stack-patterns`, old PRDs, or still-ready `tb-SA-*` tickets and making changes in `ios/` after `mobile/` became the active app.
