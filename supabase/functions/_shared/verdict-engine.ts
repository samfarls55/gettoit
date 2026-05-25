// VerdictEngine — worst-off-protecting verdict pipeline (TB-11).
//
// Pure functions. No network, no Supabase client, no clock, no
// ambient randomness (the one source of randomness is injected via
// `VerdictEngineOptions.random` so the verdict is reproducible). The
// Edge Function `compute-verdict/index.ts` composes this with the live
// database read of votes + options + members and the live write of
// verdicts + option_cuts. Running server-side is load-bearing: the
// verdict must be byte-identical for every member.
//
// The TB-11 pipeline (PRD module B — "0.1.0-quiz-redesign-prd") replaces
// the TB-06 EBA-with-relax-cascade entirely:
//
//   1. EBA prune — drop venues failing ANY member's hard vetoes:
//      profile dietary / allergies / NEVERS, parameter geo / meal-time,
//      Q2 spend cap. Hard vetoes never relax.
//   2. Per-member scoring — each member's `prefFn` (built per
//      0.1.0-quiz-amendments §3 and cached by the running-union pool
//      manager, TB-10) scores every surviving venue 1..5.
//   3. Satisficing floor — keep only venues every member scores at or
//      above the acceptability threshold T (cohort-zero default 3).
//   4. Maximin tiebreak — among floor survivors pick the venue with the
//      highest MINIMUM member score. This protects the worst-off member
//      rather than averaging the group: a polarizing higher-sum pick
//      LOSES to a worst-off-protecting pick. This is the load-bearing
//      anti-defection mechanic (0.1.0-quiz-amendments §4, the Kim 2023
//      backfire avoidance).
//   5. Final tiebreak — equal minimums break on the higher group sum,
//      then on the injected random.
//   6. Empty-floor cascade — when no venue clears the floor the engine
//      relaxes T downward, then widens the search radius, then emits a
//      terminal `no_survivor` screen. Hard-veto cuts never recover.
//
// Why TypeScript rather than PL/pgSQL: the rule-text formatting is
// verbose to express in SQL and harder to fixture-test in CI without a
// live Postgres; the PRD leaves the implementation choice to the
// engineer and fixes only the interface as the contract.
//
// The engine consumes inputs through the schema-driven mapping layer
// (`votes-schema.ts`, TB-04) — it never reads quiz answers by hardcoded
// field name. `MemberVote` is the stable shape that mapping layer
// produces.

// ───────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────

/** A candidate venue for the room. The shape mirrors the slice of
 *  `options.payload` that the engine reads. */
export interface CandidateOption {
  /** Stable id used in score maps + `verdicts.option_id`. */
  id: string;
  /** Display name surfaced in `rule_text` + cut text. */
  name: string;
  /** Foursquare price tier 1..4 (`$` to `$$$$`). Null when unknown.
   *  The EBA prune cuts a candidate whose tier exceeds the MIN member
   *  Q2 spend cap; an unknown tier never prunes (benefit of the doubt). */
  price_tier: number | null;
  /** Dietary `emit_tag`s carried over from the PlacesProxy. The EBA
   *  prune matches each member's dietary veto against the corresponding
   *  required tag. */
  dietary_tags: string[];
  /** Display categories (Foursquare category strings — verbose, e.g.
   *  "Sushi Restaurant"). Used to match cuisine-NEVER hard vetoes and
   *  for diagnostic rule text. */
  categories: string[];
  /** Distance from the room's search centre, in meters. Used by the
   *  empty-floor cascade's radius-widen step. Optional — when the
   *  caller pre-filtered the pool to the radius it can be omitted and
   *  the radius gate is a no-op. */
  distance_meters?: number | null;
  /** Foursquare 0..10 venue rating. The engine never reads it — it is
   *  carried so the TB-23 server-side venue classifier can derive the
   *  reputation axis. Optional / null when the venue carries no rating. */
  rating?: number | null;
  /** Foursquare total-ratings count. Carried for the TB-23 venue
   *  classifier's pool-relative reputation terciles. The engine never
   *  reads it. Optional / null when the venue carries no count. */
  total_ratings?: number | null;
  /** Foursquare ISO-8601 record-creation date. Carried for the TB-23
   *  venue classifier's reputation age check. The engine never reads
   *  it. Optional / null when absent. */
  date_created?: string | null;
  /** Foursquare crowd-sourced `tastes` tag cloud. Carried for the
   *  TB-23 venue classifier's vibe nudge. The engine never reads it. */
  tastes?: string[];
}

