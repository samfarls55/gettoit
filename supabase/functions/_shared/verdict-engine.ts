// VerdictEngine — clean-run + soft-pref relax + no-survivor terminal.
//
// Pure functions. No network, no Supabase client. The Edge Function
// `compute-verdict/index.ts` composes this with the live database read
// of votes + options + members and the live write of verdicts +
// option_cuts.
//
// Behavior (TB-06 + TB-09):
//   * EBA pruning on Q1 (dietary menu-compliance), Q2 (price-tier cap),
//     Q3 (walk-minutes threshold) and on the soft signals Q4 (vibe
//     floor) + cuisine veto + radius. Q1/Q2/Q3 are hard NEED vetoes
//     that NEVER relax. Q4 vibe + cuisine veto + radius are soft.
//   * Q5 regret-of-omission tiebreaker — sum across members; max wins.
//   * Flat-regret fallback — when variance of survivor sums is below a
//     flat-signal threshold, pick a survivor via injected random.
//   * Soft-pref silent relax (TB-09) — when survivors = 0 AND at least
//     one soft preference is active, the engine relaxes in canonical
//     order:
//       1. drop the MOST-cited cuisine veto;
//       2. lower the vibe floor by 1 stop (the engine treats vibe as a
//          floor with `relax_amount` steps; the production "floor" in
//          TB-09 is satisfy-on-equality, the first relax allows ±1);
//       3. widen the radius by 0.5 mi (805 m) up to `radius_meters_cap`.
//     and re-runs the pruning. Silent — no UI signal. The order +
//     amounts are canonical per v1-prd §"Mechanics — engine specifics".
//   * No-survivor terminal (TB-09) — when the cascade is exhausted and
//     survivors are still 0, the engine emits `method = 'no_survivor'`
//     with `winning_option_id = null`, empty cuts, and a rule_text
//     describing which hard-need vetoes survived (aggregate
//     attribution; never names a person).
//   * Rule text generation in the "aggregate attribution, never a
//     person" register (PRD §"Mechanics — engine specifics" #6,
//     verdict-screen-spec §"Name the rule, not the picker").
//   * Cuts: every eliminated option emits an `option_cuts` row (clean
//     runs only; no_survivor mode emits no cuts).
//
// Out of scope:
//   * Reroll (TB-10) — reason-to-constraint mapping is a separate
//     hook, not part of the engine surface.
//   * Single-survivor "Only one made it tonight" eyebrow shift (the cuts
//     drawer auto-open lands in S05 UI; the engine still emits one
//     survivor + the cuts).
//
// Why TypeScript rather than PL/pgSQL:
//   * The rule-text + cut-text formatting is verbose to express in SQL
//     and harder to fixture-test in CI without a live Postgres.
//   * The PRD explicitly leaves the implementation choice to the
//     engineer (§"Modules" #10): "Implementation choice — pure SQL with
//     a trigger, or TypeScript in an Edge Function — is left to the
//     engineer; the interface is the contract."
//   * The PRD calls out `compute_verdict(room_id)` as the public
//     interface — for TB-06 this is invoked via the Edge Function's
//     POST surface (`functions.invoke('compute-verdict')`); TB-07 will
//     add an `AFTER INSERT ON votes` trigger that fires the same path.

// ───────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────

/** A candidate option for the room. The shape mirrors the slice of
 *  `options.payload` that the engine reads. */
export interface CandidateOption {
  /** Stable id used in `q5_regret` keys + `verdicts.option_id`. */
  id: string;
  /** Display name surfaced in `rule_text` + cut text. */
  name: string;
  /** Foursquare price tier 1..4 (`$` to `$$$$`). Null when unknown. */
  price_tier: number | null;
  /** Estimated walk minutes from the search centre. Null when unknown. */
  walk_minutes_estimate: number | null;
  /** Dietary `emit_tag`s carried over from the PlacesProxy. The engine
   *  matches each member's Q1 veto against the corresponding tag. */
  dietary_tags: string[];
  /** Display categories (for diagnostic rule text). */
  categories: string[];
  /** Q4 vibe scalar on the same 0..4 scale as `MemberVote.q4_vibe`.
   *  Null/undefined when the upstream data source omits a vibe signal.
   *  When the room has an active vibe floor and the candidate's
   *  `vibe_signal` is below that floor, the candidate is filtered;
   *  the soft-pref relax step lowers the floor delta progressively. */
  vibe_signal?: number | null;
  /** Distance from the room's search centre, in meters. Used by the
   *  radius_widen relax step. The TB-06 clean run didn't need this
   *  field because the candidate pool is already filtered to the
   *  search radius by the PlacesProxy; TB-09's widen step needs to
   *  re-filter against a wider radius cap. */
  distance_meters?: number | null;
}

