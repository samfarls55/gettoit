---
issue: bug-29
title: Group Plan setup never presents share sheet — invitees can never join
status: ready-for-agent
type: AFK
github_issue: 236
created: 2026-05-25
grilled: 2026-05-25
diagnosed: 2026-05-25
---

# bug-29 — Setup share sheet missing

## Symptom

A user creates a Plan in Group or Duo mode, taps the primary CTA **"DROP THE INVITE LINK"** on SetupScreen, and is dropped straight into the Waiting screen with no iOS share sheet ever appearing. There is no way to send the invite URL to invitees. Invitees can never join.

## Diagnosis (2026-05-25)

`/diagnose` against the iOS source tree.

**Loop**: source grep — root cause is structural (deleted code, no replacement), so no runtime feedback loop required. Repro = open SetupScreen in `.create + .group`, tap primary CTA → routes straight to Quiz/Waiting, no sheet.

**Root cause**: PR #180 (commit `87e803a`, tb-WF-4, 2026-05-20, "Wire Plan setup surface — replaces S01 + S01b") retired `ios/Sources/App/InitiatorScreen.swift`. That screen owned the entire share-sheet wiring:

- `@State private var pendingShare: PendingShare?`
- `.sheet(item: $pendingShare) { share in ShareSheet(items: [share.url]) }`
- `private struct ShareSheet: UIViewControllerRepresentable` wrapping `UIActivityViewController`
- Primary-CTA path that built `InviteLink.url(roomID: room.id, inviteToken: token)` and assigned `pendingShare`
- `onSharedRoom: ((UUID) -> Void)?` callback that fired on sheet dismiss and flipped `invitedShared = true`

The replacement `ios/Sources/App/SetupScreen.swift` does **not** present a share sheet. Its primary CTA mints the Plan + Room and immediately fires `onLaunched(roomID, planID)`. `ios/Sources/App/RootView.swift:356-373` then routes straight to `startQuiz(...)` with `invitedShared = (context.groupMode == .group)` hardcoded — so the group flow correctly skips Solo gating and lands on Waiting, but the initiator never saw a share sheet, has no URL to send, and the invitees can never receive the link.

**Evidence**:

- Zero production callers of `InviteLink.url` in `ios/Sources/` (only `ios/Tests/InviteLinkTests.swift`).
- Zero occurrences of `ShareSheet`, `UIActivityViewController`, `PendingShare`, `pendingShare`, or `onSharedRoom` in `ios/Sources/`.
- Fossil comment at `ios/Sources/App/RootView.swift:362-363` references `pendingSetupShare` — that symbol does not exist anywhere in the repo (verified by `git log --all -S "pendingSetupShare"`).
- `TelemetryWriter.inviteShared(...)` at `ios/Sources/App/TelemetryWriter.swift:226` is declared but never called from production code → `invite_shared` telemetry event has not fired since 2026-05-20.

**Predictions verified**: if the share sheet was never re-wired, `invite_shared` telemetry rows in prod would drop to zero from 2026-05-20 onward; `InviteLink.url` would have zero production callers; the dock primary CTA copy ("DROP THE INVITE LINK") would visibly lie about what happens on tap. All three confirmed.

**Re-classification**: bug → missing-feature-wire-up. AFK-ready.

## Fix scope (option 1 — re-port share sheet into SetupScreen)

Re-port the deleted `PendingShare` + `ShareSheet` wiring directly into `SetupScreen.swift`. Smallest diff. Restores pre-tb-WF-4 behavior.

### Per-step

1. Add `private struct PendingShare: Identifiable, Equatable { let id: UUID; let url: URL }` and `private struct ShareSheet: UIViewControllerRepresentable { let items: [Any]; func makeUIViewController(...) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }; func updateUIViewController(...) {} }` inside `SetupScreen.swift` (or extract into a tiny shared file under `ios/Sources/App/` if you prefer — agent has autonomy).
2. Add `@State private var pendingShare: PendingShare?` on `SetupScreen`.
3. In the primary-CTA tap handler (the path that currently mints Plan + Room and fires `onLaunched`):
    - Solo path (`primaryLabel == "Start the quiz"`) — unchanged. Mint Plan + Room → `onLaunched`.
    - Group/duo path (`primaryLabel == "Drop the invite link"`) — mint Plan + Room → fetch the room's `inviteToken` → assign `pendingShare = PendingShare(id: room.id, url: InviteLink.url(roomID: room.id, inviteToken: token))`. Do **not** fire `onLaunched` yet.
4. Add `.sheet(item: $pendingShare) { share in ShareSheet(items: [share.url]) }` on the SetupScreen body (sibling to the existing `.sheet(isPresented: $locationSheetOpen)` LocationPickerSheet).
5. On sheet dismiss (the closure runs when the activity controller closes for any reason — share completed, share canceled, dismissed), fire `onLaunched(share.id, planID)` so RootView routes into Waiting. Mirror the retired InitiatorScreen behavior: dismiss-on-cancel still advances to Waiting (the Plan + Room are already minted; backing out via Setup back/exit is a separate path).
6. Fire `TelemetryWriter.inviteShared(roomID: share.id, userID: userID)` on dismiss as well — re-enables the `invite_shared` event. (Same cancel-counts-as-shared quirk as the retired code; flag is acceptable for v0.1.0, file a follow-up if telemetry fidelity becomes a question.)
7. Remove the fossil comment at `ios/Sources/App/RootView.swift:362-363` ("group runs the share-sheet flow via `pendingSetupShare`") and replace with one accurate line noting the share sheet now lives on SetupScreen.

### Out of scope (deliberate)

