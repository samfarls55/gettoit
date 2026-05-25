---
issue: bug-27
title: Reroll feature unplumbed — S05 tertiary CTA is dead, S07 sheet never presented
status: done
type: AFK
github_issue: 227
created: 2026-05-24
grilled: 2026-05-24
diagnosed: 2026-05-25
done: 2026-05-25
pr: 237
---

# bug-27 — Reroll feature unplumbed

## Symptom

On S05 Verdict, the tertiary "Reroll" button does nothing on tap. Sheet never opens. RPC never fires. Cap stamp never updates. No user-visible feedback.

## Diagnosis (2026-05-25)

`/diagnose` against prod Supabase telemetry + iOS source grep.

**Loop**: prod telemetry as captured trace (no Mac available; client-only loop blocked).

**Repro**:
- `select count(*) from rerolls` → **0 rows ever**.
- Last 24h Supabase api logs → **0 `apply_reroll` RPC calls** despite normal verdict/vote/plan traffic.

**Root cause**: the reroll feature is built end-to-end but never plumbed into the verdict-screen host.

- `VerdictScreen` declares `onReroll: @escaping () -> Void = {}` at `ios/Sources/App/VerdictScreen.swift:240` — a no-op default.
- **All 5** `VerdictScreen(...)` call sites omit `onReroll:`:
  - `ios/Sources/App/RootView.swift:278` — read-only late-joiner (`.readOnly` mode, reroll suppressed by mode → wiring not required).
  - `ios/Sources/App/RootView.swift:404` — read-only joined card (`.readOnly`, suppressed → not required).
  - `ios/Sources/App/RootView.swift:424` — **createdDecidedVerdict** (`.default`, `isInitiator: true`) → **reroll affordance LIVE, dead callback**.
  - `ios/Sources/App/RootView.swift:439` — createdHistoryVerdict (`.readOnly`, suppressed → not required).
  - `ios/Sources/App/PostQuizHostScreen.swift:64` — **post-quiz verdict** (`isInitiator: true`, `mode: view.mode` typically `.default`) → **reroll affordance LIVE, dead callback**.
- Tertiary "Reroll" button at `VerdictScreen.swift:679` calls `onReroll` → default `{}` → dead tap at both live sites.
- `RerollStore(` constructed in 0 production files (only `RerollScreenSnapshotTests.swift`).
- `RerollScreen(` mounted in 0 production files (only snapshot tests).

The S07 sheet, the S07 RerollScreen view, the RerollStore client, the apply_reroll RPC, the ADR 0016 window guard, the compute-verdict re-run — all built, all untouched at runtime.

**Predictions verified**: if `onReroll` is unwired, no RPC fires anywhere → 0 calls in 24h api logs, 0 rows in `rerolls` table across full prod history. Confirmed.

**Re-classification**: bug → missing-feature-wire-up. AFK-ready.

## Fix scope

Two production VerdictScreen sites need plumbing. The other three are `.readOnly` and the reroll tertiary is suppressed by mode at render — leave alone.

### Per live site (`RootView.swift:424`, `PostQuizHostScreen.swift:64`)