/** A member's vote row. Shape mirrors the slice of `votes` the engine
 *  reads. `display_name` is whatever the receipts surface should show —
 *  the Edge Function injects it; tests pass a hand-set value. */
export interface MemberVote {
  user_id: string;
  display_name: string;
  /** Q1 dietary veto chips (`shellfish`, `vegan`, `halal`, …). */
  q1_vetoes: string[];
  /** Q2 budget cap tier (1..4). */
  q2_budget: number;
  /** Q3 walk-minutes threshold ({5,10,15,20,30}). */
  q3_walk_minutes: number;
  /** Q4 vibe scalar (0..4 = HUSHED..ROWDY). */
  q4_vibe: number;
  /** Q5 regret-of-omission scores keyed by option id. */
  q5_regret: Record<string, number>;
  /** Soft cuisine vetoes (lowercase tokens — `japanese`, `mexican`,
   *  …). Soft signal — the engine drops the most-cited cuisine veto
   *  during the relax cascade. Optional; v1 quiz does not yet expose
   *  this field directly, but the engine accepts it so the reroll
   *  reason-to-constraint mapping (TB-10) can write into it without
   *  another engine surface change. */
  soft_cuisine_vetoes?: string[];
}

/** How the verdict was triggered. The engine doesn't decide this — the
 *  caller (Edge Function entry point) classifies the fire path and
 *  passes it through. TB-06 only used `manual`; TB-07 widens to
 *  `quorum` (auto-fire on full-quorum vote INSERT) and `deadline`
 *  (auto-fire on pg_cron timer expiry). `no_survivor` belongs to
 *  TB-09's terminal. */
export type VerdictMethod = "manual" | "quorum" | "deadline" | "no_survivor";

export interface VerdictEngineInput {
  candidates: CandidateOption[];
  votes: MemberVote[];
  /** Optional caller-supplied method; defaults to `manual` (TB-06's
   *  original behavior). TB-07's dispatcher passes the auto-fire method
   *  through (`quorum` / `deadline`) so the row reflects the actual
   *  fire path. The engine overrides this with `no_survivor` when the
   *  TB-09 cascade is exhausted (regardless of what the caller
   *  passed). */
  method?: VerdictMethod;
  /** Initial room radius in meters. Defaults to 3219 m (~2.0 mi), the
   *  S01 slider default. The relax cascade may widen this in 805 m
   *  (0.5 mi) steps up to `radius_meters_cap`. Optional; when the
   *  caller omits both this and `radius_meters_cap`, the engine
   *  skips the radius_widen step (TB-06 callers expect this — the
   *  pool was already pre-filtered). */
  radius_meters?: number;
  /** Upper bound for the radius_widen relax step. Defaults to 8047 m
   *  (5.0 mi) — the S01 slider's ceiling. The S05 "Widen radius"
   *  CTA can push this to 16093 m (10.0 mi). */
  radius_meters_cap?: number;
}

/** Receipt row surfaced on S05. One per member. */
export interface VoiceReceipt {
  /** lowercase first name — per verdict-screen-spec §"Copy register". */
  name: string;
  /** action verb-phrase, anonymized for private constraints. */
  action: string;
}

/** One eliminated option. Mirrors the `option_cuts` table shape. */
export interface OptionCut {
  option_id: string;
  /** Machine-readable reason. One of: dietary, budget, walk, no_regret. */
  cut_reason: string;
  /** Human-readable cut text surfaced in the Cuts drawer. Aggregate
   *  attribution; anonymized for private constraints. */
  cut_text: string;
}

/** Canonical relax step labels. The order in this array is the
 *  order in which `computeVerdict` applies the steps — kept on the
 *  module surface so iOS / web / QA can talk about the cascade with
 *  one shared vocabulary rather than inventing their own. */
export const RELAX_STEPS = ["cuisine_veto", "vibe_floor", "radius_widen"] as const;
export type RelaxStep = typeof RELAX_STEPS[number];