/** A generic, schema-driven hard veto. TB-12 profile vetoes
 *  (allergies, dietary restrictions, cuisine NEVERS) feed this channel
 *  through the `votes-schema.ts` mapping layer, so the engine never
 *  hardcodes a profile-field name. The engine prunes a candidate when:
 *    * `kind === "dietary"` — the candidate's `dietary_tags` lacks the
 *      required tag for `token` (a dietary chip id).
 *    * `kind === "cuisine_never"` — any of the candidate's `categories`
 *      contains `token` (a cuisine substring, lowercase).
 *    * `kind === "tag"` — the candidate's `dietary_tags` does NOT carry
 *      `token` (a raw required tag — escape hatch for allergy tags the
 *      dietary chip map does not yet cover). */
export interface HardVeto {
  kind: "dietary" | "cuisine_never" | "tag";
  /** The veto token — a dietary chip id, a cuisine substring, or a raw
   *  required tag, per `kind`. */
  token: string;
}

/** A per-member preference function. Built per 0.1.0-quiz-amendments §3
 *  from the member's Q1..Q5 answers, cached by the running-union pool
 *  manager (TB-10), and injected here. Returns a 1..5 score on the same
 *  scale as the satisficing threshold T. */
export type PreferenceFn = (candidate: CandidateOption) => number;

/** A member's vote, as produced by the `votes-schema.ts` mapping layer.
 *  The engine reads scores either from an injected `prefFn` (the live
 *  path — the pool manager's cached function) or from a static
 *  per-candidate `scores` map (the test / replay path). */
export interface MemberVote {
  user_id: string;
  /** lowercase display name for receipts; never surfaced in rule_text. */
  display_name: string;
  /** Q1-era dietary veto chips (`vegan`, `halal`, …). Folded into the
   *  EBA prune as dietary hard vetoes. Kept as a distinct field for
   *  backward compatibility with the TB-04 mapping layer's
   *  `dietary_veto` kind. */
  q1_vetoes: string[];
  /** Q2 budget cap tier (1..4). The room's binding cap is the MIN
   *  across members. */
  q2_budget: number;
  /** Generic schema-driven hard vetoes — TB-12 profile allergies /
   *  dietary restrictions / cuisine NEVERS. Empty for a session with no
   *  profile data. */
  hard_vetoes: HardVeto[];
  /** Injected preference function — the live path. When present the
   *  engine scores every candidate through it. */
  prefFn?: PreferenceFn;
  /** Static per-candidate score map — the test / replay path. Read only
   *  when `prefFn` is absent. A candidate id missing from the map falls
   *  back to `scores.__fallback` if present, else the neutral T. */
  scores?: Record<string, number>;
}

/** How the verdict was triggered. The engine doesn't decide this — the
 *  caller (Edge Function entry point) classifies the fire path and
 *  passes it through. The engine overrides to `no_survivor` when the
 *  empty-floor cascade is exhausted. */
export type VerdictMethod = "manual" | "quorum" | "deadline" | "no_survivor";

/** Reroll reason taxonomy. The engine reads this to prefix `rule_text`
 *  with aggregate-rule attribution ("Cost reroll cut Pico's."). Never
 *  names the rerolling member. */
export type RerollReason = "cost" | "dist" | "mood" | "diet" | "avail";

