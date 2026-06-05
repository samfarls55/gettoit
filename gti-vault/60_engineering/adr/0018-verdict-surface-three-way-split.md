---
adr: 0018
title: Verdict surface split â€” live / read-only / no-survivor
status: accepted
date: 2026-05-26
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0018 â€” Verdict surface split â€” live / read-only / no-survivor

## Status

Accepted â€” 2026-05-26. Outcome of the `/workflow-review` grill on `VerdictScreen.swift` finding #1 (audit report `gti-vault/15_issues/_runs/2026-05-26-0958-workflow-review.md`). Records a Focus-surface decomposition forced by single-intent boundary in [[gti-vault/30_design/interaction-patterns/surfaces|surfaces.md Â§Focus]].

## Context

`VerdictScreen.swift` (1,179 lines, one struct) carries a five-case `Mode` enum â€” `.default`, `.committed`, `.readOnly`, `.solo`, `.noSurvivor`. The cases gate mutually exclusive layouts via a `ModeSnapshot` struct with seven flags (`showHomeChrome`, `showTimeBadge`, `showReceipts`, `showSaveTasteProfileChip`, etc.) and a per-mode CTA-label switch:

| Mode | Eyebrow | Hero | Time badge | Receipts | Home chrome | Primary CTA | Solo chip |
|---|---|---|---|---|---|---|---|
| `.default` | "Tonight, the verdict is" | venue | yes | yes | yes | `I'm in` | no |
| `.committed` | same | venue | yes | yes | yes | `N of M in` + countdown | no |
| `.solo` | same | venue | time-only | no | yes | `I'm in` | yes |
| `.readOnly` | "Tonight's verdict" | venue | yes | yes | **no** | `Start a new decision` | no |
| `.noSurvivor` | "Tonight" | none | **no** | **no** | yes | `Widen radius` + slider | no |

