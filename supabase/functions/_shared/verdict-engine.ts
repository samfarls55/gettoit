// VerdictEngine — clean-run path (TB-06).
//
// Pure functions. No network, no Supabase client. The Edge Function
// `compute-verdict/index.ts` composes this with the live database read
// of votes + options + members and the live write of verdicts +
// option_cuts.
//
// Scope of TB-06 — strict:
//   * EBA pruning on Q1 (dietary menu-compliance), Q2 (price-tier cap),
//     Q3 (walk-minutes threshold). Q4 vibe is captured for receipts but
//     not used as a hard cut in TB-06 (vibe floor is a soft signal that
//     relaxes in TB-09).
//   * Q5 regret-of-omission tiebreaker — sum across members; max wins.
//   * Flat-regret fallback — when variance of survivor sums is below a
//     flat-signal threshold, pick a survivor via injected random.
//   * Rule text generation in the "aggregate attribution, never a
//     person" register (PRD §"Mechanics — engine specifics" #6,
//     verdict-screen-spec §"Name the rule, not the picker").
//   * Cuts: every eliminated option emits an `option_cuts` row.
//
// Out of scope (TB-09):
//   * Soft-pref silent relax (cuisine veto → vibe floor → radius widen).
//   * `no_survivor` terminal.
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
}

export interface VerdictEngineInput {
  candidates: CandidateOption[];
  votes: MemberVote[];
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

export interface VerdictEngineOutput {
  /** `verdicts.option_id`. */
  winning_option_id: string;
  /** `verdicts.method`. TB-06 always emits `manual`. */
  method: "manual";
  /** `verdicts.rule_text` — the rule-chip copy. Aggregate attribution. */
  rule_text: string;
  /** `option_cuts` rows. */
  cuts: OptionCut[];
  /** Per-member receipt chips (UI surfaces these in S05 default). Not
   *  written to DB in TB-06 — they're rendered live from `votes`. */
  receipts: VoiceReceipt[];
  /** True when the regret signal across survivors was flat enough that
   *  the engine fell back to the random tiebreaker. Surfaced for tests
   *  and (optionally) for observability; not part of any user-visible
   *  copy in TB-06. */
  flat_regret_fallback: boolean;
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
// Tunables
// ───────────────────────────────────────────────────────────────────────

/** Default flat-regret variance threshold. Population variance ≤ this
 *  triggers the random-within-survivors fallback. With integer regret
 *  scores 1..5, "exactly tied" sums produce variance 0 and trip the
 *  fallback at threshold 0. Tests can lift this to model a wider band. */
const DEFAULT_FLAT_REGRET_VARIANCE_THRESHOLD = 0;

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
    throw new Error("computeVerdict: no candidates supplied — TB-09 handles the no-survivor terminal");
  }
  if (votes.length === 0) {
    throw new Error("computeVerdict: no votes supplied — engine requires at least one member's input");
  }

  // ── 1. EBA pruning chain ─────────────────────────────────────────
  // Each candidate is classified as either survivor or cut (with reason).
  // The order in which reasons get attributed matters for cut_text
  // legibility: dietary > budget > walk. A candidate that fails several
  // is reported under the first one encountered.

  const cuts: OptionCut[] = [];
  const survivors: CandidateOption[] = [];

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

  for (const c of candidates) {
    // Dietary first — if any active requirement isn't satisfied, this
    // candidate is cut with cut_reason='dietary'.
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

    // Budget next.
    if (c.price_tier !== null && c.price_tier > minBudget) {
      cuts.push({
        option_id: c.id,
        cut_reason: "budget",
        cut_text: "over budget cap",
      });
      continue;
    }

    // Walk last.
    if (c.walk_minutes_estimate !== null && c.walk_minutes_estimate > minWalk) {
      cuts.push({
        option_id: c.id,
        cut_reason: "walk",
        cut_text: "outside walk range",
      });
      continue;
    }

    survivors.push(c);
  }

  if (survivors.length === 0) {
    // TB-09 owns this terminal; for TB-06 we throw so callers detect
    // the scope-out-of-bounds case explicitly. The Edge Function in
    // TB-06 surfaces it as a 422; the iOS clean-run path never hits it
    // because the engine fixtures + production reads always have at
    // least one survivor.
    throw new Error("computeVerdict: no survivors — TB-09 handles the no-survivor terminal");
  }

  // ── 2. Tiebreaker ────────────────────────────────────────────────
  // Sum Q5 regret across members per survivor; pick the maximum.

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
    // Variance over the survivor sums tells us whether to apply the
    // tiebreaker or fall back to random. Use POPULATION variance so a
    // 2-survivor flat tie scores 0.
    const sums = regretSums.map((rs) => rs.sum);
    const variance = populationVariance(sums);

    if (variance <= flatThreshold) {
      flatRegretFallback = true;
      regretAppliedInRule = false;
      const idx = Math.floor(random() * survivors.length);
      // Clamp inclusively to handle random() === 1 corner-case.
      const safeIdx = Math.min(Math.max(0, idx), survivors.length - 1);
      winning = survivors[safeIdx];
    } else {
      // Max-sum wins; ties within max keep insertion order
      // (corresponds to the candidate array order — the iOS / Edge
      // caller is expected to pass candidates in a stable sort).
      let best = regretSums[0];
      for (let i = 1; i < regretSums.length; i++) {
        if (regretSums[i].sum > best.sum) best = regretSums[i];
      }
      winning = best.candidate;
    }
  }

  // ── 3. Cuts for non-winning survivors ────────────────────────────
  // Survivors that didn't win still need an `option_cuts` row so the
  // S05 Cuts drawer can render the full elimination chain.
  for (const c of survivors) {
    if (c.id === winning.id) continue;
    cuts.push({
      option_id: c.id,
      cut_reason: "no_regret",
      cut_text: flatRegretFallback
        ? "tied for regret"
        : "lower regret-of-omission",
    });
  }

  // ── 4. Rule text ─────────────────────────────────────────────────

  const ruleText = buildRuleText({
    winning,
    cuts,
    activeRequirements,
    regretAppliedInRule,
    candidates,
  });

  // ── 5. Receipts ──────────────────────────────────────────────────

  const receipts = buildReceipts(votes);

  return {
    winning_option_id: winning.id,
    method: "manual",
    rule_text: ruleText,
    cuts,
    receipts,
    flat_regret_fallback: flatRegretFallback,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
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
