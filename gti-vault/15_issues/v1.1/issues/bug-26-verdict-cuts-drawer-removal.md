---
issue: bug-26
title: Remove the "See what got cut" drawer from the verdict screen — unnecessary surface area
status: ready-for-agent
type: AFK
github_issue: 226
created: 2026-05-24
grilled: 2026-05-24
---

# bug-26 — Remove the verdict "See what got cut" drawer

## Symptom

On the verdict screen (S05), the `"See what got cut →"` cuts-drawer trigger and its expanded drawer add surface area the user has decided is not pulling its weight. The user wants the affordance removed altogether.

User report: "'See what got cut' button is unnecessary altogether."

## Suggested direction (triage to confirm)

This is a spec change to `design-system/surfaces/05-verdict.md` — the `cuts` mode (and the `default` mode's cuts trigger) and the underlying `C-XX` cuts-drawer component. Open questions for grill:

- **Full removal vs hide.** Delete the drawer + the trigger entirely from spec, JSX, and iOS port (preferred per the user's wording), vs keep the underlying primitive but suppress its surfacing on S05. Full removal is simpler and matches "unnecessary altogether."
- **Mode collapse.** S05's `cuts` mode exists explicitly for the drawer's expanded state. If the drawer is gone, does the `cuts` mode collapse into `default`? Likely yes.
- **Accessibility table.** `accessibility.md` §"Cuts trigger" copy line must be removed alongside.
- **Read-only invitee.** `surfaces/05-verdict.md` §read-only currently says "Cuts drawer is available (informational)." That sentence is dropped with the same edit.

Likely classified as `spec-gap` (S05 + components.md + accessibility.md edit) + a paired `tracer-bullet` for the iOS + web removal. Confirm in grill.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `design-system/surfaces/05-verdict.md` §Modes — `cuts`, `default`; §read-only "Cuts drawer is available".
- `design-system/components.md` — search for "Cuts drawer" / "See what got cut" (likely a C-NN entry).
- `design-system/code/screens/ScreenVerdict.jsx:182` — `"See what got cut →"` button.
- `design-system/accessibility.md:105,181` — Cuts trigger tap-target + VO entries.
- iOS port: search for `cuts` / `seeWhatGotCut` in `ios/Sources/App/VerdictScreen.swift`.
- Web port: search in `web/components/VerdictReadOnly.tsx` / `WebVerdictCard.tsx`.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this as **full removal** of the cuts drawer — not "hide and keep the primitive." Classified `spec-gap` + `AFK`. Bundle every edit in a single AFK PR.

### Motivating intent

The user clarified during the grill that the cuts drawer is unacceptable not just on visual-noise grounds but because it provides a friction-free **change-of-mind window** on the verdict — a user can re-pick from the just-eliminated candidates without paying any of the reroll friction (3-burn cap, stated reason that becomes a new constraint). That is *not* intended behavior. The reroll path is the canonical re-decide path; the cuts drawer was a parallel, friction-free path to the same outcome.

This motivation is load-bearing because it interacts with bug-22 (the verdict `Home` affordance): bug-22 makes `Home` pure navigation (the Plan stays alive on the Plan list), and bug-26 closes the cuts-drawer change-of-mind path. Together they leave reroll as the only re-decide path, with all of its existing friction intact.

### Fix scope (full removal)

- **Spec edit** — `design-system/surfaces/05-verdict.md`:
  - Remove the `cuts` row from the §Modes table. Collapse the `cuts` mode into `default` — `default` no longer mentions a cuts trigger.
  - Remove the `"See what got cut →"` cuts-trigger line from the §Formatting / §Composition entries of every mode that referenced it.
  - Update the §read-only entry: remove the *"Cuts drawer is available (informational, not actionable)."* sentence.
  - Update the §no-survivor and §solo entries: remove any *"Cuts drawer remains available"* sentences.
- **Spec edit** — `design-system/components.md`:
  - Delete the C-NN entry for the cuts-drawer component (search `components.md` for "Cuts drawer" / "See what got cut" to locate the assigned C-NN). Re-number nothing — leave the slot empty; the design system tolerates gaps.
- **Spec edit** — `design-system/accessibility.md`:
  - Delete the §"Cuts trigger" tap-target row (line 105 reference).
  - Delete the §VO entry for the cuts trigger (line 181 reference).
  - Update the §VO order entry for S05 to remove the cuts-trigger node from the sequence.
- **Spec edit** — `design-system/code/screens/ScreenVerdict.jsx`:
  - Delete the `"See what got cut →"` button (line 182 reference) and its expanded drawer JSX.
  - Delete the `showCutsDrawer` state and any cuts-related props on the screen.
- **iOS port** — `ios/Sources/App/VerdictScreen.swift`:
  - Delete the cuts trigger affordance and the expanded cuts-drawer view.
  - Delete the supporting `VerdictStore` cuts state if present (search for `cuts`, `seeWhatGotCut`, `dismissedOptions` in `VerdictStore.swift`).
- **Web port** — `web/components/VerdictReadOnly.tsx` and/or `WebVerdictCard.tsx`:
  - Delete the cuts trigger and cuts-drawer render. The web read-only mode is now purely informational without the drawer (verdict card + plan-name + venue, per the locked `web-01-invitee-shell.md` §C contract — the bug-17 alignment work is preserved).
- **CHANGELOG** — `design-system/CHANGELOG.md`: one-line entry, prefix `BREAKING:` (the `cuts` mode is being deleted; any JSX consumer that assumed the cuts trigger / drawer / mode existed will break).

### Verification

- `node design-system/scripts/verify.mjs` green. The orphan-hex sweep and surface↔jsx pairing should remain green (deletions are well-localised; no new tokens introduced).
- Grep the design system for any remaining `cuts` / `seeWhatGotCut` / `getCut` references — should be zero hits after the edit.
- iOS simulator walk: verdict screen renders without the cuts trigger; the layout's vertical rhythm is unbroken (no dangling spacer where the trigger used to sit).
- Web walk: invitee-only verdict view renders without the cuts row.

### Adjacency flagged, not filed

If the verdict screen's vertical rhythm reads off after the trigger is removed (e.g. the rule-sentence card now floats), audit the §motion timeline (`VERDICT_CHOREO`) — the cuts trigger had its own staggered reveal step that may have anchored the timing of the next element down. Out of scope for this issue; file as a follow-up if it actually surfaces.