export interface VerdictEngineInput {
  candidates: CandidateOption[];
  votes: MemberVote[];
  /** Optional caller-supplied method; defaults to `manual`. The
   *  auto-fire dispatcher passes `quorum` / `deadline`. The engine
   *  overrides to `no_survivor` when the cascade is exhausted. */
  method?: VerdictMethod;
  /** Acceptability threshold T — a venue must be scored at or above
   *  this by every member to clear the satisficing floor. Cohort-zero
   *  default 3 (a Q5 card rated 3 is the natural acceptability bar,
   *  0.1.0-quiz-amendments §4). Tunable post-cohort. */
  satisficing_threshold?: number;
  /** Initial room radius in meters. When supplied (with candidate
   *  `distance_meters`), the EBA prune gates on it and the empty-floor
   *  cascade may widen it. Omitting it (and `radius_meters_cap`) turns
   *  the radius gate off — the caller pre-filtered the pool. */
  radius_meters?: number;
  /** Upper bound for the radius-widen cascade step. Defaults to 8047 m
   *  (5.0 mi — the S01 slider ceiling). */
  radius_meters_cap?: number;
  /** Option ids to remove from the candidate pool BEFORE pruning.
   *  Populated by `avail`-reason rerolls. */
  excluded_option_ids?: string[];
  /** When set, prefixes `rule_text` with the aggregate-rule reroll
   *  attribution. The rerolling member is NEVER named. */
  reroll_reason?: RerollReason;
  /** Human name of the option the reroll replaced — sourced from the
   *  prior verdict. Falls back to "the prior pick" when omitted. */
  previous_winner_name?: string;
}

/** One eliminated option. Mirrors the `option_cuts` table shape. */
export interface OptionCut {
  option_id: string;
  /** Machine-readable reason. One of: budget, dietary, veto, radius,
   *  below_floor, lower_maximin. */
  cut_reason: string;
  /** Human-readable cut text for the S05 Cuts drawer. Aggregate
   *  attribution; anonymized for private constraints. */
  cut_text: string;
}

/** Receipt row surfaced on S05 — one per member. */
export interface VoiceReceipt {
  /** lowercase first name — verdict-screen-spec §"Copy register". */
  name: string;
  /** anonymized action verb-phrase. */
  action: string;
}

/** Canonical empty-floor cascade step labels, in the order the engine
 *  applies them. Kept on the module surface so iOS / web / QA share one
 *  vocabulary for the cascade. */
export const RELAX_STEPS = ["threshold", "radius_widen"] as const;
export type RelaxStep = typeof RELAX_STEPS[number];

export interface VerdictEngineOutput {
  /** `verdicts.option_id` — null for `no_survivor`. */
  winning_option_id: string | null;
  /** `verdicts.method`. The engine overrides to `no_survivor` when the
   *  cascade is exhausted, regardless of the caller-supplied method. */
  method: VerdictMethod;
  /** `verdicts.rule_text` — aggregate attribution, never a person. */
  rule_text: string;
  /** `option_cuts` rows. Empty when `method === "no_survivor"`. */
  cuts: OptionCut[];
  /** Per-member receipt chips, rendered live on S05 (not DB-persisted). */
  receipts: VoiceReceipt[];
  /** True when the final tiebreak fell through to the injected random
   *  (survivors tied on both minimum score and group sum). */
  flat_tiebreak_fallback: boolean;
  /** Empty-floor cascade steps applied, in fire order. Empty when the
   *  clean run seated a winner. */
  relax_chain_applied: RelaxStep[];
  /** Short, anonymized hard-need labels still active when the engine
   *  exits. Drives the S05 no-survivor meta line. */
  surviving_hard_needs: string[];
  /** Final radius the engine ran against, in meters. */
  radius_meters_used: number | null;
  /** The acceptability threshold T the winning venue cleared. Equals
   *  the supplied / default T for a clean run; lower when the
   *  empty-floor cascade relaxed it. Null for `no_survivor`. */
  threshold_used: number | null;
}

export interface VerdictEngineOptions {
  /** Override the source of randomness for deterministic tests. */
  random?: () => number;
}

