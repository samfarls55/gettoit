---
folder: 60_engineering
purpose: Server-authoritative VerdictEngine — architecture, edge cases, anonymization rules
---

# VerdictEngine — TB-06 clean-run

Server-authoritative engine that turns a room's `votes` + `options` into a single `verdicts` row plus `option_cuts` rows. The S05 surface reads the engine's output; the iOS client never recomputes a verdict.

## Where the canonical code lives

- **Engine logic** — `supabase/functions/_shared/verdict-engine.ts` (pure functions).
- **Edge Function** — `supabase/functions/compute-verdict/` (handler + index, supabase-js adapter).
- **Schema** — `supabase/migrations/20260513220000000_verdicts_and_cuts.sql`.
- **iOS reader** — `ios/Sources/App/VerdictStore.swift` (read-only over PostgREST).
- **iOS surface** — `ios/Sources/App/VerdictScreen.swift` (S05 `default` mode).

## Implementation choice — TypeScript Edge Function over PL/pgSQL

The PRD ([[../10_prds/v1-prd|v1-prd]] §"Modules" #10) leaves the choice open. TB-06 landed on a TypeScript Edge Function for three reasons:

1. **Rule-text formatting is verbose in SQL.** The engine emits aggregate-attribution strings ("Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.") which require conditional join + capitalisation logic. TS is the cleaner home.
2. **Fixture testability without a live Postgres.** Deno tests against pure functions exercise the engine algorithm end-to-end without spinning up a database container. The Edge Function HTTP layer has its own thin handler tests with an in-memory data adapter.
3. **The "RPC" framing in the ticket maps to `client.functions.invoke("compute-verdict")`.** Supabase's Functions API is the modern equivalent of an RPC for stateful operations; pure RPC stays for read-only / declarative queries.

TB-07 will land the auto-fire path. Two options under consideration:
- Postgres trigger `AFTER INSERT ON votes` that uses `pg_net.http_post` to invoke the Edge Function. Simpler trigger code; depends on `pg_net`.
- `pg_cron` job that polls rooms whose `deadline_at` has passed and triggers the same Edge Function. Same `pg_net` dependency.

Either path keeps the engine canonical in TypeScript — the trigger is the dispatcher, not the engine.

## EBA pruning order — fixed for TB-06 + TB-09

The engine prunes candidates in this order; the first failing predicate decides the cut reason:

1. **Q1 dietary (`emit_tag` membership)** — `cut_reason='dietary'`. Hard NEED. Never relaxes.
2. **Q2 budget tier ≤ min member cap** — `cut_reason='budget'`. Hard NEED. Never relaxes.
3. **Q3 walk minutes ≤ min member threshold** — `cut_reason='walk'`. Hard NEED. Never relaxes.
4. **Soft cuisine veto** (any member's `soft_cuisine_vetoes` chip matches `option.categories` by substring) — `cut_reason='cuisine_veto'`. Soft. Relaxes on the cascade's first step.
5. **Q4 vibe floor** (`option.vibe_signal < max_member_q4_vibe - state.vibeFloorRelaxStep`) — `cut_reason='vibe_floor'`. Soft. Relaxes on the cascade's second step.
6. **Radius** (`option.distance_meters > state.radiusMeters`) — `cut_reason='radius_widen'`. Soft. Relaxes on the cascade's third step in 805 m (0.5 mi) increments up to `radius_meters_cap`.

## Cut reason vocabulary

Short machine tokens emitted into `option_cuts.cut_reason`:

- `dietary` — failed a dietary `emit_tag` requirement.
- `budget` — `price_tier > min(q2_budget)` across members.
- `walk` — `walk_minutes_estimate > min(q3_walk_minutes)` across members.
- `cuisine_veto` — matched a member's soft cuisine veto chip on the option's categories before that chip was relaxed.
- `vibe_floor` — option's `vibe_signal` fell below the effective vibe floor (max member q4_vibe minus any vibe_floor relax steps).
- `radius_widen` — option's `distance_meters` exceeded the (possibly already-widened) radius.
- `no_regret` — survived pruning but lost the Q5 tiebreaker (or tied on the flat-regret fallback path).

## Q5 regret tiebreaker

After pruning, the engine:

1. Sums `q5_regret[option_id]` across every member's vote per surviving option.
2. If population variance over the sums exceeds the flat-regret threshold (default `0` — exact tie only), the maximum-sum option wins.
3. Otherwise, fall back to random within the survivor set. The randomness is injectable for tests (`computeVerdict(input, { random: () => 0.5 })`).

The variance threshold is a tuneable, not a research finding. Default of `0` means "fall back only on exact tie." Tests can lift it to model wider bands; production should keep `0` until cohort-1 telemetry says otherwise.

## Rule text generation — aggregate attribution

The rule chip is the load-bearing copy on S05. Per [[../50_product/verdict-screen-spec|verdict-screen-spec]] §"Name the rule, not the picker" the engine NEVER:

- Names a person ("Maya's veto cut Ren Soba").
- Exposes a private constraint ("Alex's shellfish allergy filtered Café Lou").

Instead, it emits aggregate attribution sentences:

- `"Budget cap cut Ren Soba."` — the rule (budget cap), not a member, is the agent.
- `"Shellfish-safe kitchens filter applied."` — the constraint (attribute), not the person, is named.
- `"Pico's had the lowest regret-of-omission."` — the tiebreaker explanation when multiple options survive.

Sentences are joined with single spaces. The S05 surface renders the result in the rule-chip slot at the locked 1020ms reveal step.

## Anonymization rules — all dietary chips are private

The first iteration of the engine treats every dietary chip as private (`private: true` in the requirements table). This is more conservative than the JSX hint suggests but matches the verdict-screen-spec's stated rule: "Names are consented; conditions are not."

Consequences:

- The rule chip never lists "dairy / shellfish / nuts" as the cause; it surfaces them via "safe options" framing ("Shellfish-safe kitchens filter applied.").
- The cut text for a cut option uses the short `"{chip} veto"` form ("shellfish veto") rather than naming a constraint that's private.
- Receipts use `"filtered {chip}"` — attribute, not person ("alex filtered shellfish").

If marketing-branding lands the final copy and wants a different register, the chip → label mapping is the only thing that needs to change — the engine's anonymization gate stays in place.

## Soft-pref relax cascade — locked for TB-09

When `runPruning` returns zero survivors, the engine attempts to relax soft preferences in this canonical order before giving up:

1. **`cuisine_veto`** — drop the MOST-cited cuisine veto across members. Tie among cuisines with the same citation count: lexicographic-arbitrary (Map iteration order). The dropped chip is added to `state.droppedCuisines` and the engine re-runs pruning. If more than one cuisine is active, subsequent cascade iterations drop the next most-cited.
2. **`vibe_floor`** — increment `state.vibeFloorRelaxStep` by 1. Each step widens the gap between candidate `vibe_signal` and the room's max `q4_vibe`. After 5 increments the floor is fully open (covers the entire 0..4 scale) and further relax is a no-op.
3. **`radius_widen`** — add 805 m (0.5 mi) to `state.radiusMeters`, capped at `radius_meters_cap`. The S01 default cap is 8047 m (5 mi); the S05 "Widen radius" CTA raises it to whatever the user picked on the inline slider (1..10 mi).

Hard NEED vetoes (Q1 dietary, Q2 budget, Q3 walk) NEVER appear in `relax_chain_applied` — they are immune to the cascade. The engine surfaces the cascade trail in `VerdictEngineOutput.relax_chain_applied` for observability; the UI does not render it (silent relax).

If the cascade is exhausted and survivors are still 0, the engine emits a `no_survivor` output:

- `winning_option_id = null`
- `method = "no_survivor"`
- `cuts = []` (the S05 no-survivor surface suppresses the cuts drawer)
- `rule_text` — aggregate-attribution copy like `"Vegan options left no candidates within walking distance tonight."`. NEVER names a person.
- `surviving_hard_needs` — short labels for the S05 meta line (`["vegan options", "$$ cap", "15 min walk"]`).
- `radius_meters_used` — the last radius the engine tried (helpful for the widen slider's default-next-suggestion math).

## Widen-radius re-run

The `compute-verdict` Edge Function accepts an optional `radius_meters_override` body field. When supplied:

- Clamped to `[805, 16093]` (0.5..10 mi) defensively against client tampering.
- The handler reads the existing verdict via `existingVerdict(room_id)`. If a prior verdict exists AND its `method === "no_survivor"`, the handler calls `deleteVerdictForRoom` (FK cascade drops `option_cuts`) so the engine can write fresh under the `verdicts.room_id` UNIQUE constraint.
- If a prior `method = "manual"` verdict exists, the override is IGNORED — successful verdicts are never replaced by a widen request. Defends against a duplicate "Widen radius" tap after the engine has produced a winner.
- The engine runs with `radius_meters = override` and `radius_meters_cap = override` so it doesn't itself widen past where the user asked.

## What's not in TB-09 (next tracer bullets)

- **TB-07** ✅ landed — `AFTER INSERT ON votes` trigger that fires the engine on full quorum + status='firing'; `pg_cron` job (`gettoit_verdict_auto_fire`) that fires on deadline expiry; Realtime Broadcast on `verdict_ready`; `fire_verdict(room_id)` RPC for the initiator's "Decide now" tap. See [[waiting-fire-trigger|waiting-fire-trigger.md]].
- **TB-08** — `"I'm in"` ratification wiring + push permission prompt + hard-close motion.
- **TB-10** — reroll sheet, 3-per-session cap, reason-to-constraint mapping. The reroll reason taxonomy (`cost · dist · mood · diet · avail`) writes into `votes.soft_cuisine_vetoes` for "diet" and into vibe / budget / walk fields for the others; the engine's cuisine-veto step is the consumer.
- **TB-11** — late-joiner read-only verdict surface (S05 `read-only` mode).

## Edge cases the engine handles

- **Empty Q5 regret map** — a member who didn't rate a candidate contributes 0 to that candidate's regret sum. The engine doesn't penalise the candidate.
- **Single-survivor short-circuit** — when EBA leaves exactly one option, Q5 is skipped (variance is moot). The rule chip surfaces the elimination reasons without naming a tiebreaker.
- **Unknown chip in `q1_vetoes`** — the engine ignores chips not in `DIETARY_REQUIREMENTS` so placeholder copy churn during TB-04 doesn't break the engine. The `nothing_tonight` escape is explicitly recognised as a no-op.
- **`price_tier` null on a candidate** — treated as "tier unknown, passes the cap." Foursquare frequently omits price; failing-closed would over-prune.
- **`walk_minutes_estimate` null** — same treatment as price.

## Idempotency contract

The Edge Function checks `existingVerdict(room_id)` first. If a verdict exists, it returns that row + an empty cuts list with `already_computed: true`. The unique constraint on `verdicts.room_id` enforces the same shape at the DB layer — a second insert would 23505. TB-07's trigger will use `ON CONFLICT (room_id) DO NOTHING` so duplicate trigger-fires don't fight each other.

TB-09's widen-radius re-run is the documented exception: when `radius_meters_override` is supplied AND the existing verdict is a `no_survivor`, the handler drops the prior row (cascading the empty `option_cuts` set) so the engine can write fresh. Successful (manual) verdicts are never replaced by a widen request.

## Choreography token note

The S05 reveal needs seven timing constants. `tokens.json` originally exposed only four (`name`, `time`, `rule`, `stagger-receipt`). TB-06 added the missing three (`eyebrow`, `meta`, `receipts`, `cta`) so the SwiftUI port can source them via `GTITokens.swift` rather than inlining literals. The values are taken verbatim from `motion.md` §"Verdict reveal — full choreography" and `ScreenVerdict.jsx`'s `VERDICT_CHOREO` constant — no rounding.

## Adjacencies flagged (not fixed)

- **`options_select_room_members` SELECT policy** — TB-05's `options` table left this SELECT policy as a follow-up. TB-06 added it inline in the verdicts migration because the verdict cuts drawer needs to join `option_cuts` → `options` to get the human name. If a future TB needs `options.SELECT` to behave differently, the policy lives in `20260513220000000_verdicts_and_cuts.sql`.
- **Display-name source for receipts** — the iOS surface and the Edge Function both currently surface `"m{uuid_prefix}"` as the receipt name. TB-08 (ratification) or TB-12 (Apple Sign-in) will introduce a stable `display_name`. The receipts contract is robust against this — receipts are computed from `votes` not stored.
- **Wall-clock "when" for the time badge** — the JSX prints `7:00 PM`; the iOS surface and the engine both hardcode the same placeholder. Real scheduling is a post-v1 candidate.

## Related

- [[../10_prds/v1-prd|v1 PRD]] §"VerdictEngine"
- [[../50_product/verdict-screen-spec|verdict-screen-spec]] — convergent prescriptions across constructs
- [[../50_product/decision-model|decision-model]] — EBA + satisficing rationale
- [[stack-patterns|stack-patterns.md]] §"Deadline / quorum / verdict computation"
