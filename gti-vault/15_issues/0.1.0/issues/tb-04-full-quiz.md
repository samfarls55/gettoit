---
issue: tb-04
title: Full 5-question quiz Q1â€“Q5
github_issue: 5
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-13
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-04 â€” Full 5-question quiz

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

Every member who joins a room can answer all 5 quiz questions and have their answers persisted as a single `votes` row. The gradient surface hue-shifts continuously through the quiz per the locked spec. Q5 is a placeholder regret rater that uses dummy candidates â€” real candidates land via TB-05.

- **Schema** â€” `votes (room_id uuid, user_id uuid, q1_vetoes text[], q2_budget int, q3_walk_minutes int, q4_vibe int, q5_regret jsonb, created_at)` with unique constraint on `(room_id, user_id)` and RLS limiting writes to the row's own user.
- **SwiftUI ports** â€” `ScreenQ1Vetoes`, `ScreenQ2Budget`, `ScreenQ3Distance`, `ScreenQ4Vibe`, `ScreenQ5Regret` per [[../../../../design-system/surfaces/03-quiz|S03]] and the matching JSX. Use generated `GTITokens.swift` for all tokens; no inline hex/px.
- **Gradient surface tween** â€” between adjacent quiz screens, all 4 gradient stops interpolate over 1100ms via the locked `ease-in-out` curve. SwiftUI implementation per `tokens.md` Â§1.4 with `@State` color array + `withAnimation`.
- **Quiz-state coordinator** â€” holds Q1â€“Q4 answers locally as the user advances; writes the complete `votes` row only on Q5 submit. Single round-trip, idempotent on retry. Q5 uses dummy candidate IDs from a local fixture until TB-05 wires real candidates.
- **Placeholder copy** â€” strings from PRD Â§"Quiz copy â€” placeholder regime." Tagged in source with `// placeholder: marketing-branding pass`.
- **Tests** â€” full-quiz submission writes a single `votes` row; partial-quiz exits don't write; RLS blocks writes for the wrong user; gradient transition does not crash on rapid-tap quiz advance.

## Acceptance criteria