export interface VerdictEngineOutput {
  /** `verdicts.option_id` — null for `no_survivor`. */
  winning_option_id: string | null;
  /** `verdicts.method`. The caller passes `manual` / `quorum` /
   *  `deadline` to classify the fire path; the engine overrides to
   *  `no_survivor` when the cascade is exhausted and survivors are
   *  still 0. */
  method: VerdictMethod;
  /** `verdicts.rule_text` — the rule-chip copy. Aggregate
   *  attribution; never names a person. For `no_survivor` the chip
   *  carries the load-bearing message per
   *  `design-system/surfaces/05-verdict.md` §"no-survivor". */
  rule_text: string;
  /** `option_cuts` rows. Always empty when `method === "no_survivor"`
   *  — there is no winner, and the cuts drawer is suppressed on the
   *  no-survivor surface. */
  cuts: OptionCut[];
  /** Per-member receipt chips (UI surfaces these in S05 default).
   *  Not written to DB — they're rendered live from `votes`. The
   *  no-survivor surface suppresses receipts so the field is still
   *  populated but the consumer ignores it. */
  receipts: VoiceReceipt[];
  /** True when the regret signal across survivors was flat enough that
   *  the engine fell back to the random tiebreaker. */
  flat_regret_fallback: boolean;
  /** The relax steps the engine applied, in the order they fired.
   *  Empty when the clean run seated a winner. Useful for tests and
   *  optional observability; the UI does not surface this directly
   *  (the relax is silent by design). */
  relax_chain_applied: RelaxStep[];
  /** Hard NEED vetoes still active when the engine exits. For a
   *  `manual` run this lists the hard-needs that informed the
   *  surviving candidate; for a `no_survivor` exit this is the meta-
   *  line copy on S05 (`"Vegan options · $$ cap · 15 min walk"`).
   *  Each entry is short, human-readable, anonymized — short
   *  attribute labels like `"vegan options"` or `"$$ cap"`. */
  surviving_hard_needs: string[];
  /** Final radius the engine ran against, in meters. Equals the
   *  caller-supplied `radius_meters` for the clean run and the last
   *  widened value when the radius_widen step fired. */
  radius_meters_used: number | null;
}

export interface VerdictEngineOptions {
  /** Override the source of randomness for deterministic tests. */
  random?: () => number;
  /** Variance threshold — sums whose population variance is below this
   *  are treated as flat-signal. Tuned to a flat 0 — exact ties only —
   *  by default; tests can raise it. */
  flatRegretVarianceThreshold?: number;
}

// ───────────────────────────────────────────────────────────────────────
// Tag mapping — Q1 chip → required `dietary_tags` entry
// ───────────────────────────────────────────────────────────────────────
//
// Mirrors the `DIETARY_CHIP_MAP.emit_tag` from `_shared/foursquare.ts`.
// Kept inline rather than imported because:
//   * The foursquare module owns the upstream API shape and would import
//     awkwardly into anything that doesn't need Foursquare types.
//   * The mapping is small and visibly local to the engine's veto logic.
//
// Each entry says: "if any member's q1_vetoes includes `chip`, the
// surviving candidates must each carry `requiredTag` in `dietary_tags`."

interface DietaryRequirement {
  /** Lower-snake chip id, as written into `votes.q1_vetoes`. */
  chip: string;
  /** Tag the candidate must carry to satisfy the constraint. */
  requiredTag: string;
  /** Whether this constraint is private (allergy-style) — the cut text
   *  uses attribute attribution rather than naming a person. All
   *  dietary chips are treated as private per verdict-screen-spec §
   *  "Copy register" — names are consented, conditions are not. */
  private: boolean;
  /** Human-readable label for the rule chip / cut text. */
  label: string;
}

const DIETARY_REQUIREMENTS: readonly DietaryRequirement[] = Object.freeze([
  { chip: "vegan",      requiredTag: "vegan_friendly",          private: true,  label: "vegan options" },
  { chip: "vegetarian", requiredTag: "vegetarian_friendly",     private: true,  label: "vegetarian options" },
  { chip: "halal",      requiredTag: "halal",                   private: true,  label: "halal options" },
  { chip: "kosher",     requiredTag: "kosher",                  private: true,  label: "kosher options" },
  { chip: "gluten",     requiredTag: "gluten_free_options",     private: true,  label: "gluten-free options" },
  { chip: "dairy",      requiredTag: "no_dairy_unverified",     private: true,  label: "dairy-safe options" },
  { chip: "shellfish",  requiredTag: "no_shellfish_unverified", private: true,  label: "shellfish-safe options" },
  { chip: "nuts",       requiredTag: "no_nuts_unverified",      private: true,  label: "nut-safe options" },
]);

/** The "Nothing tonight" chip is mutually exclusive with the actual
 *  vetoes and carries no constraint. We accept the literal string
 *  defensively (and the variants `nothing` / `none`) so a placeholder-
 *  copy churn during TB-04 doesn't break the engine. */
const NO_OP_CHIPS: ReadonlySet<string> = new Set([
  "nothing_tonight",
  "nothing tonight",
  "nothing",
  "none",
]);

function lookupRequirement(chip: string): DietaryRequirement | undefined {
  const normalized = chip.trim().toLowerCase();
  if (NO_OP_CHIPS.has(normalized)) return undefined;
  return DIETARY_REQUIREMENTS.find((r) => r.chip === normalized);
}

