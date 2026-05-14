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

## EBA pruning order — fixed for TB-06

The engine prunes candidates in this order; the first failing predicate decides the cut reason:

1. **Q1 dietary (`emit_tag` membership)** — `cut_reason='dietary'`.
2. **Q2 budget tier ≤ min member cap** — `cut_reason='budget'`.
3. **Q3 walk minutes ≤ min member threshold** — `cut_reason='walk'`.

Q4 vibe is captured for receipts but NOT a hard cut in TB-06 — the soft-pref relax order ([[../10_prds/v1-prd|v1-prd]] §"Mechanics — engine specifics" #2) lands in TB-09 alongside the no-survivor terminal.

## Cut reason vocabulary

Short machine tokens emitted into `option_cuts.cut_reason`:

- `dietary` — failed a dietary `emit_tag` requirement.
- `budget` — `price_tier > min(q2_budget)` across members.
- `walk` — `walk_minutes_estimate > min(q3_walk_minutes)` across members.
- `no_regret` — survived pruning but lost the Q5 tiebreaker (or tied on the flat-regret fallback path).

TB-09 will add `cuisine_veto`, `vibe_floor`, `radius_widen` for the relax chain.

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

## What's not in TB-06

Tracked in subsequent tracer bullets:

- **TB-07** — `AFTER INSERT ON votes` trigger that fires the engine on full quorum; `pg_cron` job that fires on deadline expiry. Realtime broadcast on `verdict_ready`.
- **TB-08** — `"I'm in"` ratification wiring + push permission prompt + hard-close motion.
- **TB-09** — soft-pref silent relax (cuisine veto → vibe floor → radius widen). No-survivor terminal surface (S05 `no-survivor` mode).
- **TB-10** — reroll sheet, 3-per-session cap, reason-to-constraint mapping.
- **TB-11** — late-joiner read-only verdict surface (S05 `read-only` mode).

## Edge cases the engine handles

- **Empty Q5 regret map** — a member who didn't rate a candidate contributes 0 to that candidate's regret sum. The engine doesn't penalise the candidate.
- **Single-survivor short-circuit** — when EBA leaves exactly one option, Q5 is skipped (variance is moot). The rule chip surfaces the elimination reasons without naming a tiebreaker.
- **Unknown chip in `q1_vetoes`** — the engine ignores chips not in `DIETARY_REQUIREMENTS` so placeholder copy churn during TB-04 doesn't break the engine. The `nothing_tonight` escape is explicitly recognised as a no-op.
- **`price_tier` null on a candidate** — treated as "tier unknown, passes the cap." Foursquare frequently omits price; failing-closed would over-prune.
- **`walk_minutes_estimate` null** — same treatment as price.

## Edge cases TB-06 does NOT handle (TB-09 owns)

- **No survivors after pruning** — TB-06's engine throws `"no survivors"` and the Edge Function returns 422. TB-09 lands the soft-pref relax + `method='no_survivor'` terminal.
- **Cuisine veto** — soft signal, not exercised in TB-06.
- **Vibe floor** — soft signal, not exercised in TB-06.

## Idempotency contract

The Edge Function checks `existingVerdict(room_id)` first. If a verdict exists, it returns that row + an empty cuts list with `already_computed: true`. The unique constraint on `verdicts.room_id` enforces the same shape at the DB layer — a second insert would 23505. TB-07's trigger will use `ON CONFLICT (room_id) DO NOTHING` so duplicate trigger-fires don't fight each other.

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
