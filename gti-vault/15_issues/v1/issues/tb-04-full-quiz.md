---
issue: tb-04
title: Full 5-question quiz Q1–Q5
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
---

# TB-04 — Full 5-question quiz

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

Every member who joins a room can answer all 5 quiz questions and have their answers persisted as a single `votes` row. The gradient surface hue-shifts continuously through the quiz per the locked spec. Q5 is a placeholder regret rater that uses dummy candidates — real candidates land via TB-05.

- **Schema** — `votes (room_id uuid, user_id uuid, q1_vetoes text[], q2_budget int, q3_walk_minutes int, q4_vibe int, q5_regret jsonb, created_at)` with unique constraint on `(room_id, user_id)` and RLS limiting writes to the row's own user.
- **SwiftUI ports** — `ScreenQ1Vetoes`, `ScreenQ2Budget`, `ScreenQ3Distance`, `ScreenQ4Vibe`, `ScreenQ5Regret` per [[../../../../design-system/surfaces/03-quiz|S03]] and the matching JSX. Use generated `GTITokens.swift` for all tokens; no inline hex/px.
- **Gradient surface tween** — between adjacent quiz screens, all 4 gradient stops interpolate over 1100ms via the locked `ease-in-out` curve. SwiftUI implementation per `tokens.md` §1.4 with `@State` color array + `withAnimation`.
- **Quiz-state coordinator** — holds Q1–Q4 answers locally as the user advances; writes the complete `votes` row only on Q5 submit. Single round-trip, idempotent on retry. Q5 uses dummy candidate IDs from a local fixture until TB-05 wires real candidates.
- **Placeholder copy** — strings from PRD §"Quiz copy — placeholder regime." Tagged in source with `// placeholder: marketing-branding pass`.
- **Tests** — full-quiz submission writes a single `votes` row; partial-quiz exits don't write; RLS blocks writes for the wrong user; gradient transition does not crash on rapid-tap quiz advance.

## Acceptance criteria

- [ ] `votes` migration lands with unique constraint + RLS.
- [ ] Five SwiftUI Quiz surfaces match the locked design-system spec (visual, copy register, motion).
- [ ] Quiz-state coordinator writes a complete `votes` row on Q5 submit, with all five answer fields populated.
- [ ] Gradient surface tween between screens lands ms-exact per `motion.md`.
- [ ] No back arrow; `×` close exits to home.
- [ ] Integration tests for full quiz, partial exit, RLS, idempotency.
- [ ] Snapshot tests for each quiz surface, default state.

## Blocked by

- [[tb-02-room-create-deeplink-join|TB-02]]