// ───────────────────────────────────────────────────────────────────────
// Tunables — cohort-zero defaults (0.1.0-quiz-amendments §3 / §4)
// ───────────────────────────────────────────────────────────────────────

/** Acceptability threshold T. A Q5 card rated 3 is the natural
 *  acceptability bar. Tunable post-cohort. */
const DEFAULT_SATISFICING_THRESHOLD = 3;

/** Lower bound the empty-floor cascade relaxes T toward. 1 is the floor
 *  of the 1..5 score scale — relaxing past it is meaningless. */
const MIN_THRESHOLD = 1;

/** Step the cascade relaxes T by on each iteration. */
const THRESHOLD_RELAX_STEP = 1;

/** Default radius cap when the caller omits it (5.0 mi ≈ 8047 m). */
const DEFAULT_RADIUS_CAP_METERS = 8047;

/** Radius widen step — 0.5 mi ≈ 805 m. */
const RADIUS_WIDEN_STEP_METERS = 805;

/** Defensive bound on the cascade loop. */
const MAX_CASCADE_ITERS = 64;

// ───────────────────────────────────────────────────────────────────────
// Dietary chip → required tag mapping
// ───────────────────────────────────────────────────────────────────────
//
// Mirrors `DIETARY_CHIP_MAP.emit_tag` from `_shared/foursquare.ts`. Kept
// inline — the mapping is small and visibly local to the EBA logic.

interface DietaryRequirement {
  chip: string;
  requiredTag: string;
  label: string;
}

const DIETARY_REQUIREMENTS: readonly DietaryRequirement[] = Object.freeze([
  { chip: "vegan", requiredTag: "vegan_friendly", label: "vegan options" },
  { chip: "vegetarian", requiredTag: "vegetarian_friendly", label: "vegetarian options" },
  { chip: "halal", requiredTag: "halal", label: "halal options" },
  { chip: "kosher", requiredTag: "kosher", label: "kosher options" },
  { chip: "gluten", requiredTag: "gluten_free_options", label: "gluten-free options" },
  { chip: "dairy", requiredTag: "no_dairy_unverified", label: "dairy-safe options" },
  { chip: "shellfish", requiredTag: "no_shellfish_unverified", label: "shellfish-safe options" },
  { chip: "nuts", requiredTag: "no_nuts_unverified", label: "nut-safe options" },
]);

/** The "Nothing tonight" chip carries no constraint. Accepted
 *  defensively in several spellings so quiz-copy churn doesn't break
 *  the engine. */
const NO_OP_CHIPS: ReadonlySet<string> = new Set([
  "nothing_tonight",
  "nothing tonight",
  "nothing",
  "none",
  "no_preference",
]);

function lookupRequirement(chip: string): DietaryRequirement | undefined {
  const normalized = chip.trim().toLowerCase();
  if (NO_OP_CHIPS.has(normalized)) return undefined;
  return DIETARY_REQUIREMENTS.find((r) => r.chip === normalized);
}

// ───────────────────────────────────────────────────────────────────────
// Public surface
// ───────────────────────────────────────────────────────────────────────

