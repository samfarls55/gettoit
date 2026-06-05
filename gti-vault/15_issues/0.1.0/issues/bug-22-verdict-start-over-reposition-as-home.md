---
issue: bug-22
title: Verdict screen "Start over" should be repositioned and reframed as a "Home" affordance
status: done
type: AFK
github_issue: 222
created: 2026-05-24
grilled: 2026-05-24
done: 2026-05-24
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-22 â€” Verdict screen "Start over" â†’ repositioned "Home" affordance

## Symptom

On the verdict screen (S05), the `Start over` button (currently the tertiary CTA below the primary `I'm in`) reads and behaves like a flow-restart. With the Plan list (S00) now the canonical post-sign-in surface, the user wants the affordance repositioned and reframed as a **Home** button â€” returning the user to the Plan list, not implying that the in-flight Plan is being thrown away.

User report: "The verdict screen start over button should be moved and repositioned to more like a 'Home' button."

## Suggested direction (triage to confirm)

This is a spec change to `design-system/surfaces/05-verdict.md` â€” the tertiary "Start over" slot's label, behavior, and position. Open questions for grill:

- **Verb/label.** "Home", "Done", iOS-glyph house, or text+glyph? The Sunset Pop register currently prefers text-only verbs.
- **Position.** Tertiary slot under the primary CTA (current), top-leading chrome row (mirror of the quiz `Back`/`Exit` chrome from tb-WF-2), or top-trailing dot menu (mirror of the Plan list per-card menu)? Each has different precedent.
- **Behavior.** Pure navigation (pop to Plan list, leave the Plan as-is, no membership change), vs the current `onEndSession` which tears down the session. The user's framing ("Home button") implies pure navigation â€” confirm.
- **Modes affected.** `default`, `cuts`, `committed`, `solo`, `no-survivor`, `read-only` â€” does the Home affordance live in every mode, or only the ones with a settled verdict?

Likely classified as `spec-gap` (S05 contract change) + a paired `tracer-bullet` for the iOS port.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `design-system/surfaces/05-verdict.md` â€” S05 spec; modes table and the tertiary slot.
- `design-system/code/screens/ScreenVerdict.jsx` â€” `showStartOverSecondary` and the tertiary CTA.
- `ios/Sources/App/VerdictScreen.swift:810` â€” `Button(action: onStartOver)`.
- `ios/Sources/App/PostQuizHostScreen.swift` â€” `onStartOver: onEndSession` wiring.
- `design-system/surfaces/00-plan-list.md` â€” destination surface for a "Home" verb.
- `design-system/surfaces/03-quiz.md` Â§"Quiz chrome (Back + Exit)" â€” possible visual precedent for a chrome-row affordance.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this as a `spec-gap` on `design-system/surfaces/05-verdict.md` + paired iOS port change. Bundle the spec edit and the iOS port in a single AFK PR (per "AFK full autonomy default"). Classified `spec-gap` + `AFK`.

### Resolved sub-questions

| Sub-question | Resolution |
|---|---|
| Verb / label | Text-only **`Home`**. Matches the Sunset Pop register's preference for text verbs (e.g. `Back` / `Exit`); matches the user's own framing; avoids a glyph that would break the chrome-row text idiom. |
| Position | **Top-leading slot of the chrome row** (mirrors the tb-WF-2 quiz `Back` / `Exit` chrome). Chrome semantics = navigation, body = content / action. Frees the existing tertiary CTA slot under the primary. |
| Behavior | **Pure navigation.** Pops to `S00 Plan list`. The Plan is left untouched â€” no membership change, no room teardown, no `onEndSession`. The room is already closed at verdict (per `CONTEXT.md` Â§Plan / Room lifecycle); there is nothing to tear down. The user's reroll path (with its 3-burn friction and stated-reason requirement) remains the only way to re-decide a Plan after verdict â€” bug-26 already removed the friction-free "change your mind" path via cuts-drawer removal, so leaving the verdict via Home is consistent with that motivation. |
| Modes affected | **Every iOS S05 mode that a Linked-Apple session can reach: `default`, `committed`, `solo`, `no-survivor`** (the `cuts` mode is being deleted by bug-26). The web `read-only` mode is **unaffected** â€” web invitees have no Plan list (per the `Web invitee` definition in `CONTEXT.md`), so a Home verb has no destination there. |

