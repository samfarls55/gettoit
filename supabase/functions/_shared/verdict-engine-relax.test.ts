// VerdictEngine soft-pref relax cascade fixture tests (TB-09).
//
// Covers the empty-survivor fallback added to `computeVerdict` —
// when the EBA pruning chain leaves zero survivors AND any soft
// preferences are active, the engine relaxes them in canonical
// order:
//   1. most-cited cuisine veto first
//   2. vibe floor by 1 stop
//   3. radius widen by 0.5 mi (capped at 5 mi)
// and re-runs the pruning. Hard NEED vetoes (Q1 dietary as menu-
// compliance, Q2 budget cap, Q3 walk-minutes threshold) never relax.
//
// If after exhausting the cascade the survivor set is still empty
// the engine emits `method = 'no_survivor'` with `winning_option_id =
// null`, `rule_text` describing which hard-need vetoes survived
// (anonymized — never names a person), `cuts = []`, and
// `surviving_hard_needs` populated for the meta line.
//
// The cascade is canonical per v1-prd §"Mechanics — engine specifics"
// #2; the no_survivor exit per #3.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type CandidateOption,
  computeVerdict,
  type MemberVote,
  RELAX_STEPS,
  type RelaxStep,
} from "./verdict-engine.ts";

// ───────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<CandidateOption> = {}): CandidateOption {
  return {
    id: overrides.id ?? "opt-a",
    name: overrides.name ?? "Generic Spot",
    price_tier: overrides.price_tier ?? 2,
    walk_minutes_estimate: overrides.walk_minutes_estimate ?? 8,
    dietary_tags: overrides.dietary_tags ?? [],
    categories: overrides.categories ?? ["Restaurant"],
    vibe_signal: overrides.vibe_signal,
    distance_meters: overrides.distance_meters,
  };
}

function makeVote(overrides: Partial<MemberVote> = {}): MemberVote {
  return {
    user_id: overrides.user_id ?? "user-1",
    display_name: overrides.display_name ?? "alex",
    q1_vetoes: overrides.q1_vetoes ?? [],
    q2_budget: overrides.q2_budget ?? 4,
    q3_walk_minutes: overrides.q3_walk_minutes ?? 30,
    q4_vibe: overrides.q4_vibe ?? 2,
    q5_regret: overrides.q5_regret ?? {},
    soft_cuisine_vetoes: overrides.soft_cuisine_vetoes ?? [],
  };
}

// ───────────────────────────────────────────────────────────────────────
// Cascade order — cuisine veto, then vibe floor, then radius widen
// ───────────────────────────────────────────────────────────────────────

Deno.test("relax cascade emits a survivor when a cuisine veto is the only blocker", () => {
  // Two members cite "japanese" as a cuisine veto. Without the veto
  // the only survivor would be the soba spot; with the veto every
  // option is filtered. The cuisine veto is the FIRST step the
  // engine relaxes — drops it and finds a survivor.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "ren",
      name: "Ren Soba",
      categories: ["Japanese Restaurant"],
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      soft_cuisine_vetoes: ["japanese"],
      q5_regret: { ren: 4 },
    }),
    makeVote({
      user_id: "u2",
      soft_cuisine_vetoes: ["japanese"],
      q5_regret: { ren: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "ren");
  assertEquals(out.relax_chain_applied, ["cuisine_veto"],
    "the cuisine veto relax must have fired, and only the cuisine veto");
});

Deno.test("relax cascade lowers the vibe floor when cuisine relax doesn't help", () => {
  // The lone candidate has a `buzzy` vibe (=2). The member's vibe
  // floor is 3 (`loud`). Without relaxing the floor the candidate is
  // cut. There is no cuisine veto in play; the cascade must skip the
  // first step and land on `vibe_floor`, which lowers the floor by
  // exactly one stop and seats the candidate.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "buzzy",
      name: "Buzzy Bar",
      vibe_signal: 2,
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q4_vibe: 3, // LOUD
      q5_regret: { buzzy: 4 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "buzzy");
  assertEquals(out.relax_chain_applied, ["vibe_floor"],
    "one stop of vibe-floor relax seats a candidate one stop below the floor");
});