- No in-app re-share affordance on Waiting. (If Sam cancels the share sheet without sending, Sam has to back to the Plan list, re-open the pending Plan in edit mode, and re-tap primary to trigger the sheet again. Option 2 / option 3 in the diagnosis cover the re-share affordance — leave for a separate issue if dogfood surfaces it.)
- No edit-mode-vs-create-mode branching in the share path. Both modes go through the same step 3 group/duo path. Edit mode re-uses the existing `rooms.id` + `invite_token` so the URL is stable across re-shares.
- Solo path stays unchanged.

## Acceptance criteria

- In `.create + .group` (or `.duo`) mode, tapping "DROP THE INVITE LINK" on a name-valid SetupScreen presents the iOS share sheet over SetupScreen with a single canonical Universal Link URL as the share item — produced by `InviteLink.url(roomID:inviteToken:)`, byte-equal to `https://gettoit.app/join/<lowercase-uuid>?inviteToken=<token>` per ADR 0015 + `InviteLink.swift` (`host = "gettoit.app"`, `pathPrefix = "/join/"`, lowercase UUID in path, `inviteToken` query parameter).
- Picking Messages / Mail / Copy / AirDrop / any sharing target in the sheet sends the URL with no app-side modification.
- Dismissing the share sheet (share completed OR canceled) routes the initiator into Waiting (`invitedShared=true`, group flow per existing SoloPath logic).
- In `.edit + .group` (or `.duo`) mode against an existing pending Plan that has already minted a Room, tapping primary re-uses the same `rooms.id` + `invite_token` and presents a share sheet with the original URL — no duplicate Room is minted.
- In `.solo` mode (`primaryLabel == "Start the quiz"`), no share sheet is presented; the flow routes straight to Quiz Q1 as today.
- `TelemetryWriter.inviteShared(roomID:userID:)` is invoked exactly once on every share-sheet dismiss. `invite_shared` rows resume appearing in prod telemetry on the next group-mode session.
- The fossil comment at `RootView.swift:362-363` referencing `pendingSetupShare` is removed.
- Snapshot/UI regression test: a SetupScreen test that asserts `pendingShare` is non-nil after primary-CTA tap in group mode and nil after the sheet dismiss closure runs. If the existing `SetupScreenTests` pure-logic harness can't reach this — `UIActivityViewController` is UIKit-only and snapshot tests are fragile here — document why in the PR and skip the test. Flag for `/improve-codebase-architecture` if the seam is genuinely missing.
- Manual TestFlight verification (per `[[project_no_mac_ci_only_ios]]`): cut a TestFlight build, walk the group-mode CTA flow, confirm the share sheet appears and the URL pasted into a second device's browser hits the join surface.

## Brief for AFK agent

You have full autonomy on:

- Whether to inline `ShareSheet` + `PendingShare` inside `SetupScreen.swift` or extract into a sibling file. Inline matches the retired InitiatorScreen shape; extraction is fine if a follow-up surface (Waiting re-share) is anticipated soon.
- The accessibility identifier on the sheet host (e.g. `setup.share.sheet`).
- Error-path handling if `RoomStore.createRoom` fails before the share sheet would present — keep the existing `phase = .error(...)` flow; do not surface a share sheet over an error.
- Whether to flag the "cancel counts as shared" telemetry quirk in a vault note or leave to dogfood.

Pre-existing references that ground the work:

- `ios/Sources/App/InviteLink.swift` — `InviteLink.url(roomID:inviteToken:)` static; produces the canonical `https://gettoit.app/r/<id>?t=<token>` URL.
- `ios/Sources/App/RoomStore.swift` — `createRoom(...)` mints `rooms` row and returns `(id, inviteToken)`. SetupScreen already calls this on primary CTA today.
- `ios/Sources/App/SetupScreen.swift:329-373` — primary CTA derivation + the current launch path.
- `ios/Sources/App/RootView.swift:356-373` — `onLaunched` consumer; routes group mode into Waiting via `startQuiz(..., invitedShared: true)`.
- `ios/Sources/App/TelemetryWriter.swift:226-237` — `inviteShared(...)` emitter; PRD user story 8.
- `git show 87e803a -- ios/Sources/App/InitiatorScreen.swift` — retired implementation. Use as faithful reference for the `PendingShare` + `ShareSheet` shapes.

CI notes (re: `[[feedback_pr_merge_no_ci_gate]]`): no branch protection. Confirm checks green before merging. AFK lane shape per `[[feedback_ci_lane_shape]]` — single ci.yml job. Worktree gotcha per `[[feedback_worktree_env_not_propagated]]` — source secrets from `/workspace/.env` if needed (this issue does not need Supabase secrets at build time; only TestFlight CI does).

## References

- `ios/Sources/App/SetupScreen.swift` — the surface to extend.
- `ios/Sources/App/RootView.swift:356-373` — `onLaunched` wiring; fossil comment at `:362-363`.
- `ios/Sources/App/InviteLink.swift` — URL builder, unchanged.
- `ios/Sources/App/RoomStore.swift` — room mint, unchanged.
- `ios/Sources/App/TelemetryWriter.swift:226` — `inviteShared` emitter, currently unused.
- Commit `87e803a` (PR #180, tb-WF-4) — retired InitiatorScreen.swift; reference for the original share-sheet shape.
- `design-system/surfaces/01-setup.md` — surface contract; "Set it once. Share when you're ready." copy still accurate post-fix.
- `[[tb-wf-4-wire-plan-setup-surface]]` — PR #180 spec; share treatment was an omission, not a deliberate removal.
- `[[bug-27-reroll-broken]]` — sibling pattern (feature built end-to-end but never wired into host).

## Surfaced by

User dogfood, 2026-05-25. Diagnosed via iOS source grep + commit history, 2026-05-25.
