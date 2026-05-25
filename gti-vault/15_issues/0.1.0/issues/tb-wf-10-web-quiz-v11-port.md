---
issue: tb-WF-10
title: Web quiz redesign port + shared votes-wire extraction
status: done
type: AFK
feature: 0.1.0
github_issue: 190
created: 2026-05-21
---

# tb-WF-10 — Web quiz redesign port + shared votes-wire extraction

## Parent

[[../../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]] §Q1 (scope split) and §Q2 (the vote contract). Records the cross-sibling import decision in [[../../../60_engineering/adr/0014-web-consumes-shared-votes-wire|ADR 0014]].

Delivery pair with [[sg-wf-5-web-invitee-flow|sg-WF-5]] (the web invitee shell). The shell is hollow without this quiz port; the two are separate vertical slices joined by a narrow seam — the `votes-wire.ts` contract this issue extracts.

## Why this exists

The web fallback still renders the **retired typed-column quiz**. `web/lib/quiz.ts` writes the typed vote columns (`q1_vetoes` / `q2_budget` / `q3_walk_minutes` / `q4_vibe` / `q5_regret`) and the screen renders the deleted `DUMMY_CANDIDATES` fixture. iOS and the verdict engine moved to the generic-jsonb votes schema ([[../../../60_engineering/adr/0010-generic-jsonb-votes-schema|ADR 0010]]) and the scenario-question / Q5-factorial-probe redesign; the web hand-mirror silently fell a whole quiz generation behind. A web invitee voting today writes a vote shape `compute-verdict` can no longer read.

## What to build

A vertical slice that brings the web quiz to redesign parity and makes the vote contract un-forkable.

### Part 1 — Extract the shared vote contract (per ADR 0014)

- **Add:** `supabase/functions/_shared/votes-wire.ts` — a **leaf module** carrying the vote wire types (the `{ meta, answer }` per-slot envelope) and `buildVotesSlotsFromLegacyAnswers`, lifted out of `supabase/functions/_shared/votes-schema.ts`. It imports no engine code — only the tiny `Q5Rating` / `Axis` types — and has **no relative imports of its own** (load-bearing: it must compile under both the Deno edge runtime and the Next.js / Node web build — see ADR 0014 Consequences).
- **Update:** `votes-schema.ts` re-imports the moved types/helper from `votes-wire.ts` so the edge functions' behavior is unchanged.
- **Update:** the web app imports `votes-wire.ts` **directly**.
- **Delete:** the `web/lib/quiz.ts` hand-mirror of the wire shape.

### Part 2 — Port the web quiz to the redesigned quiz

Bring the web quiz to parity with the iOS redesigned quiz. The design-system spec is the existing [[../../../design-system/surfaces/03-quiz|surfaces/03-quiz.md]]; this is a port, not a redesign.

- **Scenario questions** — the scenario-composite question model (a plain-language scenario answer compiling to a recipe of Foursquare filters). See [[../../../50_product/0.1.0-quiz-amendments|0.1.0-quiz-amendments]].
- **Generic jsonb votes** — the web app writes the five generic `q1`..`q5` jsonb `{ meta, answer }` slots via the `votes-wire.ts` contract, not the retired typed columns.
- **Real per-member candidate fetch** — replace `DUMMY_CANDIDATES` with the real per-member Foursquare fetch feeding the candidate pool, floored to the ADR 0012 candidate-pool floor. The web app already degraded cleanly on an empty pool (`PlacesEmptyState`); keep that path.
- **Q5 preference probe** — the three-card strict-factorial Q5 rater. Reuse the existing `no-results` honest-degradation pattern ([[../../../60_engineering/adr/0013-no-fictitious-fallback-venues|ADR 0013]]) when no factorial-usable pool exists — the web app must never render a fictitious venue.

### Resume-into-Q5 (inherited from sg-WF-5 §Q5)

The web invitee shell's resume (sg-WF-5) lands a re-clicking invitee at their last-answered question. A resume **into Q5** must re-fire the per-member candidate fetch so the rater has cards. This is the same limitation tb-WF-7 documented for iOS; closing it for web is **this issue's** territory, not the shell's.

## Cost note

Porting the real per-member Foursquare fetch to web introduces FSQ Premium-billed calls on the web path, billed the same as iOS (the FSQ account is prepaid pay-as-you-go — see the project's Foursquare-cost memory). No new cost *mechanism*, but web invitees now contribute to FSQ spend where before they hit only `DUMMY_CANDIDATES`. Flagged, not gated.

## Acceptance criteria

- [ ] `supabase/functions/_shared/votes-wire.ts` exists as a leaf module (no engine imports, no relative imports); the edge functions still pass `deno test`.
- [ ] The web app imports `votes-wire.ts` directly; `web/lib/quiz.ts`'s hand-mirror of the wire shape is deleted.
- [ ] The web quiz writes the generic `q1`..`q5` jsonb votes; a web-invitee vote round is readable by `compute-verdict` end-to-end.
- [ ] The web quiz renders the scenario questions and the Q5 three-card factorial probe; `DUMMY_CANDIDATES` is gone.
- [ ] The web app never renders a fictitious venue — the `no-results` degradation path is honored when no factorial pool exists.
- [ ] A resume into Q5 re-fires the per-member candidate fetch.
- [ ] Web CI lane (`npm test`, `npm run build`, `npm run lint`) and the edge-function `deno test` lane are green.

## Blocked by

None — can start now. Delivery pair with [[sg-wf-5-web-invitee-flow|sg-WF-5]]; the `votes-wire.ts` extracted here is the contract the sg-WF-5 shell-wiring tracer-bullet consumes.

## Comments

**Done 2026-05-21 — merged (PR #201).** Both parts landed.

*Part 1.* `supabase/functions/_shared/votes-wire.ts` is the new leaf
module — it carries the `Axis` / `Q5Rating` types (defined inline, not
imported, so it stays relative-import-free per ADR 0014), the
question-kind taxonomy, the `{ meta, answer }` slot types, and
`buildVotesSlotsFromLegacyAnswers`. `votes-schema.ts` and
`preference-function.ts` re-import + re-export it, so every existing
edge-function importer is unaffected; all 372 `deno test` cases pass.

*Part 2.* The web quiz is at redesign parity: `web/lib/quiz.ts`'s
hand-mirror is gone, replaced by scenario-question constants + a
`buildVoteRow` that writes the generic `q1`..`q5` jsonb slots via the
shared builder. `web/lib/candidate-fetch.ts` is a faithful TypeScript
port of the iOS per-member fetch stack (planner, classifier, strict
factorial); the new `QuizScreens` render Q1 cuisine craving, Q3
reputation, and the Q5 factorial probe with its `no-results`
honest-degradation mode. `SessionRoom` fires the per-member
`places-proxy` fetch whenever Q5 becomes the active step (so a resume
into Q5 re-fires it), persists the raw union into `member_fetches`, and
writes the generic-slot `votes` row. `DUMMY_CANDIDATES` is deleted. Web
CI lane green (`npm test` — 78 tests, `npm run build`).

**Adjacency flagged (not fixed — out of scope).** The web verdict-READ
path (`web/lib/verdict.ts` `VoteSummaryRow` + `SessionRoom`'s verdict
load) still references the retired typed `votes` columns
(`q1_vetoes` / `q2_budget` / `q3_walk_minutes` / …), which the generic-
jsonb migration dropped. tb-WF-10 is the quiz WRITE path; the read-path
receipts should move to the `verdict_for_room` RPC projection (the
server already projects the generic slots back to the legacy receipt
shape there). Worth a follow-up issue.
