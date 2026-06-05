---
issue: bug-34
title: Split VerdictScreen into live / read-only / no-survivor surfaces (ADR 0018)
status: done
type: AFK
github_issue: 273
created: 2026-05-26
grilled: 2026-05-26
adr: 0018
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-34 â€” Split VerdictScreen into live / read-only / no-survivor (ADR 0018)

## Symptom

`ios/Sources/App/VerdictScreen.swift` (1,179 lines, one struct) carries a five-case `Mode` enum â€” `.default` / `.committed` / `.readOnly` / `.solo` / `.noSurvivor`. The cases gate mutually exclusive layouts via seven `ModeSnapshot` suppression flags and a per-mode CTA-label switch. Three problems compound:

- **Focus single-intent gate violated.** `surfaces.md Â§Focus` requires one screen = one intent. The five modes collapse onto three distinct intents (live verdict / read-only verdict / no-survivor) but share one struct. See [[gti-vault/60_engineering/adr/0018-verdict-surface-three-way-split|ADR 0018]] context.
- **Suppression-flag drift.** `.readOnly` suppresses Home chrome because *that surface has no Home destination*, not because read-only is a flavor of verdict; the flag pattern obscures the underlying surface decomposition.
- **Audit finding #16 cannot be cleanly fixed without the split.** "Restore Escape affordance on `.readOnly`" â€” restoring chrome on a sub-mode that doesn't have a clean destination is the wrong shape. The fix is "the read-only verdict is a separate surface with its own arrival vectors and its own chrome."

ADR 0018 (accepted 2026-05-26) decomposes the surface into three: `VerdictScreen` (live, three-case `Flavor` enum), `VerdictReadOnlyScreen` (new file), `NoSurvivorScreen` (new file). `VerdictRerollHost` dispatches.

## Scope

### What to build

**Three Swift files in `ios/Sources/App/`:**

1. **`VerdictScreen.swift`** (in place, refactor) â€” keep the eyebrow / hero / time-badge / receipts / reroll / Home-chrome shell. Replace the `Mode` enum with a `Flavor` enum carrying three cases: `default`, `committed`, `solo`. Delete the `.readOnly` and `.noSurvivor` code paths. Delete the `ModeSnapshot.showHomeChrome` flag (always true here). Keep `showReceipts` and `showTimeBadge`'s solo variations as `Flavor`-driven, not flag-driven.