Deno.test("relax cascade widens radius after cuisine + vibe relax fail to seat a survivor", () => {
  // The candidate sits 1.0 mi from the centre (1609 m). The room's
  // radius is 805 m (0.5 mi) — so the candidate fails the radius
  // gate. Cuisine veto isn't active; the candidate's vibe matches
  // the floor. Only the radius widen step seats a survivor.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "far",
      name: "Far Halal Cart",
      vibe_signal: 2,
      distance_meters: 1609,
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q4_vibe: 2,
      q5_regret: { far: 5 },
    }),
  ];

  const out = computeVerdict(
    { candidates, votes, radius_meters: 805 },
  );
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "far");
  // The widen is in 0.5 mi (805 m) steps. 1.0 mi (1609 m) needs at
  // least one widen step from a 805 m start.
  assert(
    out.relax_chain_applied.includes("radius_widen"),
    `radius widen must be in the cascade trail: ${JSON.stringify(out.relax_chain_applied)}`,
  );
  // The cuisine veto + vibe floor are no-ops here — they shouldn't
  // appear in the chain.
  assertEquals(
    out.relax_chain_applied.filter((s) => s === "cuisine_veto").length, 0,
    "cuisine_veto must not appear when no cuisine vetoes are active",
  );
});

Deno.test("relax cascade applies steps in canonical order even when several would fire", () => {
  // The candidate fails all three soft constraints:
  //   * cuisine veto on "japanese"
  //   * vibe is `mellow` (1); member's floor is `loud` (3)
  //   * 1.5 mi (~2414 m) away; radius starts at 805 m (0.5 mi)
  // The cascade must apply the steps in canonical order until a
  // survivor emerges. With a generous radius cap (5 mi) and ample
  // widens available, the chain stops as soon as the candidate's
  // distance is within range.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "place",
      name: "Quiet Ramen Bar",
      categories: ["Japanese Restaurant"],
      vibe_signal: 1,
      distance_meters: 2414,
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      soft_cuisine_vetoes: ["japanese"],
      q4_vibe: 3,
      q5_regret: { place: 5 },
    }),
  ];

  const out = computeVerdict(
    { candidates, votes, radius_meters: 805 },
  );
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "place");
  // Order check: cuisine_veto must come first, vibe_floor second,
  // radius_widen last.
  const chain = out.relax_chain_applied;
  const cuisineIdx = chain.indexOf("cuisine_veto");
  const vibeIdx = chain.indexOf("vibe_floor");
  const radiusIdx = chain.indexOf("radius_widen");
  assert(cuisineIdx >= 0, "cuisine_veto must be applied first");
  assert(vibeIdx > cuisineIdx, "vibe_floor must come after cuisine_veto");
  assert(radiusIdx > vibeIdx, "radius_widen must come after vibe_floor");
});

Deno.test("relax cascade does not relax hard-need Q1 dietary vetoes", () => {
  // Two candidates: a steakhouse and a salad bar. The member is
  // vegan; only the salad bar is vegan-friendly. The steakhouse is
  // CHEAPER, so the only way it could win is by relaxing the
  // dietary requirement — which the engine MUST refuse to do.
  //
  // With no vegan-friendly candidate above the budget cap, the
  // engine should emit `no_survivor` rather than land on the
  // steakhouse.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "steakhouse",
      name: "Steakhouse",
      price_tier: 2,
      dietary_tags: [],
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q1_vetoes: ["vegan"],
      q2_budget: 4,
      q5_regret: { steakhouse: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "no_survivor",
    "vegan veto is a hard NEED — must NEVER be relaxed even when survivors = 0");
  assertEquals(out.winning_option_id, null);
  assert(
    out.surviving_hard_needs.includes("vegan options"),
    `surviving hard-needs must call out vegan options: ${JSON.stringify(out.surviving_hard_needs)}`,
  );
});