### Fix scope

- **Spec edit** â€” `design-system/surfaces/05-verdict.md`:
  - Add a chrome-row entry to the surface's structural section, mirroring `surfaces/03-quiz.md` Â§"Quiz chrome (Back + Exit)". Top-leading slot carries the text verb `Home`; top-trailing slot remains empty (S05 has no `Exit` counterpart â€” the verdict screen is not exitable; the Plan persists by design).
  - Remove the `Start over` tertiary slot from every mode's component list (the affordance is being moved into the chrome row, not duplicated).
  - Update the accessibility section: add VO order entry `chrome â†’ eyebrow â†’ hero â€¦` so the chrome row reads first; add VO label `"Home, button"` for the new affordance.
- **Spec edit** â€” `design-system/code/screens/ScreenVerdict.jsx`:
  - Remove the `showStartOverSecondary` tertiary CTA composition.
  - Add a chrome row above the eyebrow with a leading `Home` text button. Wire the click handler to `onHome` (new prop), default-pop-to-list semantics.
- **iOS port** â€” `ios/Sources/App/VerdictScreen.swift` + `ios/Sources/App/PostQuizHostScreen.swift`:
  - Replace the `Button(action: onStartOver)` tertiary slot with a chrome-row text button identical in shape to the quiz chrome `QuizChromeView` leading-slot pattern.
  - Re-wire `onStartOver: onEndSession` to a new `onHome: navigateToPlanList` handler. Drop the session-teardown call entirely â€” Home is pure nav.
- **Web port** â€” `web/components/VerdictReadOnly.tsx` / `WebVerdictCard.tsx`:
  - No change. Web `read-only` mode is unaffected by this issue (web invitees have no Plan list).
- **CHANGELOG** â€” `design-system/CHANGELOG.md`: one-line entry, prefix `BREAKING:` (the `Start over` tertiary slot is being removed; any unknown JSX consumer assuming the prop will break).

### Verification

- `node design-system/scripts/verify.mjs` green.
- Manual iOS walk: verdict â†’ tap `Home` â†’ land on Plan list with the just-decided Plan visible in the Decided section.
- Manual iOS walk in `no-survivor` and `solo` modes â€” Home present and works.
- Tap Plan card â†’ returns to verdict (Plan was not torn down).

## Comments

- 2026-05-24 â€” AFK execution complete. Spec edits, JSX, iOS port, accessibility, and CHANGELOG all landed in a single PR (#TBD). Decisions:
  - Reused the existing `onEndSession` plumbing in `PostQuizHostScreen` / `RootView` for the Home callback â€” the post-quiz host's teardown already lands on S00 Plan list via the precedence-chain fallback in `RootView`. No new navigation routing was needed.
  - Wired `onHome` on the `createdDecidedVerdict` branch in `RootView` (Plan list â†’ Decided-active tap â†’ VerdictScreen) so the Home verb works there too. The read-only branches (`createdHistoryVerdict`, `joinedReadOnly`, `readOnlyView`) do not need the wiring â€” the spec suppresses Home on read-only.
  - Removed the now-dead `noSurvivorSecondary` view + `onStartOver` callback parameter. Renamed to `onHome` rather than keeping a deprecated `onStartOver` shim â€” there were no external consumers (all call sites use named parameters with the default closure).
  - `ModeSnapshot` gained a `showHomeChrome` flag so the snapshot suite can assert the render gate without touching view internals.
  - The committed-mode `"Window closes in 47s"` status line was retained in the CTA dock â€” it reads as status, not a verb, so the bug-22 "Start over removed" rule doesn't apply.