2. **`VerdictReadOnlyScreen.swift`** (new file) â€” single-intent screen rendering a closed verdict. Same eyebrow ("Tonight's verdict") + hero + time-badge + receipts shell, but: no ratify, no reroll, no dock countdown, no save-chip. Primary CTA `Start a new decision` fires `onAdvance`. Home chrome is parameterised by arrival vector â€” `showHomeChrome: Bool` init param (true when reached from PlanList History or an Account member's deep link to their own closed Plan; false when reached by a Web invitee with no Plan-list equivalent). Re-uses the existing `Verdict` / `TimeBadge` / `Receipt` / `Cut` value types from `VerdictScreen.swift` (extract them to a shared `VerdictModels.swift` if needed to avoid duplication).

3. **`NoSurvivorScreen.swift`** (new file) â€” single-intent screen for widen-and-retry. No eyebrow shell. Renders the no-survivor copy, the inline range slider (extract from `VerdictScreen.swift`'s `widenSliderOpen` / `widenRadiusMiles` state), and a `Re-run Â· N.N mi` primary CTA. Home chrome present. Reroll burns NOT consumed by the widen action (the widen is free; document this in a one-line comment on the call site).

**`VerdictRerollHost.swift`** (refactor) â€” dispatch on room state:

- `room.kind == .noSurvivor` â†’ `NoSurvivorScreen`
- `room.plan.status == .decidedExpired` OR (deep-link arrival AND viewer not in room) â†’ `VerdictReadOnlyScreen` with `showHomeChrome` set per arrival vector
- otherwise â†’ `VerdictScreen` with appropriate flavor

### Design-system surface docs

Sweep `design-system/surfaces/05-verdict.md`:

- Strip the `.readOnly` and `.noSurvivor` mode rows from the mode table.
- Keep the three live flavors (`default` / `committed` / `solo`) on `05-verdict.md`.
- Spawn `design-system/surfaces/05a-verdict-read-only.md` for the read-only surface. Copy the read-only-specific eyebrow / CTA / chrome rules from `05-verdict.md` history.
- Spawn `design-system/surfaces/05b-no-survivor.md` for the no-survivor surface. Same shape â€” extract from `05-verdict.md`.
- Note: if grill #4 (PlanList History as separate Multilevel destination) lands FIRST and produces a History-detail surface doc, `05a` may collapse into that doc instead. Coordinate via `[[bug-37]]` if the grill #4 issue lands first.

### Test work

- Snapshot tests for `VerdictScreen` drop from five-mode coverage to three-flavor coverage.
- New snapshot tests for `VerdictReadOnlyScreen` (with and without Home chrome) and `NoSurvivorScreen` (collapsed and slider-expanded).
- Existing tests in `Tests/ScreenFixtures.swift` referencing `.readOnly` / `.noSurvivor` move to the new screens.
- Net snapshot count likely falls (combinatorial 5x â†’ 3 independent 2-3-state suites).

### Audit findings to re-scope, not close

- **Finding #16 (`Restore Escape affordance on VerdictScreen .readOnly`).** Currently `Blocked by: 1` in the audit report. Re-scope on PR: the Home chrome IS rendered on `VerdictReadOnlyScreen` when `showHomeChrome` is true; the original framing ("restore on .readOnly") becomes "wire the arrival-vector-aware chrome flag." Re-open the audit-finding issue (or its `/to-issues` mirror) with the new framing once that PR is created â€” do not modify or close it in this PR.

## Acceptance criteria

- [ ] `VerdictScreen.swift` carries a `Flavor` enum with three cases (`default`, `committed`, `solo`). `.readOnly` and `.noSurvivor` are deleted from this file.
- [ ] `VerdictReadOnlyScreen.swift` exists, renders the closed-verdict shell, takes `showHomeChrome: Bool` init param.
- [ ] `NoSurvivorScreen.swift` exists, renders the widen-and-retry surface.
- [ ] `VerdictRerollHost.swift` dispatches on room state (no-survivor / decided-expired / live).
- [ ] All `mode == .readOnly` and `mode == .noSurvivor` reads are gone from the codebase (grep clean).
- [ ] Shared value types (`Verdict`, `TimeBadge`, `Receipt`, `Cut`) live in one place (in `VerdictScreen.swift` and re-imported, OR extracted to `VerdictModels.swift` â€” agent's call).
- [ ] Snapshot suite covers all three surfaces; existing read-only and no-survivor fixtures relocated to the new suites.
- [ ] `design-system/surfaces/05-verdict.md` covers only the three live flavors. `05a-verdict-read-only.md` and `05b-no-survivor.md` exist and reference each other + `05-verdict.md`.
- [ ] CONTEXT.md "Verdict surfaces" vocabulary section (added 2026-05-26 alongside ADR 0018) is consistent with the file shapes shipped.
- [ ] Snapshot baseline images regenerated where layout shifts (chrome row presence, CTA label differences are pre-existing per-mode behavior â€” visual diffs should be minimal-to-zero for content; mostly file/struct boundaries).
- [ ] Audit finding #16 issue (when surfaced by the separate `/to-issues` session for findings #6-31) gets re-opened with the re-scoped framing â€” flagged in the PR body, not done in this PR.

## Notes for agent

- **Full autonomy on extraction boundaries.** ADR 0018 dictates the three-surface shape; everything else (whether to extract a `VerdictModels.swift`, whether to share the receipts-row View as a sub-component between live and read-only, how to refactor `VerdictRerollHost`'s state-derivation) is the agent's call per [[feedback_afk_full_autonomy]].
- **Worktree env.** `.env` is gitignored. If the AFK harness lands you in an isolated worktree, source secrets from `/workspace/.env` per [[feedback_worktree_env_not_propagated]].
- **No CI gate.** PR merge auto-merges; confirm checks green before merging per [[feedback_pr_merge_no_ci_gate]].
- **Burns and widen.** The widen-radius action on `NoSurvivorScreen` does NOT consume a reroll burn. Reroll burns are reroll-specific (`07-reroll.md` mechanics); the no-survivor recovery is a quiz-pool-fetch retry, not a verdict reroll. Document this in a one-line comment on the widen-CTA action.

## Surfaced by

`/workflow-review` audit, 2026-05-26. Finding #1, S1 cognition tier. Grill closed 2026-05-26 via `/grill-with-docs`. ADR 0018 accepted same day.

## Comments

- 2026-05-26 â€” AFK run executed the split per ADR 0018. Three Swift files in `ios/Sources/App/`: `VerdictScreen.swift` keeps the live shell with a three-case `Flavor` enum (`.default` / `.committed` / `.solo`); `VerdictReadOnlyScreen.swift` is the new closed-verdict surface with the arrival-vector-aware `showHomeChrome` flag; `NoSurvivorScreen.swift` is the new widen-and-retry surface. The shared `Verdict` / `TimeBadge` / `Receipt` / `Cut` value types stayed nested on `VerdictScreen` (no `VerdictModels.swift` extraction needed â€” the new screens reference them via `VerdictScreen.Verdict`, etc.). `VerdictRerollHost` is now a dispatcher: callers pass a `Surface` enum (`.live(flavor:)` / `.readOnly(showHomeChrome:)` / `.noSurvivor`), and the host mounts the right leaf â€” with the `RerollStore` plumbing only on `.live`. The `VerdictScreen.Mode` enum moved to `VerdictStore.Mode` (it's the data-layer signal, not the view's render flavor). `design-system/surfaces/05-verdict.md` now covers only the three live flavors; `05a-verdict-read-only.md` and `05b-no-survivor.md` are the new sibling surface docs. The `design-system/scripts/verify.mjs` pairing rule was extended to accept `jsx: []` for sub-surface docs that share a parent's JSX (one JSX file, three Swift files â€” explicit sub-surface opt-out beats double-claim or orphan jsx errors). Finding #16 (`Restore Escape affordance on VerdictScreen .readOnly`) is flagged in the PR body for re-scoping but not modified or closed in this PR per spec.

## References

- [[gti-vault/60_engineering/adr/0018-verdict-surface-three-way-split|ADR 0018]] â€” the binding decision
- [[CONTEXT|CONTEXT.md]] Â§"Verdict surfaces" â€” surface vocabulary
- [[gti-vault/30_design/interaction-patterns/surfaces#Focus]] â€” Focus single-intent gate
- Audit report: `gti-vault/15_issues/_runs/2026-05-26-0958-workflow-review.md` finding #1, finding #16
- `ios/Sources/App/VerdictScreen.swift` â€” current 5-mode struct
- `ios/Sources/App/VerdictRerollHost.swift` â€” caller hub
- `design-system/surfaces/05-verdict.md` â€” current spec (5 modes; to be split)
- [[bug-22]] â€” prior verdict-chrome refactor (Home repositioning)
- [[bug-32]] â€” VerdictScreen.modeSnapshot eyebrow exhaustive switch (the last 5-mode lock)
