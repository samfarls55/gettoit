---
issue: bug-26
title: Remove the "See what got cut" drawer from the verdict screen â€” unnecessary surface area
status: done
type: AFK
github_issue: 226
created: 2026-05-24
grilled: 2026-05-24
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-26 â€” Remove the verdict "See what got cut" drawer

## Symptom

On the verdict screen (S05), the `"See what got cut â†’"` cuts-drawer trigger and its expanded drawer add surface area the user has decided is not pulling its weight. The user wants the affordance removed altogether.

User report: "'See what got cut' button is unnecessary altogether."

## Suggested direction (triage to confirm)

This is a spec change to `design-system/surfaces/05-verdict.md` â€” the `cuts` mode (and the `default` mode's cuts trigger) and the underlying `C-XX` cuts-drawer component. Open questions for grill:

- **Full removal vs hide.** Delete the drawer + the trigger entirely from spec, JSX, and iOS port (preferred per the user's wording), vs keep the underlying primitive but suppress its surfacing on S05. Full removal is simpler and matches "unnecessary altogether."
- **Mode collapse.** S05's `cuts` mode exists explicitly for the drawer's expanded state. If the drawer is gone, does the `cuts` mode collapse into `default`? Likely yes.
- **Accessibility table.** `accessibility.md` Â§"Cuts trigger" copy line must be removed alongside.
- **Read-only invitee.** `surfaces/05-verdict.md` Â§read-only currently says "Cuts drawer is available (informational)." That sentence is dropped with the same edit.

Likely classified as `spec-gap` (S05 + components.md + accessibility.md edit) + a paired `tracer-bullet` for the iOS + web removal. Confirm in grill.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `design-system/surfaces/05-verdict.md` Â§Modes â€” `cuts`, `default`; Â§read-only "Cuts drawer is available".
- `design-system/components.md` â€” search for "Cuts drawer" / "See what got cut" (likely a C-NN entry).
- `design-system/code/screens/ScreenVerdict.jsx:182` â€” `"See what got cut â†’"` button.
- `design-system/accessibility.md:105,181` â€” Cuts trigger tap-target + VO entries.
- iOS port: search for `cuts` / `seeWhatGotCut` in `ios/Sources/App/VerdictScreen.swift`.
- Web port: search in `web/components/VerdictReadOnly.tsx` / `WebVerdictCard.tsx`.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this as **full removal** of the cuts drawer â€” not "hide and keep the primitive." Classified `spec-gap` + `AFK`. Bundle every edit in a single AFK PR.

### Motivating intent

The user clarified during the grill that the cuts drawer is unacceptable not just on visual-noise grounds but because it provides a friction-free **change-of-mind window** on the verdict â€” a user can re-pick from the just-eliminated candidates without paying any of the reroll friction (3-burn cap, stated reason that becomes a new constraint). That is *not* intended behavior. The reroll path is the canonical re-decide path; the cuts drawer was a parallel, friction-free path to the same outcome.

This motivation is load-bearing because it interacts with bug-22 (the verdict `Home` affordance): bug-22 makes `Home` pure navigation (the Plan stays alive on the Plan list), and bug-26 closes the cuts-drawer change-of-mind path. Together they leave reroll as the only re-decide path, with all of its existing friction intact.

### Fix scope (full removal)

- **Spec edit** â€” `design-system/surfaces/05-verdict.md`:
  - Remove the `cuts` row from the Â§Modes table. Collapse the `cuts` mode into `default` â€” `default` no longer mentions a cuts trigger.
  - Remove the `"See what got cut â†’"` cuts-trigger line from the Â§Formatting / Â§Composition entries of every mode that referenced it.
  - Update the Â§read-only entry: remove the *"Cuts drawer is available (informational, not actionable)."* sentence.
  - Update the Â§no-survivor and Â§solo entries: remove any *"Cuts drawer remains available"* sentences.
- **Spec edit** â€” `design-system/components.md`:
  - Delete the C-NN entry for the cuts-drawer component (search `components.md` for "Cuts drawer" / "See what got cut" to locate the assigned C-NN). Re-number nothing â€” leave the slot empty; the design system tolerates gaps.
- **Spec edit** â€” `design-system/accessibility.md`:
  - Delete the Â§"Cuts trigger" tap-target row (line 105 reference).
  - Delete the Â§VO entry for the cuts trigger (line 181 reference).
  - Update the Â§VO order entry for S05 to remove the cuts-trigger node from the sequence.
- **Spec edit** â€” `design-system/code/screens/ScreenVerdict.jsx`:
  - Delete the `"See what got cut â†’"` button (line 182 reference) and its expanded drawer JSX.
  - Delete the `showCutsDrawer` state and any cuts-related props on the screen.
- **iOS port** â€” `ios/Sources/App/VerdictScreen.swift`:
  - Delete the cuts trigger affordance and the expanded cuts-drawer view.
  - Delete the supporting `VerdictStore` cuts state if present (search for `cuts`, `seeWhatGotCut`, `dismissedOptions` in `VerdictStore.swift`).
- **Web port** â€” `web/components/VerdictReadOnly.tsx` and/or `WebVerdictCard.tsx`:
  - Delete the cuts trigger and cuts-drawer render. The web read-only mode is now purely informational without the drawer (verdict card + plan-name + venue, per the locked `web-01-invitee-shell.md` Â§C contract â€” the bug-17 alignment work is preserved).
- **CHANGELOG** â€” `design-system/CHANGELOG.md`: one-line entry, prefix `BREAKING:` (the `cuts` mode is being deleted; any JSX consumer that assumed the cuts trigger / drawer / mode existed will break).

### Verification

- `node design-system/scripts/verify.mjs` green. The orphan-hex sweep and surfaceâ†”jsx pairing should remain green (deletions are well-localised; no new tokens introduced).
- Grep the design system for any remaining `cuts` / `seeWhatGotCut` / `getCut` references â€” should be zero hits after the edit.
- iOS simulator walk: verdict screen renders without the cuts trigger; the layout's vertical rhythm is unbroken (no dangling spacer where the trigger used to sit).
- Web walk: invitee-only verdict view renders without the cuts row.

### Adjacency flagged, not filed

If the verdict screen's vertical rhythm reads off after the trigger is removed (e.g. the rule-sentence card now floats), audit the Â§motion timeline (`VERDICT_CHOREO`) â€” the cuts trigger had its own staggered reveal step that may have anchored the timing of the next element down. Out of scope for this issue; file as a follow-up if it actually surfaces.

## Comments

- **2026-05-24, AFK execution complete.** Spec + JSX + iOS port + accessibility + motion all carry the deletion; bug-26 grill outcome matched verbatim. Web side already conforms (bug-17 already retired the Â§C cuts row). `Verdict.cuts` value-type field retained â€” the engine still writes `option_cuts` rows for receipts / analytics; the surface simply no longer reads them. `design-system/scripts/test-bug-26.mjs` added as the structural gate (32 assertions). Sibling structural tests (`test-bug-24`, `test-fab-rework`, `test-plan-list`, `test-plan-setup`, `test-quiz-chrome`, `test-verdict-no-survivor`, `test-account-claim`) all still pass; `design-system/scripts/verify.mjs` green. Adjacency above did not surface in code review â€” the JSX/SwiftUI removal is clean (the entire conditional view is deleted, not just the inner button; no dangling spacer).