Deno.test("relax cascade does not relax Q2 budget cap", () => {
  // One candidate, price_tier 4. Member budget cap = 2. Soft signals
  // are all "open" — the only thing blocking is budget. The engine
  // must NOT relax budget (it's a hard-need cap), and must exit
  // no_survivor.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "splurge",
      name: "Splurge",
      price_tier: 4,
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q2_budget: 2,
      q5_regret: { splurge: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "no_survivor");
  assert(
    out.surviving_hard_needs.some((s) => s.toLowerCase().includes("budget")) ||
    out.surviving_hard_needs.some((s) => s.includes("$")),
    `surviving hard-needs must call out budget: ${JSON.stringify(out.surviving_hard_needs)}`,
  );
});

Deno.test("relax cascade does not relax Q3 walk threshold", () => {
  // The lone candidate is a 45-minute walk; the member's walk floor
  // is 15 minutes. The engine must not relax the walk floor (hard-
  // need) and must exit `no_survivor`.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "remote",
      name: "Far Diner",
      walk_minutes_estimate: 45,
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q3_walk_minutes: 15,
      q5_regret: { remote: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "no_survivor",
    "walk threshold is a hard NEED — must NEVER be relaxed even when survivors = 0");
});

// ───────────────────────────────────────────────────────────────────────
// Cuisine veto picks the most-cited cuisine first
// ───────────────────────────────────────────────────────────────────────

Deno.test("relax cuisine_veto step drops the most-cited cuisine first", () => {
  // Two cuisines cited: japanese (2x) and mexican (1x). Both
  // candidates would be cut under the full veto set. The cascade
  // drops the MOST-cited cuisine first; that's japanese, so the
  // japanese candidate survives. If the engine instead dropped the
  // least-cited cuisine first, the mexican candidate would survive.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba", categories: ["Japanese Restaurant"] }),
    makeCandidate({ id: "pico", name: "Pico's",   categories: ["Mexican Restaurant"]  }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      soft_cuisine_vetoes: ["japanese", "mexican"],
      q5_regret: { ren: 5, pico: 5 },
    }),
    makeVote({
      user_id: "u2",
      soft_cuisine_vetoes: ["japanese"],
      q5_regret: { ren: 5, pico: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "ren",
    "japanese is cited 2x, mexican 1x — japanese drops first, the japanese candidate survives");
  assertEquals(out.relax_chain_applied[0], "cuisine_veto");
});

// ───────────────────────────────────────────────────────────────────────
// no_survivor terminal output shape
// ───────────────────────────────────────────────────────────────────────

Deno.test("no_survivor output shape — null winner, empty cuts, anonymized rule_text", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "steakhouse",
      name: "Steakhouse",
      price_tier: 2,
      dietary_tags: [],
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      display_name: "alex",
      q1_vetoes: ["vegan"],
      q5_regret: { steakhouse: 5 },
    }),
    makeVote({
      user_id: "u2",
      display_name: "maya",
      q5_regret: { steakhouse: 4 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "no_survivor");
  assertEquals(out.winning_option_id, null);
  assertEquals(out.cuts.length, 0,
    "no_survivor mode suppresses the cuts drawer; no cuts rows should be emitted");
  // Anonymization — the rule_text NEVER names a person.
  assert(!out.rule_text.toLowerCase().includes("alex"),
    `rule_text must not name alex: ${out.rule_text}`);
  assert(!out.rule_text.toLowerCase().includes("maya"),
    `rule_text must not name maya: ${out.rule_text}`);
  // Aggregate / attribute attribution lives in the rule_text.
  assert(
    out.rule_text.toLowerCase().includes("vegan") ||
    out.rule_text.toLowerCase().includes("options"),
    `rule_text should surface the surviving hard-need: ${out.rule_text}`,
  );
});