export function computeVerdict(
  input: VerdictEngineInput,
  options: VerdictEngineOptions = {},
): VerdictEngineOutput {
  const random = options.random ?? Math.random;

  // `avail`-reason rerolls remove an option from the pool before
  // pruning — it never reaches the cuts surface (it was never a
  // candidate this run).
  const excludedSet = new Set(input.excluded_option_ids ?? []);
  const candidates = excludedSet.size === 0
    ? input.candidates
    : input.candidates.filter((c) => !excludedSet.has(c.id));
  const { votes } = input;

  if (votes.length === 0) {
    throw new Error(
      "computeVerdict: no votes supplied — engine requires at least one member's input",
    );
  }

  const initialThreshold = input.satisficing_threshold ?? DEFAULT_SATISFICING_THRESHOLD;
  const initialRadius = input.radius_meters ?? null;
  const radiusCap = input.radius_meters_cap ?? DEFAULT_RADIUS_CAP_METERS;

  // ── Step 1 — EBA prune ──────────────────────────────────────────────
  // Hard vetoes never relax. The EBA pass is run once; its survivors
  // feed every cascade iteration.
  const ebaResult = ebaPrune(candidates, votes);

  // ── Empty-pool / all-pruned short circuit ──────────────────────────
  if (ebaResult.survivors.length === 0) {
    return buildNoSurvivorOutput({
      votes,
      relaxChainApplied: [],
      radiusMetersUsed: initialRadius,
      thresholdUsed: null,
    });
  }

  // Score every EBA survivor for every member, once. Scoring is pure
  // and deterministic, so the cascade re-uses this matrix.
  const scored = scoreCandidates(ebaResult.survivors, votes);

  // ── Steps 3-6 — satisficing floor + maximin + cascade ──────────────
  let threshold = initialThreshold;
  let radius = initialRadius;
  const relaxChain: RelaxStep[] = [];

  for (let iter = 0; iter < MAX_CASCADE_ITERS; iter++) {
    // Radius gate — applied inside the cascade because the radius-widen
    // step mutates it. A candidate with no distance metadata always
    // passes (the caller pre-filtered).
    const inRadius = radius === null
      ? scored
      : scored.filter((s) =>
        s.candidate.distance_meters == null ||
        s.candidate.distance_meters <= radius!
      );

    // Satisficing floor — keep venues every member scores >= threshold.
    const floorSurvivors = inRadius.filter((s) => s.minScore >= threshold);

    if (floorSurvivors.length > 0) {
      return seatWinner({
        floorSurvivors,
        allScored: scored,
        ebaCuts: ebaResult.cuts,
        votes,
        method: input.method ?? "manual",
        threshold,
        radiusMetersUsed: radius,
        relaxChain,
        random,
        rerollReason: input.reroll_reason,
        previousWinnerName: input.previous_winner_name,
      });
    }

    // Empty floor — relax in canonical order: threshold first, radius
    // second.
    if (threshold > MIN_THRESHOLD) {
      threshold = Math.max(MIN_THRESHOLD, threshold - THRESHOLD_RELAX_STEP);
      relaxChain.push("threshold");
      continue;
    }
    if (radius !== null && radius < radiusCap) {
      radius = Math.min(radius + RADIUS_WIDEN_STEP_METERS, radiusCap);
      relaxChain.push("radius_widen");
      continue;
    }

    // Cascade exhausted — terminal no_survivor screen.
    break;
  }

  return buildNoSurvivorOutput({
    votes,
    relaxChainApplied: relaxChain,
    radiusMetersUsed: radius,
    thresholdUsed: null,
  });
}

// ───────────────────────────────────────────────────────────────────────
// Step 1 — EBA prune
// ───────────────────────────────────────────────────────────────────────

interface EbaResult {
  survivors: CandidateOption[];
  cuts: OptionCut[];
}

/** Drop venues failing ANY member's hard vetoes. Three veto channels,
 *  all hard (none relax): Q2 spend cap, Q1-era dietary chips, and the
 *  generic `hard_vetoes` channel (TB-12 profile allergies / dietary /
 *  cuisine NEVERS). */