1. Instantiate `RerollStore(client: coordinators.client, roomID: <room UUID from context>)`. Store as `@StateObject` / `@State` on the host view so its `@Published rerollsUsed` flows back into `VerdictScreen(rerollsUsed:)`.
2. Add `@State private var showingReroll: Bool = false` on the host view.
3. Wire `onReroll: { showingReroll = true }` on the `VerdictScreen(...)` constructor.
4. Add `.sheet(isPresented: $showingReroll)` presenting `RerollScreen(placeName: <verdict option name>, rerollsUsed: store.rerollsUsed, onCancel: { showingReroll = false }, onSubmit: { reason, detail, newVibe, dietChip in ... })`.
5. `onSubmit` closure: call `Task { try? await store.applyReroll(reason: reason, detail: detail, newVibe: newVibe, dietChip: dietChip); showingReroll = false }`. On success the existing Realtime verdict subscriber picks up the new verdict and S05 re-renders. On error surface `store.lastError` (toast or inline — pick the minimum that doesn't regress S05 layout; agent has autonomy on choice per `[[feedback_afk_full_autonomy]]`).
6. On host `.task` / `.onAppear`, call `await store.refreshUsedCount()` so the stamp on S07 + the rerollsUsed-driven CTA copy on S05 ("No rerolls left" at 3/3) start accurate.

### Architectural fix (do as part of this AFK)

Drop the default value from `VerdictScreen.onReroll`. Change the parameter signature from `onReroll: @escaping () -> Void = {}` to `onReroll: @escaping () -> Void` (no default). This forces every future call site to wire it explicitly. The read-only / no-survivor / history paths pass `onReroll: { }` explicitly — those modes already gate the affordance at render, so the empty closure is correct and explicit. The compiler now catches the bug-27 class of failure at the next call site added.

## Acceptance criteria

- Tap on S05 tertiary "Reroll" opens the S07 RerollScreen sheet on both:
  - createdDecidedVerdict path (S00 Plan list → tap a Decided-active Plan).
  - post-quiz verdict path (solo or group quiz completes → lands on S05).
- S07 reason selection + submit fires `apply_reroll` RPC against prod (visible as a row in `public.rerolls` + an api-log entry for `/rest/v1/rpc/apply_reroll`).
- After successful reroll: a new row appears in `verdicts` for the room (engine re-ran), and the S05 surface re-renders with the new pick via the existing Realtime subscriber.
- `rerollsUsed` count on S05 + S07 stamp reflects the current `rerolls` row count after each reroll.
- 3rd reroll surfaces the "Reroll · last one" + "After this, tonight is committed." copy per `RerollScreen.lastRerollNotice`.
- After 3rd reroll, S05 footer reads "No rerolls left" and the tertiary is replaced with the non-tappable label per `VerdictScreen.rerollTertiary` at `rerollsUsed >= 3`.
- `VerdictScreen.onReroll` has no default value; all five call sites pass it explicitly.
- Snapshot/UI regression test: a host-level test (or extending `RerollScreenSnapshotTests`) that asserts the sheet presents on tap of `verdict.cta.reroll` at one live site. If no clean seam exists, document that in the PR and skip the test — flag for `/improve-codebase-architecture`.

## Brief for AFK agent

You have full autonomy on:
- Where to place the `@State` / `@StateObject` (host view scope).
- Whether to use a `.sheet` or a custom presentation (sheet is the canonical choice).
- Whether to add a toast/inline-error or rely on existing error surfacing on failure (RerollStore already publishes `lastError`).
- The accessibility identifier suffix for the sheet host.

Pre-existing references that ground the work:
- `ios/Sources/App/RerollStore.swift` — store contract; init `(client: SupabaseClient, roomID: UUID)`, `applyReroll(reason:detail:newVibe:dietChip:) async throws -> ApplyResult`, `refreshUsedCount()`, `@Published rerollsUsed`.
- `ios/Sources/App/RerollScreen.swift` — S07 view; `Submit = (Reason, String?, Int?, String?) -> Void` is the `onSubmit` shape the host wires to `store.applyReroll`.
- `ios/Sources/App/VerdictScreen.swift:670` — `rerollTertiary` button declaration; the affordance the host must give a real `onReroll` to.
- `supabase/migrations/20260523000000000_reroll_window_deadline.sql:162` — current apply_reroll RPC; ADR 0016 window guard active. The fix does not touch the RPC.
- `gti-vault/60_engineering/adr/0016-plan-reroll-window.md` (if present) — context on window enforcement.

CI notes (re: `[[feedback_pr_merge_no_ci_gate]]`): no branch protection. Confirm checks green before merging. AFK lane shape per `[[feedback_ci_lane_shape]]` — single ci.yml job.

## References

- `ios/Sources/App/RerollStore.swift` — store, RPC call site, error mapping.
- `ios/Sources/App/RerollScreen.swift` — S07 surface.
- `ios/Sources/App/VerdictScreen.swift:220-254` — `onReroll` declaration, `rerollTertiary` at 670, the dead default at 240.
- `ios/Sources/App/RootView.swift:424` — createdDecidedVerdict mount (live site).
- `ios/Sources/App/PostQuizHostScreen.swift:64` — post-quiz verdict mount (live site).
- `supabase/migrations/20260514000300000_rerolls.sql` — TB-10 schema.
- `supabase/migrations/20260515000000000_votes_generic_jsonb.sql` — TB-04 generic jsonb rewrite of apply_reroll.
- `supabase/migrations/20260523000000000_reroll_window_deadline.sql` — ADR 0016 window guard.
- `design-system/surfaces/05-verdict.md` + `07-reroll.md` — surface contracts.
- [[bug-20-web-verdict-live-update-unwired]] — web analog (different surface, same "feature not wired" pattern; resolved).

## Surfaced by

User dogfood, 2026-05-24. Diagnosed via prod telemetry + iOS source grep, 2026-05-25.

## Comments

### 2026-05-25 — AFK execution closed (PR #237)

Landed the fix in [PR #237](https://github.com/samfarls55/gettoit/pull/237).

- New `VerdictRerollHost` SwiftUI view owns the `RerollStore` + the S07 `.sheet` presentation. Both live `VerdictScreen` sites (`RootView.createdDecidedVerdict` + `PostQuizHostScreen.verdictSurface`) now mount it instead of the bare screen.
- Architectural fix landed: `VerdictScreen.onReroll` no longer defaults to `{}`. The three `.readOnly` call sites pass `onReroll: { }` explicitly. The compiler now catches the next bug-27-class wire-up miss at the next added call site.
- `PostQuizHostScreen` gained an optional `client: SupabaseClient?` so the verdict phase can wire the host with real reroll plumbing. When nil (snapshot tests), the verdict phase falls back to a bare `VerdictScreen` with explicit `onReroll: { }`.
- Test seam: `RerollSheetState` is an `@Observable` with `present()` / `dismiss()` + a `private(set)` `isShowingSheet` flag. `VerdictRerollHostTests` asserts `present()` flips the flag — the load-bearing bug-27 contract.
- Skipped per spec (no clean seam): end-to-end button-tap simulation on the SwiftUI surface. Flagged for `/improve-codebase-architecture` — current iOS test target has no ViewInspector / XCUITest dep.
- Manual verification queued for next TestFlight build (no local Mac).

