---
issue: tb-05
title: Pre-quiz parameters setup surface (initiator)
status: done
type: AFK
github_issue: 66
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-05 — Pre-quiz parameters surface

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (K). Covers the *parameters* bucket of the three-bucket input model.

## What to build

A new iOS screen, shown to the session initiator before the quiz, that captures the five session parameters consistent across every participant:

- **Geography** — where the group is meeting (location already exists via the v1.1 LocationPicker; reuse it).
- **Meal time** — so only venues open then are considered.
- **Group size / social context** — so the recommendation fits the occasion.
- **Service shape** — dine-in indoor/outdoor vs takeout pickup/delivery.
- **Transport mode** — walk/drive, which sets the search radius.

Parameters persist on the session record and apply automatically to every joiner — a joiner never re-enters shared settings. This is a **new surface**: design it with the Refero MCP and the design-system tokens/components in unison, adding new component or surface specs to `design-system/` as needed (authority granted for this issue).

## Acceptance criteria

- [ ] The initiator sees a pre-quiz setup screen capturing geography, meal time, group size / social context, service shape, and transport mode.
- [ ] Parameters persist on the session record; joiners read them back and the quiz applies them without re-prompting.
- [ ] The new surface and any new components are specified in `design-system/` and built from tokens — no raw hex / px / easing literals.
- [ ] `node design-system/scripts/verify.mjs` is green.
- [ ] Tests cover parameter capture and joiner hydration.

## Blocked by

- [[tb-04-votes-jsonb-schema|tb-04]] — session schema foundation.

## Comments

**2026-05-16 — done (AFK, PR #79 / branch `afk/tb-05`).** Shipped the pre-quiz parameters surface.

- **Surface.** New iOS `ParametersScreen` (S01b), routed in `RootView` between S01 and the quiz — initiator-only. Captures meal time, group context, service shape, transport mode via four single-select C-04 chip groups; geography is echoed read-only (reuses the S01 C-23 LocationPicker pick, never re-captured). New design-system spec `surfaces/01b-parameters.md` + `code/screens/ScreenParameters.jsx`. No new component — built from existing primitives, per the PRD module (K) "consumes existing tokens and components" note. `verify.mjs` green.
- **Storage.** One generic `rooms.session_params` jsonb column (migration `20260515010000000`), mirroring the TB-04 generic-jsonb votes decision (ADR 0010) so parameter content can change without a migration. The migration also adds a `rooms_update_creator` RLS policy — the original `rooms` migration shipped only SELECT + INSERT, so a parameter UPDATE was silently RLS-denied without it. The policy is scoped to the creator: a joiner can never overwrite the shared parameters.
- **Joiner hydration.** `RoomStore.fetchSessionParameters` reads the column back; `RootView.resolvePlacesQuery` hydrates it off the same room fetch the joiner already does, and `QuizCoordinator` / `QuizSessionAssembler` carry it so the joiner's quiz runs against the initiator's bucket — no re-prompt. NULL column / unreadable room falls back to `SessionParameters.default`.
- **Model.** `SessionParameters` value type with tolerant decode — an option a newer client wrote falls back to its default rather than throwing mid-quiz. `GroupContext` is an occasion enum (solo/duo/group), not a headcount: actual group size is inferred from who accepts the invite. Transport mode supplies a default S01 radius (walk → 2.0 mi, drive → 5.0 mi) the initiator can still override.
- **Tests.** `SessionParametersTests` (wire-shape encode, joiner-hydration round-trip across every combination, tolerant decode), `RoomStoreIntegrationTests` (persist + read back + RLS keeps a joiner from overwriting), `ParametersScreenTests` (render smoke + selection → parameters). iOS lane + supabase db-push + design-system verify all green on CI.
