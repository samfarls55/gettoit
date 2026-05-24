---
issue: bug-25
title: Quiz progress strip layout regression after tb-WF-2 chrome — Q1 pushed down, Q2–Q5 skewed right
status: ready-for-agent
github_issue: 225
created: 2026-05-24
grilled: 2026-05-24
---

# bug-25 — Quiz progress strip layout regression

## Symptom

Since the Exit + Back chrome row was added to the question screens (tb-WF-2 / sg-WF-2), the 5-segment progress strip at the top of every quiz question is mis-positioned in two distinct ways:

1. **Q1.** The progress strip renders far down the screen — visually closer to the middle of the screen than to the top — instead of sitting at the top.
2. **Q2–Q5.** The progress strip returns to the top, but is **off-centered to the right** rather than horizontally centered as it was before tb-WF-2.

User report: "Ever since adding the exit and back buttons to the question screens, there are a few bugs. The Q1 UI is pushed very far down (the 5 bars at top of screen render towards the middle instead of on top). For all other questions, the bar comes back up to the top but is off centered (skewed towards the right)."

## Probable root cause (triage to confirm)

Trace from the post-tb-WF-2 layout in `ios/Sources/App/QuizScreen.swift`:

- The `QuizChromeView` row sits above `topBar` in a `VStack(spacing: 0)`. Its leading slot collapses to a 44pt-wide `Color.clear` spacer **when `canBack == false`** (Q1), while the trailing `Exit/Leave` label anchors to the trailing edge. On **Q1 only** (`canBack: false`), the chrome's height treatment may be interacting with the `padding(.top, step4)` + the topBar's `padding(.top, step3)` to push the topBar visibly into the middle of the screen — or the `content` `VStack` alignment + the gradient `.ignoresSafeArea` is shifting Q1's visual top.
- The `topBar` HStack is `Color.clear width:32` (leading spacer, sized to where the C-02 `×` used to sit), then the 5-bar HStack, with **no trailing spacer**. The bars expand to fill the available width, but with the chrome row above now anchoring `Exit` to the trailing edge (and no symmetric leading anchor on Q1), the effective horizontal centering of the bar row is broken — bars sit right-of-center.

Both are layout-only regressions — no behavior change from chrome, just composition. The fix is in `QuizScreen.swift` `topBar` (re-balance the leading/trailing spacers so the strip is centered in **all** Q1–Q5) plus the Q1-specific top-padding behavior of the chrome row.

## Suggested direction (triage to confirm)

- Match the leading spacer in `topBar` symmetrically (32pt leading + 32pt trailing, OR remove both and let HStack center naturally with `Spacer()` on both sides of the bars).
- For Q1: audit whether the chrome row should reserve its visual height even when `canBack == false` (it already collapses to a 44pt spacer, but the issue suggests an additional top-padding amount kicks in only on Q1). Likely an extra `Spacer()` or a misplaced `.padding(.top, ...)` further down.
- Verification: walk Q1→Q5 on-device (or simulator screenshots) and confirm the 5-segment strip lands at the same Y coordinate on every question and is horizontally centered.

## Surfaced by

User dogfood after the tb-WF-2 quiz-chrome ship, 2026-05-24.

## References

- `ios/Sources/App/QuizScreen.swift` — `topBar` composition + `VStack(spacing: 0)` host (lines ~115–195).
- `ios/Sources/App/QuizChromeView.swift` — chrome row, `canBack` slot, 44pt spacer.
- `design-system/surfaces/03-quiz.md` §"Quiz skeleton" + §"Quiz chrome (Back + Exit)" — the locked layout the iOS port must match.
- tb-WF-2 / sg-WF-2 — the chrome work that introduced the regression.

## Grill outcome (2026-05-24)

`/grill-with-docs` confirmed the issue body's theory at the code level: `QuizScreen.swift:171-174` has a leading `Color.clear.frame(width: 32, height: 32)` spacer in the `topBar` HStack but **no trailing counterpart**. The 5-bar HStack consequently sits right-of-centre by exactly the unbalanced 32pt. `design-system/surfaces/03-quiz.md` §"Quiz skeleton" is correct; the iOS port drifted during tb-WF-2 when the chrome row was inserted above `topBar`. Classified `bug` + `AFK`. No spec change.

### Fix scope

- **Centering fix (Q1-Q5)** — `ios/Sources/App/QuizScreen.swift`, the `topBar` private var:
  - Add a 32pt trailing `Color.clear.frame(width: 32, height: 32).accessibilityHidden(true)` spacer mirroring the existing leading spacer. The 5-bar HStack now centers naturally.
  - Equivalent alternative: remove both 32pt spacers and replace with a `Spacer()` on either side of the bar HStack — same visual result. Pick whichever maintains the current bar HStack's intrinsic horizontal sizing.
- **Q1 vertical-position fix** — `ios/Sources/App/QuizChromeView.swift` (and the chrome host in `QuizScreen.swift`):
  - Audit the chrome row's height across `canBack = true` (Q2-Q5) and `canBack = false` (Q1). The chrome row's leading slot already collapses to a 44pt-wide `Color.clear` spacer when `canBack == false` (the issue body confirms this), but the issue's symptom suggests an additional vertical-position interaction.
  - Likely culprits to inspect: a conditional `Spacer()` gated on `canBack`; a conditional `.padding(.top, …)` modifier on the chrome row; an interaction between `padding(.top, GTISpacing.step4)` (line 137) and `padding(.top, GTISpacing.step3)` (line 140) when the chrome's internal height shrinks on Q1.
  - Pin the chrome row's height to a constant value via `.frame(minHeight: …)` or `.frame(height: …)` so it is invariant to `canBack`. The topBar's Y position then becomes constant across Q1-Q5.

### Verification

- Simulator walk Q1 → Q5; screenshot each top. Confirm:
  - The 5-bar HStack's Y-coordinate is identical on every question (no Q1 down-shift).
  - The 5-bar HStack's X-center is identical to the screen's X-center on every question (no right-skew).
- `xcodebuild test` green (existing quiz-screen layout tests still pass).
- Visual reviewer pass: `design-system/surfaces/03-quiz.md` §"Quiz skeleton" matches the rendered layout.

### Out of scope

- Any change to the chrome-row spec itself (the chrome row's tb-WF-2 design is correct; only its iOS layout interaction is wrong).
- Any change to the 5-segment progress strip spec or behavior.
- Any change to the `surfaces/03-quiz.md` doc — the spec is the contract; the port is what drifted.