// ───────────────────────────────────────────────────────────────────────
// Cuisine tagging — soft veto matching
// ───────────────────────────────────────────────────────────────────────
//
// Foursquare's category strings carry the cuisine signal. The engine
// matches a member's `soft_cuisine_vetoes` chip against the candidate's
// `categories` by substring (lowercase, word-boundary-tolerant). This
// is intentionally loose — Foursquare's category strings are verbose
// ("Japanese Restaurant", "Sushi Restaurant", "Ramen Restaurant") and
// the cuisine veto chips are short tokens ("japanese", "sushi"). A
// strict equality match would require maintaining a synonym table the
// PRD hasn't yet defined. Matching by substring lets the chip work
// against any category string that contains it; false positives are
// rare for v1's small chip taxonomy.

function candidateMatchesCuisine(c: CandidateOption, chip: string): boolean {
  const needle = chip.trim().toLowerCase();
  if (needle.length === 0) return false;
  return c.categories.some((cat) => cat.toLowerCase().includes(needle));
}

// ───────────────────────────────────────────────────────────────────────
// Tunables
// ───────────────────────────────────────────────────────────────────────

/** Default flat-regret variance threshold. Population variance ≤ this
 *  triggers the random-within-survivors fallback. With integer regret
 *  scores 1..5, "exactly tied" sums produce variance 0 and trip the
 *  fallback at threshold 0. Tests can lift this to model a wider band. */
const DEFAULT_FLAT_REGRET_VARIANCE_THRESHOLD = 0;

/** Default radius cap (`radius_meters_cap`) when callers omit it.
 *  Matches the S01 slider ceiling (5.0 mi ≈ 8047 m). The S05 "Widen
 *  radius" CTA can push past this by passing a wider cap. */
const DEFAULT_RADIUS_CAP_METERS = 8047;

/** Radius widen step — 0.5 mi ≈ 805 m. */
const RADIUS_WIDEN_STEP_METERS = 805;

/** State carried across the cascade — tracks how much the engine has
 *  already relaxed. */
interface RelaxState {
  /** Cuisine chips the cascade has already dropped (the engine
   *  ignores these on subsequent runs). */
  droppedCuisines: Set<string>;
  /** How much the vibe floor delta has been loosened. `0` = strict
   *  (candidate vibe must be ≥ floor); each cascade step adds `1` to
   *  the allowed gap. After enough relax steps the vibe gate becomes
   *  a no-op (gap ≥ 5 covers the entire HUSHED..ROWDY range). */
  vibeFloorRelaxStep: number;
  /** Current radius in meters. `null` when no radius gate is active. */
  radiusMeters: number | null;
}

// ───────────────────────────────────────────────────────────────────────
// Public surface
// ───────────────────────────────────────────────────────────────────────

