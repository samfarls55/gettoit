---
issue: tb-05
title: Pre-quiz parameters setup surface (initiator)
status: ready-for-agent
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