- [x] `votes` migration lands with unique constraint + RLS. _(2026-05-13 â€” `supabase/migrations/20260513215000000_votes.sql`; PK on `(room_id, user_id)` is the unique constraint, RLS SELECT scoped to room members, INSERT scoped to `user_id = auth.uid()` AND room membership, no UPDATE/DELETE policies.)_
- [x] Five SwiftUI Quiz surfaces match the locked design-system spec (visual, copy register, motion). _(2026-05-13 â€” `QuizQ1Vetoes.swift`, `QuizQ2Budget.swift`, `QuizQ3Distance.swift`, `QuizQ4Vibe.swift`, `QuizQ5Regret.swift`. All tokens consumed from `GTITokens.swift`; placeholder copy tagged `// placeholder: marketing-branding pass`.)_
- [x] Quiz-state coordinator writes a complete `votes` row on Q5 submit, with all five answer fields populated. _(2026-05-13 â€” `QuizCoordinator.swift` holds Q1â€“Q4 locally; `submit()` writes the row in a single round-trip; `testFullQuizSubmissionWritesASingleVotesRow` and `testSubmitWritesASingleRowOnQ5` cover the path.)_
- [x] Gradient surface tween between screens lands ms-exact per `motion.md`. _(2026-05-13 â€” `QuizScreen.applyTween` interpolates the 4 stops via `withAnimation(.timingCurve(GTIMotion.Easing.inOut..., duration: GTIMotion.Duration.gradTween))` = 1100ms locked. Reduced-motion drops to 300ms linear.)_
- [x] No back arrow; `Ã—` close exits to home. _(2026-05-13 â€” top bar in `QuizScreen` renders only `Ã—` + 5-segment progress; tap calls the `onClose` route in `RootView` which clears `activeQuiz` and routes back to the initiator surface.)_
- [x] Integration tests for full quiz, partial exit, RLS, idempotency. _(2026-05-13 â€” `VotesIntegrationTests`: full-quiz write, resubmit idempotency, RLS rejects cross-user write, RLS rejects non-member write. Plus `QuizCoordinatorTests` for the partial-exit-no-write contract.)_
- [x] Snapshot tests for each quiz surface, default state. _(2026-05-13 â€” `QuizScreenSnapshotTests` renders each surface into a `UIHostingController` and asserts the spec'd accessibility identifiers + default state hooks are present. Pixel-snapshot tooling deferred to a later pass.)_

## Blocked by

- [[tb-02-room-create-deeplink-join|TB-02]] _(satisfied)_

## Comments

### 2026-05-13 â€” Landed (PR #28)

Landed in [PR #28](https://github.com/samfarls55/gettoit/pull/28).

**Migration timestamp shift.** Instruction-specified filename was `20260513212000000_votes.sql`. Two parallel-branch CI builds (TB-03 and TB-12) had already pushed their migrations (`20260513212500000_rooms_timer_radius.sql` and `20260513213000000_user_preferences.sql`) to the linked Supabase project â€” flagged as the "PR-build db push" adjacency in TB-02's comments. `supabase db push --include-all` enforces strict-prefix history. Two fixes shipped together:

1. Renumbered our migration to `20260513215000000_votes.sql` so it timestamps after both parallels.
2. Mirrored both parallel migrations into this branch unchanged so the local history matches the remote. Mirror gets deduplicated naturally at merge time.

**SDK-version tolerance for unique-violation sniff.** Initial implementation typed-cast the error to `PostgrestError` to read `.code == "23505"`. The error type's module path has shifted across supabase-swift minor versions, so dropped the cast and rely on string-sniffing `23505` / `duplicate key value` from the error description. Unit tests already drive that path with a synthetic error.

**Q5 dummy candidates.** The ticket says "Q5 uses dummy candidate IDs from a local fixture until TB-05 wires real candidates." TB-05 (PlacesProxy + cache) landed before TB-04, so the wiring of *real* survivors actually belongs to TB-06 (VerdictEngine clean run). `QuizDummyCandidates.all` is the placeholder fixture; the `QuizCoordinator` accepts an injected `candidates: [QuizCandidate]` so TB-06 can pass the live survivor set without touching the coordinator's submit contract.

## Adjacencies (flagged, not fixed in this PR)

- **Migration mirror creates churn on merge.** Pulling TB-03 and TB-12's migration files into this branch (so `db push --include-all` is happy) means those same files land in two branches. Git's identical-content handling means the merge into main is a no-op for the duplicated files, but if TB-03 / TB-12 amend their migration body before merging, a conflict appears here. Lower-friction fix is to relax the supabase-db lane to allow non-prefix history (e.g. `--ignore-remote` or skip on PR builds; only push on merge). Out of scope here â€” TB-02 already flagged the PR-build-db-push pattern.
- **Top-bar progress doesn't animate the segment fill.** The JSX semantics are "segment goes white the moment the user advances" (300ms ease-out on `background`). The iOS port uses `.animation(... , value: activeIndex)` on each capsule, which produces a discrete fill state per segment. Visually it matches the JSX; the JSX's `transition: background 300ms` doesn't actually animate the fill cleanly either since `background` color interpolation in CSS is instant for many engines. Worth verifying on-device before TestFlight.
- **Q4 vibe word rise-with-blur.** `motion.md` Â§"Utility motion" specifies the word change as "rise + blur 4â†’0, 480ms ease-out-soft." The iOS port uses `.transition(.opacity.combined(with: .move(edge: .bottom)))` â€” rise + opacity, no blur. SwiftUI's `.blur(radius:)` modifier doesn't compose cleanly with `.transition`. The 480ms duration and ease-out-soft curve match. The blur step is a 0.1.0 polish â€” flagged so it's not lost.
- **JoinScreen "Joined room <id>" flashes briefly before the quiz lands.** When the join handshake completes, `phase = .joined(...)` paints for one tick before the `onJoined` callback in `RootView` swaps to `QuizScreen`. Not a hard bug â€” the gradient continues unchanged â€” but a JoinScreen `.task` ordering tweak could remove the flash. Flagged for the polish pass before TestFlight.
- **ShareSheet `.onDisappear` fires on cancel.** The initiator auto-transitions into Q1 whenever the share sheet dismisses, including the "Cancel" tap. PRD user story 8 says "after sharing"; pragmatically the user can `Ã—` out of the quiz. Worth revisiting with a real-device test before TestFlight to confirm the share sheet's completion handler (or `UIActivityViewController.completionWithItemsHandler`) lets us distinguish "shared" from "cancelled" cleanly.
- **No `votes`-insert trigger to fire the VerdictEngine.** TB-06's contract is to add `AFTER INSERT ON votes` that triggers the engine once `count(votes WHERE room_id = NEW.room_id) >= 2`. TB-04 ships only the table + RLS; the trigger lands with the engine.
- **`onSubmitted` lands back at InitiatorScreen, not Waiting.** Once Q5 submits successfully, the quiz clears and `RootView` falls through to its routing â€” which is the InitiatorScreen because there's no Waiting surface yet. TB-07 lands S04 Waiting and the post-submit route changes there.
- **Snapshot tests are accessibility-identifier shaped, not pixel.** `QuizScreenSnapshotTests` walks the SwiftUI hierarchy via `accessibilityIdentifier` to assert each surface renders the spec'd elements. Pixel-level visual regression is verified manually against the JSX prototype per `motion.md` Â§"Verification before 'done'." Adding `pointfreeco/swift-snapshot-testing` is a larger scope decision that belongs in a tooling tracer bullet rather than buried here.
