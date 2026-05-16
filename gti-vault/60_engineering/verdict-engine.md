---
folder: 60_engineering
purpose: Server-authoritative VerdictEngine — v1.1 worst-off-protecting pipeline, edge cases, anonymization rules
---

# VerdictEngine — v1.1 worst-off-protecting pipeline

Server-authoritative engine that turns a room's `votes` + `options` into a single `verdicts` row plus `option_cuts` rows. The S05 surface reads the engine's output; the iOS client never recomputes a verdict.

The current engine is the v1.1 rewrite shipped by [[../15_issues/v1.1/issues/tb-11-verdict-engine-rewrite|tb-11]] under [[adr/0011-worst-off-protecting-verdict-engine|ADR 0011]]. It **replaces** the v1 TB-06 engine (EBA prune + regret-of-omission sum tiebreaker) entirely — see §"What changed from v1" at the bottom.

## Where the canonical code lives

- **Engine logic** — `supabase/functions/_shared/verdict-engine.ts` (pure functions, `computeVerdict()`).
- **Edge Function** — `supabase/functions/compute-verdict/` (`handler.ts` + `index.ts`, supabase-js adapter).
- **Schema mapping layer** — `supabase/functions/_shared/votes-schema.ts` ([[../15_issues/v1.1/issues/tb-04-votes-jsonb-schema|tb-04]]). The engine reads quiz answers through this layer, never by hardcoded field name.
- **Firing predicate** — `supabase/functions/_shared/verdict-firing.ts` (`decideFiring()`).
- **Schema** — `supabase/migrations/20260513220000000_verdicts_and_cuts.sql` (verdicts + cuts); `supabase/migrations/20260515020000000_verdict_fire_on_q5_complete.sql` (v1.1 firing trigger + RPC).
- **iOS reader** — `ios/Sources/App/VerdictStore.swift` (read-only over PostgREST).
- **iOS surface** — `ios/Sources/App/VerdictScreen.swift` (S05).

## Implementation choice — TypeScript Edge Function over PL/pgSQL

The PRD ([[../10_prds/v1.1-quiz-redesign-prd|v1.1-quiz-redesign-prd]] module B) fixes only the interface and leaves the implementation choice to the engineer. The engine stays a TypeScript Edge Function for two reasons:

1. **Rule-text formatting is verbose in SQL.** The engine emits aggregate-attribution strings; conditional join + capitalisation logic is cleaner in TS.
2. **Fixture testability without a live Postgres.** Deno tests against the pure `computeVerdict()` exercise the whole pipeline with no database container. The Edge Function HTTP layer has its own handler tests with an in-memory data adapter.

The engine is **pure** — no network, no Supabase client, no clock, no ambient randomness. The one source of randomness is injected (`VerdictEngineOptions.random`) so a verdict is reproducible. Running server-side is load-bearing: the verdict must be byte-identical for every member.

## The pipeline — six steps

`computeVerdict(input, options)` runs:

1. **EBA prune** — drop venues failing ANY member's hard vetoes. Three veto channels, none of which relax (see below). Run once; its survivors feed every cascade iteration.
2. **Per-member scoring** — each member's preference function scores every EBA survivor 1..5. Scored once; the matrix is reused across the cascade.
3. **Satisficing floor** — keep venues every member scores at or above the acceptability threshold T (cohort-zero default 3, inclusive).
4. **Maximin tiebreak** — among floor survivors, pick the venue with the highest *minimum* member score. This protects the worst-off member rather than averaging the group: a polarizing higher-sum pick LOSES to a worst-off-protecting one. This is the load-bearing anti-defection mechanic (the Kim 2023 backfire avoidance, [[../50_product/framework-comparison|framework-comparison]]).
5. **Final tiebreak** — equal minimums break on the higher group sum, then on the injected random (`flat_tiebreak_fallback` flags this).
6. **Empty-floor cascade** — when no venue clears the floor, relax (see below), then emit a terminal `no_survivor` output.

## EBA prune — three hard-veto channels

All three are hard NEEDs; none relax. The first failing predicate decides the cut:

1. **Q2 spend cap** — the binding cap is the MIN `q2_budget` tier across members. A candidate with `price_tier > minBudget` is cut (`cut_reason='budget'`). A null `price_tier` passes — Foursquare frequently omits price, and failing-closed would over-prune.
2. **Dietary menu-compliance** — Q1-era dietary chips plus `hard_vetoes` of kind `dietary`. A candidate whose `dietary_tags` lacks the required tag for an active chip is cut (`cut_reason='dietary'`, cut_text `"{chip} veto"`). The chip→tag map (`DIETARY_REQUIREMENTS`) mirrors `DIETARY_CHIP_MAP.emit_tag` in `foursquare.ts`. The "Nothing tonight" / "No preference" chips carry no constraint.
3. **Generic `hard_vetoes`** — the schema-driven channel TB-12 profile vetoes feed:
   - kind `tag` — a raw required allergy tag missing from `dietary_tags` (escape hatch for tags the dietary chip map doesn't cover) → `cut_reason='veto'`.
   - kind `cuisine_never` — a vetoed cuisine substring matched against the candidate's `categories` → `cut_reason='veto'`.

If the EBA pass leaves zero survivors, the engine short-circuits straight to `no_survivor` (the cascade has nothing to relax — hard vetoes never recover).

## Per-member scoring

Each member scores every EBA survivor on a 1..5 scale, the same scale as the satisficing threshold T. The score comes from one of two sources:

- **Injected `prefFn`** (the live path) — the per-member preference function built per [[../50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]] §3 from the member's Q1–Q5 answers, cached by the running-union pool manager ([[../15_issues/v1.1/issues/tb-10-running-union-pool-manager|tb-10]]).
- **Static `scores` map** (the test / replay path) — a per-candidate cached score, read only when `prefFn` is absent. A candidate id missing from the map falls back to `scores.__fallback`, then to the neutral threshold.

For each candidate the engine records `minScore` (the maximin key) and `sumScore` (the final-tiebreak key).

## Satisficing floor + maximin + final tiebreak

- **Floor** — keep candidates where `minScore >= threshold`.
- **Maximin** — among floor survivors, the highest `minScore` wins.
- **Final tiebreak** — maximin ties break on highest `sumScore`; a remaining tie breaks on the injected random and sets `flat_tiebreak_fallback = true`.

## Empty-floor cascade — `RELAX_STEPS`

When a cascade iteration leaves the floor empty, the engine relaxes in this canonical order (exposed as `RELAX_STEPS = ["threshold", "radius_widen"]` on the module surface so iOS / web / QA share one vocabulary):

1. **`threshold`** — lower T by 1, down to a floor of 1. Relaxing past 1 is meaningless on a 1..5 scale.
2. **`radius_widen`** — once T bottoms out, widen the search radius by 805 m (0.5 mi) per step, up to `radius_meters_cap` (default 8047 m / 5 mi). The radius gate is only active when the caller supplied a `radius_meters` and candidates carry `distance_meters`; otherwise the caller pre-filtered the pool and the gate is a no-op.

Hard-veto cuts (budget / dietary / generic veto) NEVER appear in the cascade — they are immune. The cascade trail is surfaced in `relax_chain_applied` for observability; the UI does not render it (silent relax, per the [[../50_product/v1-scope|v1-scope]] no-survivor rule).

When the cascade is exhausted, the engine emits a `no_survivor` output:

- `winning_option_id = null`, `method = "no_survivor"`, `cuts = []`.
- `rule_text` — aggregate-attribution copy (`"No spot fit within vegan options and $$ cap tonight."`); never names a person.
- `surviving_hard_needs` — short anonymized labels for the S05 meta line.
- `radius_meters_used` / `threshold_used` — the last values the engine tried.

## Cut reason vocabulary

Machine tokens emitted into `option_cuts.cut_reason`. The `OptionCut` type documents the set `budget · dietary · veto · radius · below_floor · lower_maximin`:

- `budget` — `price_tier` exceeded the MIN member spend cap.
- `dietary` — failed a dietary chip's menu-compliance tag.
- `veto` — failed a generic `hard_vetoes` entry (raw allergy tag or cuisine NEVER).
- `below_floor` — survived EBA but at least one member scored it below the (possibly relaxed) threshold T.
- `lower_maximin` — cleared the floor but lost the maximin / final tiebreak.

`below_floor` and `lower_maximin` are emitted only when a winner is seated — the Cuts drawer on S05 shows the full elimination picture: EBA hard-veto cuts first, then every scored non-winner.

## Rule text generation — aggregate attribution

The rule chip is the load-bearing copy on S05. Per [[../50_product/verdict-screen-spec|verdict-screen-spec]] §"Name the rule, not the picker" the engine NEVER names a person or exposes a private constraint. It emits aggregate sentences, joined with single spaces:

- More than one floor survivor: `"{name} was the safest pick for everyone — the best worst-case score."` — names the maximin rule, not a member.
- Exactly one floor survivor: `"{name} was the only spot the whole group was OK with."`
- When `radius_widen` fired: append `"The search radius was widened to find it."`
- Reroll runs prefix the rule with `"{Cost|Distance|Mood|Diet|Availability} reroll cut {prior pick}."` — the rerolling member is never named.

## Anonymization rules — dietary chips are private

Every dietary chip is treated as private. Consequences:

- The rule chip never lists "dairy / shellfish / nuts" as the cause; `surviving_hard_needs` surfaces them via "safe options" framing.
- Voice receipts (`buildReceipts`) carry a lowercase first name + an anonymized action verb-phrase (`"filtered {chip}"`, `"set a hard limit"`, `"capped at $$"`, `"voted in"`) — attribute, never a personal-causal claim. Receipts are computed from `votes`, not stored.

## Reroll handling

The engine accepts a reroll slice on its input, populated by the `apply_reroll` RPC ([[../15_issues/v1/issues/tb-10-reroll|v1 tb-10]] reroll path, carried into v1.1):

- `excluded_option_ids` — option ids removed from the pool *before* pruning (`avail`-reason rerolls); they never reach the Cuts surface.
- `reroll_reason` (`cost · dist · mood · diet · avail`) — drives the rule-text prefix and the `verdicts.reroll_reason` stamp.
- `previous_winner_name` — the option the reroll replaced.

A `dist`-reason reroll no longer prunes via a `walk_minutes` override: walk-minutes left the quiz for the parameters bucket in the v1.1 redesign, so a `dist` reroll's effect is carried through the radius gate and the re-fetched, re-scored candidate pool. `rooms.walk_minutes_override` is retained for schema stability but the engine no longer applies it.

## Edge Function — `compute-verdict`

POST body `{ room_id }`, with optional `method` and `radius_meters_override`. The handler (`handler.ts`) is independent of the supabase-js client so tests exercise it with an in-memory adapter.

- **Method** — the auto-fire dispatcher passes `quorum` / `deadline`; anything else is `manual`. The engine overrides to `no_survivor` when the cascade is exhausted.
- **Idempotency** — if a verdict already exists for the room, the handler returns it with `already_computed: true`, 200. Two exceptions: a widen-radius re-run over a prior `no_survivor`, and a reroll run (`last_reroll_reason` set on the room — the `apply_reroll` RPC already deleted the prior verdict).
- **Widen-radius re-run** — `radius_meters_override` is clamped defensively to `[805, 16093]` (0.5..10 mi). On a prior `no_survivor` the handler drops the old verdict (FK cascade clears `option_cuts`) and re-runs with `radius_meters` and `radius_meters_cap` both set to the override, so the engine doesn't widen past where the user asked.
- **TB-12 profile vetoes** — `fetchProfileVetoes` reads each member's sticky per-account allergies / dietary restrictions / cuisine NEVERS and folds them into the member's `hard_vetoes` channel. Profile data lives on the account record, not the per-session `votes` row.
- **Post-write** — best-effort: flip `rooms.status` to `verdict_ready` (the iOS Realtime handshake into S05) and emit a `verdict_ready` broadcast on `room:{room_id}`. A failure here is logged, not surfaced.

## Firing — Q5-complete signal, no timer

The v1.1 quiz has no shot clock ([[../10_prds/v1.1-quiz-redesign-prd|v1.1-quiz-redesign-prd]] module H). The verdict fires on exactly two signals, decided by the pure predicate `decideFiring()` in `verdict-firing.ts` (`FiringMethod = "quorum" | "manual"`):

- **All participants completed Q5** — the `AFTER INSERT ON votes` trigger auto-fires the moment every current room member has a `regret`-kind votes slot. No `deadline_at` channel, no minimum quorum.
- **Initiator closed voting** — the `fire_verdict(room_id)` RPC, with the v1 two-vote quorum gate removed, produces the verdict on demand. A solo session (initiator alone) resolves; the initiator never waits on a straggler.

The SQL trigger / RPC in `20260515020000000_verdict_fire_on_q5_complete.sql` mirror the `decideFiring` predicate. The v1 per-minute `gettoit_verdict_auto_fire` timer cron is unscheduled — a timer cron would expire a live v1.1 room mid-quiz. `rooms.timer_minutes` / `rooms.deadline_at` are left in place as inert columns.

## Edge cases the engine handles

- **No votes** — `computeVerdict` throws; the engine requires at least one member's input. The Edge Function returns 404 `no_votes` before reaching the engine.
- **EBA prunes everything** — immediate `no_survivor`; the cascade has no soft lever to pull.
- **Null `price_tier`** — treated as "tier unknown, passes the cap." Failing-closed would over-prune.
- **Null `distance_meters`** — the candidate always passes the radius gate (the caller pre-filtered).
- **Missing score** — a candidate id absent from a static `scores` map falls back to `__fallback`, then to the neutral threshold; a member who didn't rate a candidate doesn't sink it.
- **Single floor survivor** — maximin is moot; the rule chip uses the "only spot" copy.

## Idempotency contract

The Edge Function checks `existingVerdict(room_id)` first. The `verdicts.room_id` UNIQUE constraint enforces one verdict per room at the DB layer. Widen-radius re-runs and reroll runs are the documented exceptions — both delete the prior row so the engine can write fresh.

## Tests

- `verdict-engine.test.ts` — the pure-pipeline acceptance suite, including the pinned anti-defection case (a polarizing higher-sum pick loses to a worst-off-protecting one). The three v1-era files (`verdict-engine-relax/-reroll/-solo.test.ts`) were removed — they tested the deleted pipeline.
- `compute-verdict/index.test.ts`, `index-no-survivor.test.ts`, `index-reroll.test.ts` — Edge Function handler tests against the in-memory adapter.

## What changed from v1 (TB-06 → TB-11)

The v1 engine ran EBA pruning followed by a **regret-of-omission sum** tiebreaker — the survivor with the highest summed Q5 regret across members won. ADR 0011 rejected that: a sum (utilitarian) aggregation lets a polarizing pick win even though one member quietly hates it — the exact post-decision defection GetToIt exists to prevent. Specifically:

- The Q5 regret-sum tiebreaker is gone; the maximin rule replaces it.
- The v1 cuisine-veto / vibe-floor soft relax steps are gone — cuisine, reputation and vibe are now soft *scoring* axes inside each member's `prefFn`, not in-engine filters. The cascade's only levers are the satisficing threshold and the radius.
- The engine consumes input through the `votes-schema.ts` mapping layer, never by hardcoded field name.

## Related

- [[adr/0011-worst-off-protecting-verdict-engine|ADR 0011]] — the decision record for this engine.
- [[adr/0010-generic-jsonb-votes-schema|ADR 0010]] — the generic jsonb votes schema the mapping layer reads.
- [[../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] §module B.
- [[../50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]] §3 (preference function) + §4 (verdict aggregation).
- [[../50_product/verdict-screen-spec|verdict-screen-spec]] — verdict-screen copy framework.
- [[waiting-fire-trigger|waiting-fire-trigger.md]] — the Waiting surface + Realtime wiring.
