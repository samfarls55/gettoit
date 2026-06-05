---
issue: tb-05
title: Pre-quiz parameters setup surface (initiator)
status: done
type: AFK
github_issue: 66
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-05 â€” Pre-quiz parameters surface

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] â€” module (K). Covers the *parameters* bucket of the three-bucket input model.

## What to build

A new iOS screen, shown to the session initiator before the quiz, that captures the five session parameters consistent across every participant:

- **Geography** â€” where the group is meeting (location already exists via the 0.1.0 LocationPicker; reuse it).
- **Meal time** â€” so only venues open then are considered.
- **Group size / social context** â€” so the recommendation fits the occasion.
- **Service shape** â€” dine-in indoor/outdoor vs takeout pickup/delivery.
- **Transport mode** â€” walk/drive, which sets the search radius.


## Acceptance criteria

- [ ] The initiator sees a pre-quiz setup screen capturing geography, meal time, group size / social context, service shape, and transport mode.
- [ ] Parameters persist on the session record; joiners read them back and the quiz applies them without re-prompting.
- [ ] Tests cover parameter capture and joiner hydration.

## Blocked by

- [[tb-04-votes-jsonb-schema|tb-04]] â€” session schema foundation.

## Comments

**2026-05-16 â€” done (AFK, PR #79 / branch `afk/tb-05`).** Shipped the pre-quiz parameters surface.

- **Storage.** One generic `rooms.session_params` jsonb column (migration `20260515010000000`), mirroring the TB-04 generic-jsonb votes decision (ADR 0010) so parameter content can change without a migration. The migration also adds a `rooms_update_creator` RLS policy â€” the original `rooms` migration shipped only SELECT + INSERT, so a parameter UPDATE was silently RLS-denied without it. The policy is scoped to the creator: a joiner can never overwrite the shared parameters.
- **Joiner hydration.** `RoomStore.fetchSessionParameters` reads the column back; `RootView.resolvePlacesQuery` hydrates it off the same room fetch the joiner already does, and `QuizCoordinator` / `QuizSessionAssembler` carry it so the joiner's quiz runs against the initiator's bucket â€” no re-prompt. NULL column / unreadable room falls back to `SessionParameters.default`.
- **Model.** `SessionParameters` value type with tolerant decode â€” an option a newer client wrote falls back to its default rather than throwing mid-quiz. `GroupContext` is an occasion enum (solo/duo/group), not a headcount: actual group size is inferred from who accepts the invite. Transport mode supplies a default S01 radius (walk â†’ 2.0 mi, drive â†’ 5.0 mi) the initiator can still override.