Deno.test("no_survivor rule_text uses aggregate attribution for shared constraints", () => {
  // Vegan + budget cap both survive. The copy register requires
  // "Vegan options + budget cap left no candidates within walking
  // distance tonight." — aggregate attribution, never names members.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "splurge",
      name: "Splurge Steak",
      price_tier: 4,
      dietary_tags: [],
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", display_name: "alex",
      q1_vetoes: ["vegan"], q2_budget: 2, q5_regret: { splurge: 1 } }),
    makeVote({ user_id: "u2", display_name: "maya",
      q1_vetoes: [],      q2_budget: 2, q5_regret: { splurge: 1 } }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "no_survivor");
  assert(out.rule_text.toLowerCase().includes("no candidates") ||
    out.rule_text.toLowerCase().includes("left no") ||
    out.rule_text.toLowerCase().includes("no spot"),
    `rule_text should surface the failure honestly: ${out.rule_text}`);
});

// ───────────────────────────────────────────────────────────────────────
// Radius widen is bounded
// ───────────────────────────────────────────────────────────────────────

Deno.test("relax radius_widen step is bounded by the radius cap", () => {
  // The candidate sits well beyond the radius cap. Widen cannot
  // reach it; the engine bails to no_survivor rather than spinning.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "wayout",
      name: "Way Out Diner",
      distance_meters: 20000, // 12.4 mi, well over cap
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { wayout: 5 } }),
  ];

  const out = computeVerdict(
    { candidates, votes, radius_meters: 805, radius_meters_cap: 8047 },
  );
  assertEquals(out.method, "no_survivor",
    "candidate outside the 5 mi cap — engine must bail rather than widen past the cap");
});

Deno.test("relax radius_widen honors a wider cap when the caller supplies one", () => {
  // Same candidate, but the caller supplies a 10 mi cap (the S05
  // widen-radius CTA can push to 10 mi). The candidate at 12.4 mi
  // is still beyond, but at 8 mi (12874 m) we'd seat it.
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "stretch",
      name: "Stretch Spot",
      distance_meters: 12874, // exactly 8.0 mi
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { stretch: 5 } }),
  ];

  const out = computeVerdict(
    { candidates, votes, radius_meters: 805, radius_meters_cap: 16093 },
  );
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "stretch",
    "with a 10 mi cap, the widen ladder eventually seats the 8 mi candidate");
});

// ───────────────────────────────────────────────────────────────────────
// Cascade only fires when survivors = 0
// ───────────────────────────────────────────────────────────────────────

Deno.test("relax cascade is silent — does not fire when survivors > 0", () => {
  // A clean-run room with two survivors. The cascade must not fire
  // even though a cuisine veto is active (it would knock out one of
  // the survivors), because the engine already has a verdict.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico", name: "Pico's",   categories: ["Mexican Restaurant"] }),
    makeCandidate({ id: "ren",  name: "Ren Soba", categories: ["Japanese Restaurant"] }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", soft_cuisine_vetoes: ["japanese"], q5_regret: { pico: 5, ren: 5 } }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.relax_chain_applied.length, 0,
    "cascade must stay silent when EBA pruning seats survivors on its own");
});

// ───────────────────────────────────────────────────────────────────────
// RELAX_STEPS is the canonical sequence
// ───────────────────────────────────────────────────────────────────────

Deno.test("RELAX_STEPS exposes the canonical relax order", () => {
  // The public ordering exists so the iOS / web surfaces can
  // describe the cascade to product/QA without inventing their own
  // order. Kept on the engine module so tests and surfaces share
  // one source of truth.
  assertEquals(RELAX_STEPS, ["cuisine_veto", "vibe_floor", "radius_widen"] as readonly RelaxStep[]);
});