export function computeVerdict(
  input: VerdictEngineInput,
  options: VerdictEngineOptions = {},
): VerdictEngineOutput {
  const { candidates, votes } = input;
  const random = options.random ?? Math.random;
  const flatThreshold =
    options.flatRegretVarianceThreshold ?? DEFAULT_FLAT_REGRET_VARIANCE_THRESHOLD;

  if (candidates.length === 0) {
    // Empty candidate pool is a `no_survivor` exit too — but the
    // engine still surfaces it as a no_survivor result rather than
    // throwing. The caller (Edge Function / iOS) needs a verdict row
    // either way so the surface can render the terminal state.
    return buildNoSurvivorOutput({
      votes,
      candidates,
      relaxChainApplied: [],
      radiusMetersUsed: input.radius_meters ?? null,
      reasonHint: "empty_pool",
    });
  }
  if (votes.length === 0) {
    throw new Error(
      "computeVerdict: no votes supplied — engine requires at least one member's input",
    );
  }

  // Aggregate room-level constraints out of the per-member votes.
  // Q2 cap: the binding cap is the MIN tier among members.
  // Q3 cap: the binding threshold is the MIN walk-minutes among members.
  const minBudget = votes.reduce(
    (acc, v) => Math.min(acc, v.q2_budget),
    Number.POSITIVE_INFINITY,
  );
  const minWalk = votes.reduce(
    (acc, v) => Math.min(acc, v.q3_walk_minutes),
    Number.POSITIVE_INFINITY,
  );

  // The set of dietary requirements demanded by AT LEAST one member.
  const activeRequirements: DietaryRequirement[] = [];
  for (const v of votes) {
    for (const chip of v.q1_vetoes) {
      const req = lookupRequirement(chip);
      if (req && !activeRequirements.find((r) => r.chip === req.chip)) {
        activeRequirements.push(req);
      }
    }
  }

  // Soft cuisine vetoes — count citations per chip so the cascade
  // step can pick the MOST-cited cuisine to drop first.
  const cuisineCitations = new Map<string, number>();
  for (const v of votes) {
    for (const raw of v.soft_cuisine_vetoes ?? []) {
      const chip = raw.trim().toLowerCase();
      if (chip.length === 0) continue;
      cuisineCitations.set(chip, (cuisineCitations.get(chip) ?? 0) + 1);
    }
  }

  // Vibe floor — the binding floor is the MAX of the member values
  // (the most-demanding voice). If every member is at vibe 0 there is
  // no floor.
  const maxVibe = votes.reduce(
    (acc, v) => Math.max(acc, v.q4_vibe),
    Number.NEGATIVE_INFINITY,
  );
  const hasVibeFloor = Number.isFinite(maxVibe);

  // Starting radius gate. When the caller supplies neither
  // radius_meters nor any candidate carries distance metadata, the
  // radius gate is off (TB-06 callers pre-filter the pool).
  const initialRadius = input.radius_meters ?? null;
  const radiusCap = input.radius_meters_cap ?? DEFAULT_RADIUS_CAP_METERS;

  const state: RelaxState = {
    droppedCuisines: new Set<string>(),
    vibeFloorRelaxStep: 0,
    radiusMeters: initialRadius,
  };
  const relaxChain: RelaxStep[] = [];

  // The cascade re-runs `runPruning` after each relax step. Bound the
  // total loop count: there are 3 cascade steps (cuisine, vibe,
  // radius) and the radius_widen step can fire many times before
  // hitting the cap. Bound the total iterations defensively.
  const MAX_CASCADE_ITERS = 64;

  let attempt: PruningResult | null = null;
  for (let iter = 0; iter < MAX_CASCADE_ITERS; iter++) {
    attempt = runPruning({
      candidates,
      votes,
      activeRequirements,
      minBudget,
      minWalk,
      maxVibe: hasVibeFloor ? maxVibe : null,
      state,
    });

    if (attempt.survivors.length > 0) break;

    // Survivors = 0 — try to relax in canonical order.
    const stepApplied = tryRelaxOneStep({
      state,
      candidates,
      cuisineCitations,
      hasVibeFloor,
      radiusCap,
    });
    if (stepApplied == null) {
      // Cascade exhausted — no_survivor terminal.
      return buildNoSurvivorOutput({
        votes,
        candidates,
        relaxChainApplied: relaxChain,
        radiusMetersUsed: state.radiusMeters,
        reasonHint: "cascade_exhausted",
      });
    }
    relaxChain.push(stepApplied);
  }

  if (!attempt || attempt.survivors.length === 0) {
    return buildNoSurvivorOutput({
      votes,
      candidates,
      relaxChainApplied: relaxChain,
      radiusMetersUsed: state.radiusMeters,
      reasonHint: "cascade_exhausted",
    });
  }

  const { survivors, cuts: pruneCuts } = attempt;

  // ── Tiebreaker ──────────────────────────────────────────────────
  const regretSums = survivors.map((c) => ({
    candidate: c,
    sum: sumRegret(c.id, votes),
  }));

  let winning: CandidateOption;
  let flatRegretFallback = false;
  let regretAppliedInRule = survivors.length > 1;

  if (survivors.length === 1) {
    winning = survivors[0];
  } else {
    const sums = regretSums.map((rs) => rs.sum);
    const variance = populationVariance(sums);

    if (variance <= flatThreshold) {
      flatRegretFallback = true;
      regretAppliedInRule = false;
      const idx = Math.floor(random() * survivors.length);
      const safeIdx = Math.min(Math.max(0, idx), survivors.length - 1);
      winning = survivors[safeIdx];
    } else {
      let best = regretSums[0];
      for (let i = 1; i < regretSums.length; i++) {
        if (regretSums[i].sum > best.sum) best = regretSums[i];
      }
      winning = best.candidate;
    }
  }

  // Cuts for non-winning survivors — feeds the S05 Cuts drawer.
  const cuts = [...pruneCuts];
  for (const c of survivors) {
    if (c.id === winning.id) continue;
    cuts.push({
      option_id: c.id,
      cut_reason: "no_regret",
      cut_text: flatRegretFallback ? "tied for regret" : "lower regret-of-omission",
    });
  }

  const ruleText = buildRuleText({
    winning,
    cuts,
    activeRequirements,
    regretAppliedInRule,
    candidates,
  });

  const receipts = buildReceipts(votes);

  return {
    winning_option_id: winning.id,
    method: input.method ?? "manual",
    rule_text: ruleText,
    cuts,
    receipts,
    flat_regret_fallback: flatRegretFallback,
    relax_chain_applied: relaxChain,
    surviving_hard_needs: buildSurvivingHardNeeds({
      activeRequirements,
      minBudget,
      minWalk,
    }),
    radius_meters_used: state.radiusMeters,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Pruning + cascade helpers
// ───────────────────────────────────────────────────────────────────────

interface PruningResult {
  survivors: CandidateOption[];
  cuts: OptionCut[];
}

interface RunPruningArgs {
  candidates: CandidateOption[];
  votes: MemberVote[];
  activeRequirements: readonly DietaryRequirement[];
  minBudget: number;
  minWalk: number;
  maxVibe: number | null;
  state: RelaxState;
}

/** Single pruning pass. Hard NEED vetoes (dietary, budget, walk) are
 *  applied unconditionally; soft signals (cuisine veto, vibe floor,
 *  radius) honour the relax state. */
function runPruning(args: RunPruningArgs): PruningResult {
  const { candidates, activeRequirements, minBudget, minWalk, maxVibe, state } = args;
  const cuts: OptionCut[] = [];
  const survivors: CandidateOption[] = [];

  for (const c of candidates) {
    // Q1 — dietary menu-compliance. Hard NEED, never relaxes.
    const missingReq = activeRequirements.find(
      (r) => !c.dietary_tags.includes(r.requiredTag),
    );
    if (missingReq) {
      cuts.push({
        option_id: c.id,
        cut_reason: "dietary",
        cut_text: cutTextForDietary(c, missingReq),
      });
      continue;
    }

    // Q2 — budget tier cap. Hard NEED, never relaxes.
    if (c.price_tier !== null && c.price_tier > minBudget) {
      cuts.push({
        option_id: c.id,
        cut_reason: "budget",
        cut_text: "over budget cap",
      });
      continue;
    }

    // Q3 — walk minutes. Hard NEED, never relaxes.
    if (c.walk_minutes_estimate !== null && c.walk_minutes_estimate > minWalk) {
      cuts.push({
        option_id: c.id,
        cut_reason: "walk",
        cut_text: "outside walk range",
      });
      continue;
    }

    // Soft — cuisine veto. The cascade can drop the most-cited
    // cuisine; once dropped it no longer prunes. We check every
    // active veto chip against the candidate's `categories` and cut
    // on first match (chips that have already been relaxed via
    // `state.droppedCuisines` are skipped).
    let cuisineCut = false;
    for (const chip of args.votes.flatMap((v) => v.soft_cuisine_vetoes ?? [])) {
      const normalised = chip.trim().toLowerCase();
      if (normalised.length === 0) continue;
      if (state.droppedCuisines.has(normalised)) continue;
      if (candidateMatchesCuisine(c, normalised)) {
        cuisineCut = true;
        break;
      }
    }
    if (cuisineCut) {
      cuts.push({
        option_id: c.id,
        cut_reason: "cuisine_veto",
        cut_text: "cuisine vetoed",
      });
      continue;
    }

    // Soft — vibe floor. The room's effective floor is `maxVibe -
    // state.vibeFloorRelaxStep`. When the candidate's vibe_signal is
    // below the effective floor, cut it. Candidates that omit a
    // vibe_signal pass-through (we treat absence as "fits").
    if (maxVibe !== null && c.vibe_signal != null) {
      const effectiveFloor = maxVibe - state.vibeFloorRelaxStep;
      if (c.vibe_signal < effectiveFloor) {
        cuts.push({
          option_id: c.id,
          cut_reason: "vibe_floor",
          cut_text: "below vibe floor",
        });
        continue;
      }
    }

    // Soft — radius. When the engine has a radius and the candidate
    // carries a distance, gate it. Candidates that omit distance pass
    // through.
    if (state.radiusMeters !== null && c.distance_meters != null) {
      if (c.distance_meters > state.radiusMeters) {
        cuts.push({
          option_id: c.id,
          cut_reason: "radius_widen",
          cut_text: "outside search radius",
        });
        continue;
      }
    }

    survivors.push(c);
  }

  return { survivors, cuts };
}

interface TryRelaxArgs {
  state: RelaxState;
  candidates: CandidateOption[];
  cuisineCitations: Map<string, number>;
  hasVibeFloor: boolean;
  radiusCap: number;
}

/** Apply the next available relax step, mutating `state`. Returns the
 *  step that fired, or `null` when the cascade is exhausted. The order
 *  is canonical per `RELAX_STEPS`. */
function tryRelaxOneStep(args: TryRelaxArgs): RelaxStep | null {
  const { state, cuisineCitations, hasVibeFloor, radiusCap } = args;

  // Step 1 — drop the next most-cited cuisine veto.
  const nextCuisine = pickMostCitedCuisine(cuisineCitations, state.droppedCuisines);
  if (nextCuisine !== null) {
    state.droppedCuisines.add(nextCuisine);
    return "cuisine_veto";
  }

  // Step 2 — relax the vibe floor. Each step widens the allowed gap
  // by 1; once the gap covers the full 0..4 scale, further relax is
  // pointless and we skip.
  if (hasVibeFloor && state.vibeFloorRelaxStep < 5) {
    state.vibeFloorRelaxStep += 1;
    return "vibe_floor";
  }

  // Step 3 — widen radius by 0.5 mi, up to the cap.
  if (state.radiusMeters !== null && state.radiusMeters < radiusCap) {
    state.radiusMeters = Math.min(
      state.radiusMeters + RADIUS_WIDEN_STEP_METERS,
      radiusCap,
    );
    return "radius_widen";
  }

  return null;
}

function pickMostCitedCuisine(
  citations: Map<string, number>,
  dropped: Set<string>,
): string | null {
  let best: { chip: string; count: number } | null = null;
  for (const [chip, count] of citations) {
    if (dropped.has(chip)) continue;
    if (best === null || count > best.count) {
      best = { chip, count };
    }
  }
  return best ? best.chip : null;
}

interface BuildNoSurvivorArgs {
  votes: MemberVote[];
  candidates: CandidateOption[];
  relaxChainApplied: RelaxStep[];
  radiusMetersUsed: number | null;
  reasonHint: "empty_pool" | "cascade_exhausted";
}

function buildNoSurvivorOutput(args: BuildNoSurvivorArgs): VerdictEngineOutput {
  const { votes, relaxChainApplied, radiusMetersUsed } = args;

  const minBudget = votes.length === 0 ? Number.POSITIVE_INFINITY : votes.reduce(
    (acc, v) => Math.min(acc, v.q2_budget),
    Number.POSITIVE_INFINITY,
  );
  const minWalk = votes.length === 0 ? Number.POSITIVE_INFINITY : votes.reduce(
    (acc, v) => Math.min(acc, v.q3_walk_minutes),
    Number.POSITIVE_INFINITY,
  );

  const activeRequirements: DietaryRequirement[] = [];
  for (const v of votes) {
    for (const chip of v.q1_vetoes) {
      const req = lookupRequirement(chip);
      if (req && !activeRequirements.find((r) => r.chip === req.chip)) {
        activeRequirements.push(req);
      }
    }
  }

  const survivingHardNeeds = buildSurvivingHardNeeds({
    activeRequirements,
    minBudget,
    minWalk,
  });

  return {
    winning_option_id: null,
    method: "no_survivor",
    rule_text: buildNoSurvivorRuleText({
      activeRequirements,
      survivingHardNeeds,
      radiusMetersUsed,
    }),
    cuts: [],
    receipts: buildReceipts(votes),
    flat_regret_fallback: false,
    relax_chain_applied: relaxChainApplied,
    surviving_hard_needs: survivingHardNeeds,
    radius_meters_used: radiusMetersUsed,
  };
}

interface BuildSurvivingHardNeedsArgs {
  activeRequirements: readonly DietaryRequirement[];
  minBudget: number;
  minWalk: number;
}

/** Short, human-readable, anonymized labels for each surviving
 *  hard-need constraint. Drives the S05 no-survivor meta line. */
function buildSurvivingHardNeeds(args: BuildSurvivingHardNeedsArgs): string[] {
  const { activeRequirements, minBudget, minWalk } = args;
  const labels: string[] = [];

  // Dietary requirements first — these are typically the most
  // load-bearing constraint in a no-survivor situation.
  for (const r of activeRequirements) {
    labels.push(r.label);
  }

  if (Number.isFinite(minBudget) && minBudget < 4) {
    labels.push(`${"$".repeat(Math.max(1, minBudget))} cap`);
  }

  if (Number.isFinite(minWalk) && minWalk < 30) {
    labels.push(`${minWalk} min walk`);
  }

  return labels;
}

function buildNoSurvivorRuleText(args: {
  activeRequirements: readonly DietaryRequirement[];
  survivingHardNeeds: readonly string[];
  radiusMetersUsed: number | null;
}): string {
  const { activeRequirements, survivingHardNeeds } = args;
  // Aggregate attribution — name the constraint(s), never the
  // member. The JSX fixture in `ScreenVerdict.jsx` reads:
  //   "Vegan options left no candidates within walking distance tonight."
  // We follow the same shape: subject = constraint label(s); verb =
  // "left no candidates"; location/time tail = "within walking distance
  // tonight." for vibe / radius cases.
  if (activeRequirements.length === 1) {
    const r = activeRequirements[0];
    return `${capitalize(r.label)} left no candidates within walking distance tonight.`;
  }
  if (activeRequirements.length > 1) {
    const labels = activeRequirements.map((r) => r.label);
    const last = labels.pop()!;
    const head = labels.join(", ");
    return `${capitalize(head)} and ${last} left no candidates within walking distance tonight.`;
  }
  if (survivingHardNeeds.length > 0) {
    // Budget / walk only — no dietary. Surface the cap honestly.
    return `No spot fits within ${
      survivingHardNeeds.join(" and ")
    } tonight.`;
  }
  // Empty pool / engine-misuse fallback.
  return "No spot fits the room tonight.";
}

// ───────────────────────────────────────────────────────────────────────
// Pure helpers
// ───────────────────────────────────────────────────────────────────────

function sumRegret(optionId: string, votes: MemberVote[]): number {
  let total = 0;
  for (const v of votes) {
    const score = v.q5_regret[optionId];
    if (typeof score === "number") total += score;
  }
  return total;
}

function populationVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0);
  return sq / values.length;
}