function ebaPrune(
  candidates: CandidateOption[],
  votes: MemberVote[],
): EbaResult {
  // Q2 cap — the binding cap is the MIN tier among members.
  const minBudget = votes.reduce(
    (acc, v) => Math.min(acc, v.q2_budget),
    Number.POSITIVE_INFINITY,
  );

  // Aggregate the active dietary requirements (from Q1-era chips and
  // from `hard_vetoes` of kind `dietary`).
  const dietaryReqs: DietaryRequirement[] = [];
  const addReq = (chip: string) => {
    const req = lookupRequirement(chip);
    if (req && !dietaryReqs.find((r) => r.chip === req.chip)) {
      dietaryReqs.push(req);
    }
  };
  for (const v of votes) {
    for (const chip of v.q1_vetoes) addReq(chip);
    for (const hv of v.hard_vetoes) {
      if (hv.kind === "dietary") addReq(hv.token);
    }
  }

  // Raw required tags (`hard_vetoes` of kind `tag`) and cuisine NEVERS.
  const requiredTags = new Set<string>();
  const cuisineNevers = new Set<string>();
  for (const v of votes) {
    for (const hv of v.hard_vetoes) {
      if (hv.kind === "tag") requiredTags.add(hv.token.trim());
      if (hv.kind === "cuisine_never") {
        const t = hv.token.trim().toLowerCase();
        if (t.length > 0) cuisineNevers.add(t);
      }
    }
  }

  const survivors: CandidateOption[] = [];
  const cuts: OptionCut[] = [];

  for (const c of candidates) {
    // Q2 spend cap.
    if (c.price_tier !== null && c.price_tier > minBudget) {
      cuts.push({
        option_id: c.id,
        cut_reason: "budget",
        cut_text: "over the budget cap",
      });
      continue;
    }

    // Dietary menu-compliance.
    const missingReq = dietaryReqs.find((r) => !c.dietary_tags.includes(r.requiredTag));
    if (missingReq) {
      cuts.push({
        option_id: c.id,
        cut_reason: "dietary",
        cut_text: `${missingReq.chip} veto`,
      });
      continue;
    }

    // Raw required allergy tags.
    let missingTag: string | null = null;
    for (const tag of requiredTags) {
      if (!c.dietary_tags.includes(tag)) {
        missingTag = tag;
        break;
      }
    }
    if (missingTag !== null) {
      cuts.push({
        option_id: c.id,
        cut_reason: "veto",
        cut_text: "fails an allergy veto",
      });
      continue;
    }

    // Cuisine NEVERS — a candidate is pruned when any category contains
    // a vetoed cuisine substring.
    const lowerCategories = c.categories.map((cat) => cat.toLowerCase());
    let vetoedCuisine: string | null = null;
    for (const never of cuisineNevers) {
      if (lowerCategories.some((cat) => cat.includes(never))) {
        vetoedCuisine = never;
        break;
      }
    }
    if (vetoedCuisine !== null) {
      cuts.push({
        option_id: c.id,
        cut_reason: "veto",
        cut_text: "cuisine vetoed",
      });
      continue;
    }

    survivors.push(c);
  }

  return { survivors, cuts };
}

// ───────────────────────────────────────────────────────────────────────
// Step 2 — per-member scoring
// ───────────────────────────────────────────────────────────────────────

interface ScoredCandidate {
  candidate: CandidateOption;
  /** Member id → 1..5 score. */
  memberScores: Map<string, number>;
  /** Minimum member score — the maximin key. */
  minScore: number;
  /** Sum of member scores — the final-tiebreak key. */
  sumScore: number;
}

/** Score one candidate for one member, via the injected `prefFn` (live
 *  path) or the static `scores` map (test / replay path). */
function scoreFor(vote: MemberVote, candidate: CandidateOption): number {
  if (vote.prefFn) return vote.prefFn(candidate);
  const map = vote.scores ?? {};
  if (typeof map[candidate.id] === "number") return map[candidate.id];
  if (typeof map.__fallback === "number") return map.__fallback;
  // No signal at all — neutral at the cohort-zero threshold.
  return DEFAULT_SATISFICING_THRESHOLD;
}

function scoreCandidates(
  candidates: CandidateOption[],
  votes: MemberVote[],
): ScoredCandidate[] {
  return candidates.map((candidate) => {
    const memberScores = new Map<string, number>();
    let minScore = Number.POSITIVE_INFINITY;
    let sumScore = 0;
    for (const v of votes) {
      const s = scoreFor(v, candidate);
      memberScores.set(v.user_id, s);
      if (s < minScore) minScore = s;
      sumScore += s;
    }
    return { candidate, memberScores, minScore, sumScore };
  });
}

