---
issue: bug-28
title: Solo verdict screen drops the audience subtitle entirely; group keeps "ALL N OF YOU"
status: done
type: AFK
github_issue: 228
created: 2026-05-24
grilled: 2026-05-24
---

# bug-28 — Solo time-badge audience copy

## Symptom

On the verdict screen (S05), in solo mode, the time-badge subtitle reads "All one of you" (or equivalent — the templated `All N of you` evaluated with N=1). Per the S05 spec, solo mode is supposed to render "You" instead — the communal `"All N of you"` frame does not apply to a single voice.

User report: "In solo mode, 'All one of you' appears under the verdict time, which is kind of strange."

## Root cause (likely)

Confirmed in code:

- `design-system/surfaces/05-verdict.md` §solo (locked): *"Time-badge audience reads `"You"` rather than `"All N of you"` — communal frame doesn't apply to a single voice."*
- `ios/Sources/App/VerdictStore.swift:25-26,266` carries the audience-copy contract and a comment acknowledging `"All one of you"` is wrong-pitched.
- `ios/Sources/App/VerdictScreen.swift:435` renders `verdict.timeBadge.audience.uppercased()` — the renderer is correct; the producer (`VerdictStore`) is presumably falling through the templated path on solo rooms instead of branching to `"You"`.

The branch is missing or guarded incorrectly in `VerdictStore` when `members.length === 1` (per the S05 §solo trigger).

## Suggested direction (triage to confirm)

- Add or restore the `isSolo → audience = "You"` branch in `VerdictStore` `TimeBadge` construction.
- Unit-test the audience copy for `members=1` (solo) and `members=N` (N≥2) so the regression does not return.

Likely classified as `bug` / `AFK`. Confirm in grill.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `design-system/surfaces/05-verdict.md` §solo — the locked "You" / "All N of you" contract.
- `ios/Sources/App/VerdictStore.swift:25-26,88,146,266` — `TimeBadge` construction + the in-code note.
- `ios/Sources/App/VerdictScreen.swift:50,60,68,91,435` — `TimeBadge` surface render.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this with a **scope amendment** — the issue is not a pure bug ("producer falls through templated path"). The user reframed it during the grill: applying UI/UX simplicity principles, the solo audience subtitle isn't load-bearing information, so the spec line that says `"You"` is itself wrong — it should drop the audience subtitle entirely on solo. Group mode is unchanged. Classified `spec-gap` + `AFK`. Bundle the spec edit and the iOS port fix in a single AFK PR.

### Resolved decision

- **Group mode time-badge audience:** **unchanged.** Keep `"ALL N OF YOU"` exactly as the locked spec at `surfaces/05-verdict.md` line 75 specifies. The communal frame is the celebratory beat — it earns its place; the spec authors wrote that line on purpose; stripping it would collapse the badge into a clock readout.
- **Solo mode time-badge audience:** **dropped entirely.** Not relabeled to `"YOU"` — removed. The communal frame self-cancels with `N = 1`; `"YOU"` is a hedge against the "ALL ONE OF YOU" pitch error and adds no information beyond what the solo voter already knows. The badge renders the timestamp alone.

The user's framing: *"We don't need to say what is already understood."*

### Fix scope

- **Spec edit** — `design-system/surfaces/05-verdict.md`:
  - §solo (line 57 / §"solo" block): remove the sentence *"Time-badge audience reads `"You"` rather than `"All N of you"` — communal frame doesn't apply to a single voice."* Replace with: *"Time badge renders the timestamp only — no audience subtitle. The communal frame self-cancels with `N = 1`; the solo voter already knows it's them."*
  - §Formatting (line 75): keep the `"ALL FOUR OF YOU"` group rule. Update the solo carve-out to: *"In `solo` the audience subtitle is **omitted** — the badge renders the timestamp alone."*
  - §"VO order" (around line 97): the solo VO sequence drops the audience node. Sequence on solo is `eyebrow → hero → meta → time (timestamp only) → rule chip → CTA`.
  - §solo VO body (around line 104): rewrite the time-badge sentence: *"Time badge renders the timestamp only. Audience subtitle is suppressed in solo — the communal `"All N of you"` frame does not apply, and replacing it with `"You"` would only restate what the solo voter already knows."*
- **Spec edit** — `design-system/accessibility.md`:
  - Update the §"Time badge audience" VO entry: group keeps `"All N of you"` announced after the timestamp; solo no longer announces an audience string.
- **iOS port** — `ios/Sources/App/VerdictStore.swift`:
  - In the `TimeBadge` construction, when `isSolo` (a.k.a. `members.length === 1` AND the initiator did not share — per `surfaces/05-verdict.md` §solo trigger), set `audience = nil` (or whatever the appropriate Swift `nil`/empty-Optional pattern is on that type).
  - Group path is unchanged — the existing templated `"All N of you"` continues to fire when `members.length >= 2`.
- **iOS port** — `ios/Sources/App/VerdictScreen.swift`:
  - The renderer at line 435 (`verdict.timeBadge.audience.uppercased()`) currently force-unwraps or trusts the audience to be present. Make it conditional: when `audience == nil` or empty, the audience `Text` element is not rendered at all (no empty `Text("")` placeholder — the parent VStack's spacing collapses naturally).
- **Tests** — `ios/Tests/`:
  - Unit-test `VerdictStore` `TimeBadge` construction for `members = 1` (audience is `nil`) and `members = N≥2` (audience is `"ALL N OF YOU"` exactly).
  - Snapshot test `VerdictScreen` solo mode: time badge renders the timestamp string with no second line below it.

### Verification

- `node design-system/scripts/verify.mjs` green.
- iOS simulator: solo verdict screen renders the time badge as a single line (just the timestamp). No `"YOU"`, no `"ALL ONE OF YOU"`.
- iOS simulator: group verdict screen (≥ 2 members) renders the time badge with two lines, the second being `"ALL N OF YOU"`. Unchanged from current behavior.

### Out of scope

- Any change to the time-badge typography, shadow, or position. The visual treatment is locked; only the audience subtitle's presence in solo changes.
- Any change to the group-mode audience copy.
- Any change to verdict modes outside `solo` and `default` (the `no-survivor` mode already suppresses the time badge entirely, per the existing spec).

## Comments

- 2026-05-24 — AFK execution complete. Spec amended (`design-system/surfaces/05-verdict.md` §Modes / §"Copy register" / §solo, `design-system/accessibility.md` §"Verdict (solo mode)" + §"VoiceOver labels", `design-system/CHANGELOG.md`). JSX (`design-system/code/screens/ScreenVerdict.jsx`) drops the subtitle entirely on solo. iOS port: `VerdictStore.audienceCopy(forMemberCount:)` returns `""` for `n == 1`; `VerdictScreen.timeBadge` renders the subtitle `Text` only when audience is non-empty; `ScreenFixtures.soloFixture()` updated. Test suite updated: `VerdictStoreTests.testAudienceCopyForSolo` now asserts empty string; `VerdictScreenSoloTests.testSoloFixtureTimeBadgeAudienceIsOmitted` (renamed from `…IsYou`); new `VerdictScreenSnapshotTests.testTimeBadgeRendersWithoutCrashingWhenAudienceIsEmpty` covers the renderer's empty-subtitle path. `node design-system/scripts/verify.mjs` green.