function cutTextForDietary(
  candidate: CandidateOption,
  req: DietaryRequirement,
): string {
  // All dietary chips are private per verdict-screen-spec §"Copy register"
  // — attribute attribution, never names a person. The verb-shape mirrors
  // the JSX fixture: "shellfish veto" / "vegan-only kitchen".
  return `${req.chip} veto`;
}

function buildRuleText(args: {
  winning: CandidateOption;
  cuts: OptionCut[];
  activeRequirements: readonly DietaryRequirement[];
  regretAppliedInRule: boolean;
  candidates: CandidateOption[];
}): string {
  const { winning, cuts, activeRequirements, regretAppliedInRule, candidates } = args;
  const parts: string[] = [];

  // Budget cuts — surface ONE representative cut option name in the
  // rule chip, like the JSX fixture: "Budget cap cut Ren Soba."
  const budgetCut = cuts.find((c) => c.cut_reason === "budget");
  if (budgetCut) {
    const cutCandidate = candidates.find((c) => c.id === budgetCut.option_id);
    if (cutCandidate) {
      parts.push(`Budget cap cut ${cutCandidate.name}.`);
    } else {
      parts.push("Budget cap cut a candidate.");
    }
  }

  // Walk cuts — same pattern, aggregate.
  const walkCut = cuts.find((c) => c.cut_reason === "walk");
  if (walkCut) {
    const cutCandidate = candidates.find((c) => c.id === walkCut.option_id);
    if (cutCandidate) {
      parts.push(`Walk-range cut ${cutCandidate.name}.`);
    } else {
      parts.push("Walk-range cut a candidate.");
    }
  }

  // Dietary cuts — attribute-level, never names a person. E.g.
  // "Shellfish-safe kitchens filter applied."
  if (activeRequirements.length > 0) {
    const req = activeRequirements[0];
    parts.push(`${capitalize(req.label)} filter applied.`);
  }

  // Tiebreaker statement when more than one survived.
  if (regretAppliedInRule) {
    parts.push(`${winning.name} had the lowest regret-of-omission.`);
  } else if (parts.length === 0) {
    // Single-survivor short-circuit with no cuts to attribute — name
    // the winner explicitly so the rule chip isn't empty.
    parts.push(`${winning.name} was the only candidate that fit every constraint.`);
  }

  return parts.join(" ");
}