// ───────────────────────────────────────────────────────────────────────
// Steps 4-5 — maximin tiebreak + final tiebreak
// ───────────────────────────────────────────────────────────────────────

interface SeatWinnerArgs {
  floorSurvivors: ScoredCandidate[];
  allScored: ScoredCandidate[];
  /** Cuts emitted by the EBA prune — candidates dropped on a hard veto
   *  before scoring. Merged into the final cuts so the S05 Cuts drawer
   *  shows the full elimination picture. */
  ebaCuts: OptionCut[];
  votes: MemberVote[];
  method: VerdictMethod;
  threshold: number;
  radiusMetersUsed: number | null;
  relaxChain: RelaxStep[];
  random: () => number;
  rerollReason?: RerollReason;
  previousWinnerName?: string;
}

function seatWinner(args: SeatWinnerArgs): VerdictEngineOutput {
  const { floorSurvivors, votes, threshold } = args;

  // Step 4 — maximin: highest minimum member score.
  const bestMin = floorSurvivors.reduce(
    (acc, s) => Math.max(acc, s.minScore),
    Number.NEGATIVE_INFINITY,
  );
  const maximinTied = floorSurvivors.filter((s) => s.minScore === bestMin);

  let winner: ScoredCandidate;
  let flatTiebreak = false;

  if (maximinTied.length === 1) {
    winner = maximinTied[0];
  } else {
    // Step 5 — final tiebreak: highest group sum.
    const bestSum = maximinTied.reduce(
      (acc, s) => Math.max(acc, s.sumScore),
      Number.NEGATIVE_INFINITY,
    );
    const sumTied = maximinTied.filter((s) => s.sumScore === bestSum);
    if (sumTied.length === 1) {
      winner = sumTied[0];
    } else {
      // Fully tied — break on the injected random. Deterministic given
      // the survivor order and the injected source.
      flatTiebreak = true;
      const idx = Math.min(
        Math.max(0, Math.floor(args.random() * sumTied.length)),
        sumTied.length - 1,
      );
      winner = sumTied[idx];
    }
  }

  // Cuts — the full elimination picture for the S05 Cuts drawer:
  // first the EBA hard-veto cuts, then every scored survivor that did
  // not win (split into below-floor cuts and lower-maximin cuts).
  const cuts: OptionCut[] = [...args.ebaCuts];
  for (const s of args.allScored) {
    if (s.candidate.id === winner.candidate.id) continue;
    if (s.minScore < threshold) {
      cuts.push({
        option_id: s.candidate.id,
        cut_reason: "below_floor",
        cut_text: "below someone's acceptability floor",
      });
    } else {
      cuts.push({
        option_id: s.candidate.id,
        cut_reason: "lower_maximin",
        cut_text: "a worse worst-case for the group",
      });
    }
  }

  const ruleText = buildRuleText({
    winner: winner.candidate,
    floorSurvivorCount: floorSurvivors.length,
    relaxChain: args.relaxChain,
    rerollReason: args.rerollReason,
    previousWinnerName: args.previousWinnerName,
  });

  return {
    winning_option_id: winner.candidate.id,
    method: args.method,
    rule_text: ruleText,
    cuts,
    receipts: buildReceipts(votes),
    flat_tiebreak_fallback: flatTiebreak,
    relax_chain_applied: args.relaxChain,
    surviving_hard_needs: buildSurvivingHardNeeds(votes),
    radius_meters_used: args.radiusMetersUsed,
    threshold_used: threshold,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Step 6 — no-survivor terminal
// ───────────────────────────────────────────────────────────────────────

interface BuildNoSurvivorArgs {
  votes: MemberVote[];
  relaxChainApplied: RelaxStep[];
  radiusMetersUsed: number | null;
  thresholdUsed: number | null;
}

function buildNoSurvivorOutput(args: BuildNoSurvivorArgs): VerdictEngineOutput {
  const surviving = buildSurvivingHardNeeds(args.votes);
  return {
    winning_option_id: null,
    method: "no_survivor",
    rule_text: buildNoSurvivorRuleText(surviving),
    cuts: [],
    receipts: buildReceipts(args.votes),
    flat_tiebreak_fallback: false,
    relax_chain_applied: args.relaxChainApplied,
    surviving_hard_needs: surviving,
    radius_meters_used: args.radiusMetersUsed,
    threshold_used: args.thresholdUsed,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Rule text + receipts — aggregate attribution, never a person
// ───────────────────────────────────────────────────────────────────────

const REROLL_LABELS: Readonly<Record<RerollReason, string>> = Object.freeze({
  cost: "Cost",
  dist: "Distance",
  mood: "Mood",
  diet: "Diet",
  avail: "Availability",
});

function rerollPrefixSentence(
  reason: RerollReason,
  previousWinnerName?: string,
): string {
  const label = REROLL_LABELS[reason];
  const name = (previousWinnerName ?? "").trim();
  const target = name.length > 0 ? name : "the prior pick";
  return `${label} reroll cut ${target}.`;
}

function buildRuleText(args: {
  winner: CandidateOption;
  floorSurvivorCount: number;
  relaxChain: RelaxStep[];
  rerollReason?: RerollReason;
  previousWinnerName?: string;
}): string {
  const parts: string[] = [];

  if (args.rerollReason) {
    parts.push(rerollPrefixSentence(args.rerollReason, args.previousWinnerName));
  }

  // Maximin is the load-bearing mechanic — name the rule, not the
  // picker (verdict-screen-spec §"Name the rule, not the picker").
  if (args.floorSurvivorCount > 1) {
    parts.push(
      `${args.winner.name} was the safest pick for everyone — the best worst-case score.`,
    );
  } else {
    parts.push(
      `${args.winner.name} was the only spot the whole group was OK with.`,
    );
  }

  // Surface the cascade honestly when it fired — the relax is recorded
  // for observability even though it is silent on the surface.
  if (args.relaxChain.includes("radius_widen")) {
    parts.push("The search radius was widened to find it.");
  }

  return parts.join(" ");
}

function buildNoSurvivorRuleText(survivingHardNeeds: readonly string[]): string {
  if (survivingHardNeeds.length === 0) {
    return "No spot fit the room tonight.";
  }
  return `No spot fit within ${survivingHardNeeds.join(" and ")} tonight.`;
}

/** Short, anonymized hard-need labels — drives the S05 no-survivor meta
 *  line. Names the constraint, never the member. */
function buildSurvivingHardNeeds(votes: MemberVote[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  };

  for (const v of votes) {
    for (const chip of v.q1_vetoes) {
      const req = lookupRequirement(chip);
      if (req) push(req.label);
    }
    for (const hv of v.hard_vetoes) {
      if (hv.kind === "dietary") {
        const req = lookupRequirement(hv.token);
        if (req) push(req.label);
      }
    }
  }

  const minBudget = votes.reduce(
    (acc, v) => Math.min(acc, v.q2_budget),
    Number.POSITIVE_INFINITY,
  );
  if (Number.isFinite(minBudget) && minBudget < 4) {
    push(`${"$".repeat(Math.max(1, minBudget))} cap`);
  }

  return labels;
}

function buildReceipts(votes: MemberVote[]): VoiceReceipt[] {
  return votes.map((v) => ({
    name: v.display_name.trim().toLowerCase(),
    action: receiptAction(v),
  }));
}

/** One-phrase anonymized summary of a member's loudest input. */
function receiptAction(v: MemberVote): string {
  const firstVeto = v.q1_vetoes.find((chip) => lookupRequirement(chip));
  if (firstVeto) return `filtered ${firstVeto}`;
  if (v.hard_vetoes.length > 0) return "set a hard limit";
  if (v.q2_budget < 4) return `capped at ${"$".repeat(Math.max(1, v.q2_budget))}`;
  return "voted in";
}
