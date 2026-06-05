---
issue: bug-28
title: Solo verdict screen drops the audience subtitle entirely; group keeps "ALL N OF YOU"
status: done
type: AFK
github_issue: 228
created: 2026-05-24
grilled: 2026-05-24
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-28 â€” Solo time-badge audience copy

## Symptom

On the verdict screen (S05), in solo mode, the time-badge subtitle reads "All one of you" (or equivalent â€” the templated `All N of you` evaluated with N=1). Per the S05 spec, solo mode is supposed to render "You" instead â€” the communal `"All N of you"` frame does not apply to a single voice.

User report: "In solo mode, 'All one of you' appears under the verdict time, which is kind of strange."

## Root cause (likely)

Confirmed in code:

- `ios/Sources/App/VerdictStore.swift:25-26,266` carries the audience-copy contract and a comment acknowledging `"All one of you"` is wrong-pitched.
- `ios/Sources/App/VerdictScreen.swift:435` renders `verdict.timeBadge.audience.uppercased()` â€” the renderer is correct; the producer (`VerdictStore`) is presumably falling through the templated path on solo rooms instead of branching to `"You"`.

The branch is missing or guarded incorrectly in `VerdictStore` when `members.length === 1` (per the S05 Â§solo trigger).

## Suggested direction (triage to confirm)

- Add or restore the `isSolo â†’ audience = "You"` branch in `VerdictStore` `TimeBadge` construction.
- Unit-test the audience copy for `members=1` (solo) and `members=N` (Nâ‰¥2) so the regression does not return.

Likely classified as `bug` / `AFK`. Confirm in grill.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `ios/Sources/App/VerdictStore.swift:25-26,88,146,266` â€” `TimeBadge` construction + the in-code note.
- `ios/Sources/App/VerdictScreen.swift:50,60,68,91,435` â€” `TimeBadge` surface render.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this with a **scope amendment** â€” the issue is not a pure bug ("producer falls through templated path"). The user reframed it during the grill: applying UI/UX simplicity principles, the solo audience subtitle isn't load-bearing information, so the spec line that says `"You"` is itself wrong â€” it should drop the audience subtitle entirely on solo. Group mode is unchanged. Classified `spec-gap` + `AFK`. Bundle the spec edit and the iOS port fix in a single AFK PR.

### Resolved decision

- **Group mode time-badge audience:** **unchanged.** Keep `"ALL N OF YOU"` exactly as the locked spec at `surfaces/05-verdict.md` line 75 specifies. The communal frame is the celebratory beat â€” it earns its place; the spec authors wrote that line on purpose; stripping it would collapse the badge into a clock readout.
- **Solo mode time-badge audience:** **dropped entirely.** Not relabeled to `"YOU"` â€” removed. The communal frame self-cancels with `N = 1`; `"YOU"` is a hedge against the "ALL ONE OF YOU" pitch error and adds no information beyond what the solo voter already knows. The badge renders the timestamp alone.

The user's framing: *"We don't need to say what is already understood."*

### Fix scope

  - Â§solo (line 57 / Â§"solo" block): remove the sentence *"Time-badge audience reads `"You"` rather than `"All N of you"` â€” communal frame doesn't apply to a single voice."* Replace with: *"Time badge renders the timestamp only â€” no audience subtitle. The communal frame self-cancels with `N = 1`; the solo voter already knows it's them."*
  - Â§Formatting (line 75): keep the `"ALL FOUR OF YOU"` group rule. Update the solo carve-out to: *"In `solo` the audience subtitle is **omitted** â€” the badge renders the timestamp alone."*
  - Â§"VO order" (around line 97): the solo VO sequence drops the audience node. Sequence on solo is `eyebrow â†’ hero â†’ meta â†’ time (timestamp only) â†’ rule chip â†’ CTA`.
  - Â§solo VO body (around line 104): rewrite the time-badge sentence: *"Time badge renders the timestamp only. Audience subtitle is suppressed in solo â€” the communal `"All N of you"` frame does not apply, and replacing it with `"You"` would only restate what the solo voter already knows."*
  - Update the Â§"Time badge audience" VO entry: group keeps `"All N of you"` announced after the timestamp; solo no longer announces an audience string.
- **iOS port** â€” `ios/Sources/App/VerdictStore.swift`:
  - In the `TimeBadge` construction, when `isSolo` (a.k.a. `members.length === 1` AND the initiator did not share â€” per `surfaces/05-verdict.md` Â§solo trigger), set `audience = nil` (or whatever the appropriate Swift `nil`/empty-Optional pattern is on that type).
  - Group path is unchanged â€” the existing templated `"All N of you"` continues to fire when `members.length >= 2`.
- **iOS port** â€” `ios/Sources/App/VerdictScreen.swift`:
  - The renderer at line 435 (`verdict.timeBadge.audience.uppercased()`) currently force-unwraps or trusts the audience to be present. Make it conditional: when `audience == nil` or empty, the audience `Text` element is not rendered at all (no empty `Text("")` placeholder â€” the parent VStack's spacing collapses naturally).
- **Tests** â€” `ios/Tests/`:
  - Unit-test `VerdictStore` `TimeBadge` construction for `members = 1` (audience is `nil`) and `members = Nâ‰¥2` (audience is `"ALL N OF YOU"` exactly).
  - Snapshot test `VerdictScreen` solo mode: time badge renders the timestamp string with no second line below it.

### Verification

- iOS simulator: solo verdict screen renders the time badge as a single line (just the timestamp). No `"YOU"`, no `"ALL ONE OF YOU"`.
- iOS simulator: group verdict screen (â‰¥ 2 members) renders the time badge with two lines, the second being `"ALL N OF YOU"`. Unchanged from current behavior.

### Out of scope

- Any change to the time-badge typography, shadow, or position. The visual treatment is locked; only the audience subtitle's presence in solo changes.
- Any change to the group-mode audience copy.
- Any change to verdict modes outside `solo` and `default` (the `no-survivor` mode already suppresses the time badge entirely, per the existing spec).

## Comments