function buildReceipts(votes: MemberVote[]): VoiceReceipt[] {
  return votes.map((v) => ({
    name: v.display_name.trim().toLowerCase(),
    action: receiptAction(v),
  }));
}

/** Produce the loudest one-phrase summary of this member's input. The
 *  priority order mirrors the JSX fixture in `ScreenVerdict.jsx`:
 *    1. Q4 vibe extremes (HUSHED / LOUD / ROWDY) read as a vibe signal.
 *    2. Q1 private veto chips become "filtered <chip>" (anonymized).
 *    3. Q2 budget cap below 4 becomes "capped at $TIER".
 *    4. Q3 walk floor below 30 becomes "capped at N min walk".
 *    5. Otherwise: "voted in".  */
function receiptAction(v: MemberVote): string {
  // Q4 vibe — the JSX fixture says "wanted lively" for LOUD-ish answers.
  if (v.q4_vibe >= 3) return "wanted lively";
  if (v.q4_vibe <= 0) return "wanted hushed";

  // Q1 — first chip, attribute-only.
  const firstVeto = v.q1_vetoes.find((chip) => lookupRequirement(chip));
  if (firstVeto) return `filtered ${firstVeto}`;

  // Q2 — budget cap when below the open tier.
  if (v.q2_budget < 4) {
    const dollar = "$".repeat(v.q2_budget);
    return `capped at ${dollar}`;
  }

  // Q3 — walk threshold when below the open ceiling.
  if (v.q3_walk_minutes < 30) {
    return `capped at ${v.q3_walk_minutes} min walk`;
  }

  return "voted in";
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