Focus playbook ([[gti-vault/30_design/interaction-patterns/surfaces#Focus]]) requires one screen = one intent. The five modes collapse onto three distinct intents:

- **Live verdict** (`.default` / `.committed` / `.solo`) â€” "act on this verdict before the window closes." Same content shell (eyebrow + hero + time + receipts + reroll). Variations are sub-states of one intent: `committed` is the post-ratify flavor of `default`; `solo` swaps one chip (group-save â†’ taste-profile) and suppresses the self-receipted receipts row.
- **Read-only verdict** (`.readOnly`) â€” "show a closed verdict." No ratify, no reroll, no home chrome. CTA verb is `Start a new decision`, not `I'm in`. Reached by a Web invitee deep-linking into a `decided-expired` Plan or by an Account member opening an entry from PlanList's History section ([[gti-vault/30_design/interaction-patterns/surfaces#Overview]] history slot, grill #4).
- **No-survivor** (`.noSurvivor`) â€” "no decision; widen the search and re-run." Not a verdict surface at all â€” no hero, no time, no receipts. CTA is `Widen radius` with an inline range slider. Conceptually a `pending` â†’ `pending` self-loop, not a `decided` arrival.

CONTEXT.md backs the split: Plan state machine (`pending` â†’ `decided-active` â†’ `decided-expired`) maps cleanly onto the three intents. `.readOnly` is the `decided-expired` view; `.noSurvivor` is a `pending` retry; live verdict is `decided-active`.

The unified enum was load-bearing while the verdict mechanism stabilized (bug-22 home chrome, TB-13 solo mode, bug-32 eyebrow exhaustive switch). With those locks in place, the enum's cost â€” mode-conditional suppression scattered across 1,179 lines, snapshot-test combinatorial explosion, suppression rules drifting away from intent (`.readOnly` suppresses home chrome because *that surface has no home*, not because read-only is a flavor of verdict) â€” exceeds its benefit.

## Decision

Decompose `VerdictScreen` into three screens, each owning one intent. `VerdictRerollHost` (the caller hub) dispatches to one of the three based on room state, rather than routing all five enum cases through one screen.

### 1. `VerdictScreen` (live verdict)

- Keeps `.default`, `.committed`, `.solo` as a three-case `Flavor` enum (renamed from `Mode` to mark the scope contraction). Same content shell â€” eyebrow + hero + time-badge + receipts + reroll + home chrome.
- `.solo` flavor swaps the group-save chip for the C-22 save-taste-profile chip and suppresses the receipts row. Time-badge audience subtitle is omitted in solo (bug-28).
- `.committed` flavor surfaces the dock countdown secondary and the `N of M in` CTA label.
- Reroll burns, ratify, time-badge audience: all flavors share the same plumbing.

### 2. `VerdictReadOnlyScreen` (new file)

- Single intent: render a closed verdict. No `Mode` enum.
- Suppresses ratify, reroll, dock countdown, home chrome, save-chip. Renders eyebrow ("Tonight's verdict"), hero, time-badge, receipts.
- Primary CTA `Start a new decision` fires the existing `onAdvance` callback (today's `.readOnly` behavior â€” opens Solo Setup for a Web invitee, opens a new Plan for an Account member).
- This is the surface for both Web-invitee deep-link-into-closed-Plan AND Account-member History-detail (folds into grill #4 resolution).

### 3. `NoSurvivorScreen` (new file)

- Single intent: widen-and-retry. No `Mode` enum.
- No eyebrow-+-hero-+-time shell. Renders the no-survivor copy, the inline range slider, and the `Re-run Â· N.N mi` primary CTA.
- Home chrome preserved (this isn't a deep-linked terminal â€” the initiator owns this surface and PlanList is reachable).
- Reroll burns are conceptually separate from a quiz-rerun-with-wider-radius and are NOT exposed here (the no-survivor recovery does not consume a burn â€” open question for the implementation issue, but the default is "burns are reroll-specific, no-survivor widen is free").

### `VerdictRerollHost` dispatch

`VerdictRerollHost` reads room state once and dispatches:

- `room.kind == .noSurvivor` â†’ `NoSurvivorScreen`
- `room.plan.status == .decidedExpired` OR deep-link arrival on someone-else's-Plan â†’ `VerdictReadOnlyScreen`
- otherwise â†’ `VerdictScreen` (live, with appropriate flavor)

The host keeps the same plumbing it has today; only the leaf changes.

## Considered alternatives

- **Keep one screen, one enum.** Rejected: violates Focus single-intent gate. Suppression flags have grown from one (the original `committed` ratify-disable) to seven, and snapshot tests are at five-mode combinatorial coverage. The cost of adding a sixth mode (e.g. a "post-checkin recap" variant) without splitting is high enough that the split pays for itself within the pre-public-launch milestone.
- **Two-way split (live vs read-only), keep no-survivor on live.** Rejected: `.noSurvivor` has no hero, no time badge, no receipts. It's a different surface wearing the verdict suit. Keeping it grafted onto live verdict re-creates the suppression-flag problem on a smaller scale.
- **Five-way split (one screen per mode).** Rejected: over-decomposes. `.default` / `.committed` / `.solo` share enough shell content (eyebrow + hero + time-badge + receipts) that splitting them triples the surface-doc maintenance and the snapshot suite for no IA win. Sub-flavor enum within `VerdictScreen` is the right grain.

## Consequences

- **Audit finding #16** (`Restore Escape affordance on VerdictScreen .readOnly`, `Blocked by: 1`) is **re-scoped**, not closed. The Home chrome will exist on `VerdictReadOnlyScreen` by default (it's a real surface with a real destination â€” see Web-invitee Plan-list-equivalent question, deferred to grill #2 / #3 / #4 resolution). The "restore escape affordance" framing becomes "ensure `VerdictReadOnlyScreen` renders chrome appropriate to its arrival vector." Re-open and re-scope; do not modify it here.
- **Snapshot tests** drop from five-mode combinatorial coverage on one struct to three independent suites. Net test count likely falls.
- **Implementation work** spawns as an AFK issue (mirrored to GitHub per [[feedback_always_mirror_issues_to_github]]). Issue carries the file-shape and the dispatch contract; AFK agent owns the actual extraction.

## See also

- [[gti-vault/30_design/interaction-patterns/surfaces#Focus]] â€” Focus single-intent gate
- [[gti-vault/30_design/interaction-patterns/surfaces#Overview]] â€” History detail destination (grill #4 dependency)
- [[CONTEXT|CONTEXT.md]] â€” Plan state machine (`pending` / `decided-active` / `decided-expired`)
- Audit report: `gti-vault/15_issues/_runs/2026-05-26-0958-workflow-review.md` finding #1, #16
- `ios/Sources/App/VerdictScreen.swift` â€” current 5-mode struct
- `ios/Sources/App/VerdictRerollHost.swift` â€” caller hub
