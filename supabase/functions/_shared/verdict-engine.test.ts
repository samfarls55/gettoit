// VerdictEngine fixture tests (TB-11 — worst-off-protecting rewrite).
//
// Pure-logic tests against the engine's public interface. No Supabase
// round-trip, no Edge runtime — just `(VerdictEngineInput) → VerdictEngineOutput`.
//
// The TB-11 pipeline replaces the TB-06 EBA-with-relax-cascade with:
//   1. EBA prune       — drop venues failing ANY member's hard vetoes
//                        (profile dietary / allergies / NEVERS, parameter
//                        geo / meal-time, Q2 spend cap).
//   2. Per-member score — each member's injected `prefFn` scores 1..5.
//   3. Satisficing floor — keep venues every member scores >= T.
//   4. Maximin tiebreak  — highest minimum member score wins; a
//                          polarizing higher-sum pick LOSES to a
//                          worst-off-protecting pick.
//   5. Final tiebreak    — highest sum, then injected random.
//   6. Empty-floor cascade — relax T inside the locked Search area, then a
//                          terminal `no_survivor` screen.
//
// A good test asserts external behavior through the public interface,
// never internals — feed defined inputs, assert the observable output.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type CandidateOption,
  computeVerdict,
  type MemberVote,
  type VerdictEngineInput,
} from "./verdict-engine.ts";

// ───────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<CandidateOption> = {}): CandidateOption {
  return {
    id: overrides.id ?? "opt-a",
    name: overrides.name ?? "Generic Spot",
    price_tier: overrides.price_tier ?? 2,
    dietary_tags: overrides.dietary_tags ?? [],
    categories: overrides.categories ?? ["Restaurant"],
    distance_meters: overrides.distance_meters,
    current_open_now: overrides.current_open_now,
    regular_opening_periods: overrides.regular_opening_periods,
    dine_in: overrides.dine_in,
    takeout: overrides.takeout,
  };
}

function makeVote(overrides: Partial<MemberVote> = {}): MemberVote {
  return {
    user_id: overrides.user_id ?? "user-1",
    display_name: overrides.display_name ?? "alex",
    q1_vetoes: overrides.q1_vetoes ?? [],
    q2_budget: overrides.q2_budget ?? 4,
    hard_vetoes: overrides.hard_vetoes ?? [],
    scores: overrides.scores ?? {},
    prefFn: overrides.prefFn,
  };
}

/** Build a member whose `prefFn` reads a fixed per-candidate score map.
 *  Any candidate not in the map scores `fallback` (default 3 = exactly
 *  at the cohort-zero threshold T). */
function scoredVote(
  user_id: string,
  scores: Record<string, number>,
  fallback = 3,
  overrides: Partial<MemberVote> = {},
): MemberVote {
  return makeVote({
    user_id,
    display_name: overrides.display_name ?? user_id,
    q1_vetoes: overrides.q1_vetoes,
    q2_budget: overrides.q2_budget,
    hard_vetoes: overrides.hard_vetoes,
    scores: { __fallback: fallback, ...scores },
  });
}

function run(input: VerdictEngineInput, opts = {}) {
  return computeVerdict(input, opts);
}

// ───────────────────────────────────────────────────────────────────────
// 1. EBA prune — hard vetoes
// ───────────────────────────────────────────────────────────────────────

Deno.test("EBA prune — Q2 spend cap drops candidates over the MIN member cap", () => {
  const cheap = makeCandidate({ id: "cheap", name: "Cheap Eats", price_tier: 1 });
  const pricey = makeCandidate({ id: "pricey", name: "Pricey Place", price_tier: 4 });
  const out = run({
    candidates: [cheap, pricey],
    votes: [
      scoredVote("u1", { cheap: 5, pricey: 5 }, 5, { q2_budget: 2 }),
      scoredVote("u2", { cheap: 5, pricey: 5 }, 5, { q2_budget: 3 }),
    ],
  });
  // pricey (tier 4) exceeds the MIN member cap (2) — it is EBA-pruned.
  assertEquals(out.winning_option_id, "cheap");
  assert(
    out.cuts.some((c) => c.option_id === "pricey" && c.cut_reason === "budget"),
    "pricey should be cut for budget",
  );
});

Deno.test("EBA prune — meal timing and service mode are room-level hard eligibility", () => {
  const currentOpenDineIn = makeCandidate({
    id: "current-open-dine-in",
    name: "Open Dine-In",
    current_open_now: true,
    dine_in: true,
  });
  const currentClosed = makeCandidate({
    id: "current-closed",
    name: "Closed Now",
    current_open_now: false,
    dine_in: true,
  });
  const currentMissingHours = makeCandidate({
    id: "current-missing-hours",
    name: "Missing Hours",
    dine_in: true,
  });
  const noDineIn = makeCandidate({
    id: "no-dine-in",
    name: "No Dine-In",
    current_open_now: true,
    dine_in: false,
  });

  const currentOut = run({
    candidates: [currentOpenDineIn, currentClosed, currentMissingHours, noDineIn],
    votes: [scoredVote("u1", {}, 5)],
    service_shape: "dineIn",
  });

  assertEquals(currentOut.winning_option_id, "current-open-dine-in");
  assert(
    currentOut.cuts.some((c) => c.option_id === "current-closed" && c.cut_reason === "availability"),
  );
  assert(
    currentOut.cuts.some((c) =>
      c.option_id === "current-missing-hours" && c.cut_reason === "availability"
    ),
  );
  assert(
    currentOut.cuts.some((c) => c.option_id === "no-dine-in" && c.cut_reason === "availability"),
  );

  const futureOpenUnknownTakeout = makeCandidate({
    id: "future-open-unknown-takeout",
    name: "Future Open",
    regular_opening_periods: [
      {
        open: { day: 3, hour: 18, minute: 0 },
        close: { day: 3, hour: 22, minute: 0 },
      },
    ],
  });
  const explicitNoTakeout = makeCandidate({
    id: "explicit-no-takeout",
    name: "No Takeout",
    takeout: false,
    regular_opening_periods: [
      {
        open: { day: 3, hour: 18, minute: 0 },
        close: { day: 3, hour: 22, minute: 0 },
      },
    ],
  });

  const futureOut = run({
    candidates: [futureOpenUnknownTakeout, explicitNoTakeout],
    votes: [scoredVote("u1", {}, 5)],
    meal_timing: { open_at: "3T1900" },
    service_shape: "takeout",
  });

  assertEquals(futureOut.winning_option_id, "future-open-unknown-takeout");
  assert(
    futureOut.cuts.some((c) => c.option_id === "explicit-no-takeout" && c.cut_reason === "availability"),
  );
});

Deno.test("EBA prune — a profile/dietary hard veto drops the violating venue", () => {
  const veganOk = makeCandidate({
    id: "vegan-ok",
    name: "Green Bowl",
    dietary_tags: ["vegan_friendly"],
  });
  const noVegan = makeCandidate({ id: "no-vegan", name: "Steakhouse" });
  const out = run({
    candidates: [veganOk, noVegan],
    votes: [
      scoredVote("u1", { "vegan-ok": 5, "no-vegan": 5 }, 5, {
        q1_vetoes: ["vegan"],
      }),
    ],
  });
  assertEquals(out.winning_option_id, "vegan-ok");
  assert(
    out.cuts.some((c) => c.option_id === "no-vegan" && c.cut_reason === "dietary"),
  );
});

Deno.test("EBA prune — a generic hard_veto entry drops a candidate by tag", () => {
  // `hard_vetoes` is the schema-driven generic veto channel: TB-12
  // profile allergies / NEVERS feed it. A candidate is pruned when it
  // carries (or, for a cuisine NEVER, matches a category of) a vetoed
  // tag.
  const safe = makeCandidate({ id: "safe", name: "Safe Spot", categories: ["Taco Stand"] });
  const sushi = makeCandidate({
    id: "sushi",
    name: "Sushi Bar",
    categories: ["Sushi Restaurant"],
  });
  const out = run({
    candidates: [safe, sushi],
    votes: [
      scoredVote("u1", { safe: 5, sushi: 5 }, 5, {
        hard_vetoes: [{ kind: "cuisine_never", token: "sushi" }],
      }),
    ],
  });
  assertEquals(out.winning_option_id, "safe");
  assert(out.cuts.some((c) => c.option_id === "sushi" && c.cut_reason === "veto"));
});

Deno.test("EBA prune — TB-12: a profile dietary hard_veto drops a non-compliant venue", () => {
  // A member's sticky profile carries a `dietary` hard veto. The EBA
  // prune drops a venue whose `dietary_tags` lack the chip's required
  // tag — identical treatment to a Q1-era dietary chip, but sourced
  // from the per-account profile rather than the session quiz.
  const veganOk = makeCandidate({
    id: "vegan-ok",
    name: "Green Plate",
    dietary_tags: ["vegan_friendly"],
  });
  const noVegan = makeCandidate({ id: "no-vegan", name: "Steakhouse", dietary_tags: [] });
  const out = run({
    candidates: [veganOk, noVegan],
    votes: [
      scoredVote("u1", { "vegan-ok": 5, "no-vegan": 5 }, 5, {
        hard_vetoes: [{ kind: "dietary", token: "vegan" }],
      }),
    ],
  });
  assertEquals(out.winning_option_id, "vegan-ok");
  assert(
    out.cuts.some((c) => c.option_id === "no-vegan" && c.cut_reason === "dietary"),
  );
});

Deno.test("EBA prune — TB-12: a profile allergy `tag` hard_veto drops a venue missing the tag", () => {
  // The `tag` kind is the allergy escape hatch — the token is a raw
  // required dietary tag. A venue that does not carry it is pruned.
  const peanutSafe = makeCandidate({
    id: "peanut-safe",
    name: "Safe Kitchen",
    dietary_tags: ["no_peanut_unverified"],
  });
  const unknown = makeCandidate({ id: "unknown", name: "Mystery Diner", dietary_tags: [] });
  const out = run({
    candidates: [peanutSafe, unknown],
    votes: [
      scoredVote("u1", { "peanut-safe": 5, "unknown": 5 }, 5, {
        hard_vetoes: [{ kind: "tag", token: "no_peanut_unverified" }],
      }),
    ],
  });
  assertEquals(out.winning_option_id, "peanut-safe");
  assert(out.cuts.some((c) => c.option_id === "unknown" && c.cut_reason === "veto"));
});

Deno.test("EBA prune — TB-12: one member's profile veto prunes for the whole room", () => {
  // Hard vetoes are room-wide: a venue failing ANY member's profile
  // veto is dropped for everyone, even members who scored it 5.
  const taco = makeCandidate({ id: "taco", name: "Taqueria", categories: ["Taco Stand"] });
  const sushi = makeCandidate({ id: "sushi", name: "Omakase", categories: ["Sushi Restaurant"] });
  const out = run({
    candidates: [taco, sushi],
    votes: [
      // u1 has the profile veto.
      scoredVote("u1", { taco: 4, sushi: 5 }, 4, {
        hard_vetoes: [{ kind: "cuisine_never", token: "sushi" }],
      }),
      // u2 has no veto and would happily take sushi.
      scoredVote("u2", { taco: 4, sushi: 5 }, 4),
    ],
  });
  assertEquals(out.winning_option_id, "taco");
  assert(out.cuts.some((c) => c.option_id === "sushi" && c.cut_reason === "veto"));
});

// ───────────────────────────────────────────────────────────────────────
// 2 + 3. Per-member scoring + satisficing floor
// ───────────────────────────────────────────────────────────────────────

Deno.test("satisficing floor — keeps only venues every member scores >= T", () => {
  // venue-a: both members score it >= 3. venue-b: member u2 scores it
  // 2 (below T=3) — venue-b never clears the floor.
  const a = makeCandidate({ id: "venue-a", name: "Venue A" });
  const b = makeCandidate({ id: "venue-b", name: "Venue B" });
  const out = run({
    candidates: [a, b],
    votes: [
      scoredVote("u1", { "venue-a": 4, "venue-b": 5 }),
      scoredVote("u2", { "venue-a": 4, "venue-b": 2 }),
    ],
  });
  assertEquals(out.winning_option_id, "venue-a");
});

Deno.test("satisficing floor — T is inclusive (a member exactly at T passes)", () => {
  const a = makeCandidate({ id: "venue-a", name: "Venue A" });
  const out = run({
    candidates: [a],
    votes: [
      scoredVote("u1", { "venue-a": 3 }),
      scoredVote("u2", { "venue-a": 5 }),
    ],
  });
  assertEquals(out.winning_option_id, "venue-a");
});

// ───────────────────────────────────────────────────────────────────────
// 4. Maximin tiebreak — the load-bearing acceptance criterion
// ───────────────────────────────────────────────────────────────────────

Deno.test("maximin — a worst-off-protecting pick beats a polarizing higher-sum pick", () => {
  // polarizing: scores 5 + 5 + 3  → sum 13, min 3.
  // balanced:   scores 4 + 4 + 4  → sum 12, min 4.
  // A pure-sum engine picks `polarizing`. The maximin engine picks
  // `balanced` — it protects the worst-off member (min 4 > min 3).
  const polarizing = makeCandidate({ id: "polarizing", name: "Polarizing Pick" });
  const balanced = makeCandidate({ id: "balanced", name: "Balanced Pick" });
  const out = run({
    candidates: [polarizing, balanced],
    votes: [
      scoredVote("u1", { polarizing: 5, balanced: 4 }),
      scoredVote("u2", { polarizing: 5, balanced: 4 }),
      scoredVote("u3", { polarizing: 3, balanced: 4 }),
    ],
  });
  assertEquals(out.winning_option_id, "balanced");
});

Deno.test("maximin — among floor survivors the highest minimum score wins", () => {
  // Three survivors, all clear T=3 for both members. Maximin minimums:
  //   low   → min(3, 4) = 3
  //   mid   → min(4, 4) = 4
  //   high  → min(5, 3) = 3
  // `mid` wins on the highest minimum.
  const low = makeCandidate({ id: "low", name: "Low" });
  const mid = makeCandidate({ id: "mid", name: "Mid" });
  const high = makeCandidate({ id: "high", name: "High" });
  const out = run({
    candidates: [low, mid, high],
    votes: [
      scoredVote("u1", { low: 3, mid: 4, high: 5 }),
      scoredVote("u2", { low: 4, mid: 4, high: 3 }),
    ],
  });
  assertEquals(out.winning_option_id, "mid");
});

// ───────────────────────────────────────────────────────────────────────
// 5. Final tiebreak — highest sum, then random
// ───────────────────────────────────────────────────────────────────────

Deno.test("final tiebreak — equal minimums break on the higher sum", () => {
  // both survivors have min 3, but `bigsum` totals more.
  const bigsum = makeCandidate({ id: "bigsum", name: "Big Sum" });
  const small = makeCandidate({ id: "small", name: "Small Sum" });
  const out = run({
    candidates: [bigsum, small],
    votes: [
      scoredVote("u1", { bigsum: 5, small: 3 }),
      scoredVote("u2", { bigsum: 3, small: 3 }),
    ],
  });
  // both: min 3. sums: bigsum 8, small 6 → bigsum wins.
  assertEquals(out.winning_option_id, "bigsum");
});

Deno.test("final tiebreak — fully-tied survivors break on the injected random", () => {
  // two survivors identical on both min and sum → random decides.
  const a = makeCandidate({ id: "a", name: "A" });
  const b = makeCandidate({ id: "b", name: "B" });
  const input: VerdictEngineInput = {
    candidates: [a, b],
    votes: [
      scoredVote("u1", { a: 4, b: 4 }),
      scoredVote("u2", { a: 4, b: 4 }),
    ],
  };
  const first = run(input, { random: () => 0.0 });
  const second = run(input, { random: () => 0.99 });
  assertEquals(first.winning_option_id, "a");
  assertEquals(second.winning_option_id, "b");
  assert(first.flat_tiebreak_fallback);
});

// ───────────────────────────────────────────────────────────────────────
// 6. Empty-floor cascade
// ───────────────────────────────────────────────────────────────────────

Deno.test("empty-floor cascade — relaxes T when no venue clears the floor", () => {
  // At T=3 nothing clears: every member scores the venue 2. The
  // cascade relaxes T downward until the venue clears.
  const only = makeCandidate({ id: "only", name: "Only Spot" });
  const out = run({
    candidates: [only],
    votes: [
      scoredVote("u1", { only: 2 }),
      scoredVote("u2", { only: 2 }),
    ],
  });
  assertEquals(out.winning_option_id, "only");
  assert(
    out.relax_chain_applied.includes("threshold"),
    "the threshold-relax step should have fired",
  );
});

Deno.test("Search area eligibility — outside candidates are cut before scoring", () => {
  // The committed Search area is a hard boundary. A loved candidate
  // outside the circle cannot recover through threshold relaxation.
  const inside = makeCandidate({
    id: "inside",
    name: "Inside But Pricey",
    price_tier: 4,
    distance_meters: 500,
  });
  const outside = makeCandidate({
    id: "outside",
    name: "Outside Gem",
    price_tier: 1,
    distance_meters: 6000,
  });
  const out = run({
    candidates: [inside, outside],
    votes: [
      scoredVote("u1", { inside: 5, outside: 5 }, 5, { q2_budget: 1 }),
      scoredVote("u2", { inside: 5, outside: 5 }, 5, { q2_budget: 1 }),
    ],
    radius_meters: 3219,
    radius_meters_cap: 8047,
  });
  assertEquals(out.winning_option_id, null);
  assertEquals(out.method, "no_survivor");
  assertEquals(out.relax_chain_applied, []);
});

Deno.test("Search area eligibility — distance inside the circle is not a tiebreaker", () => {
  const near = makeCandidate({ id: "near", name: "Near", distance_meters: 100 });
  const far = makeCandidate({ id: "far", name: "Far", distance_meters: 3000 });
  const out = run({
    candidates: [near, far],
    votes: [
      scoredVote("u1", { near: 4, far: 4 }),
      scoredVote("u2", { near: 4, far: 4 }),
    ],
    radius_meters: 3219,
  }, { random: () => 0.99 });
  assertEquals(out.winning_option_id, "far");
  assertEquals(out.rule_text.toLowerCase().includes("distance"), false);
  assertEquals(out.cuts.some((cut) => cut.cut_text.toLowerCase().includes("distance")), false);
});

Deno.test("empty-floor cascade — exhausted cascade yields a no_survivor terminal", () => {
  // A single candidate every member hard-vetoes. No relax step can
  // recover a hard-veto cut → terminal no-spot screen.
  const only = makeCandidate({ id: "only", name: "Only Spot", price_tier: 4 });
  const out = run({
    candidates: [only],
    votes: [
      scoredVote("u1", { only: 5 }, 5, { q2_budget: 1 }),
      scoredVote("u2", { only: 5 }, 5, { q2_budget: 1 }),
    ],
  });
  assertEquals(out.winning_option_id, null);
  assertEquals(out.method, "no_survivor");
  assert(out.rule_text.length > 0);
  assertEquals(out.cuts.length, 0);
});

// ───────────────────────────────────────────────────────────────────────
// Determinism / server-side identical-verdict guarantee
// ───────────────────────────────────────────────────────────────────────

Deno.test("the verdict is identical across repeated runs (deterministic, server-side)", () => {
  const a = makeCandidate({ id: "a", name: "A" });
  const b = makeCandidate({ id: "b", name: "B" });
  const c = makeCandidate({ id: "c", name: "C" });
  const input: VerdictEngineInput = {
    candidates: [a, b, c],
    votes: [
      scoredVote("u1", { a: 5, b: 4, c: 3 }),
      scoredVote("u2", { a: 3, b: 4, c: 5 }),
      scoredVote("u3", { a: 4, b: 4, c: 4 }),
    ],
  };
  const first = run(input);
  const second = run(input);
  const third = run(input);
  assertEquals(first.winning_option_id, second.winning_option_id);
  assertEquals(second.winning_option_id, third.winning_option_id);
  // b has the highest minimum (4 across all three members).
  assertEquals(first.winning_option_id, "b");
});

Deno.test("rule_text uses aggregate attribution and never names a member", () => {
  const a = makeCandidate({ id: "a", name: "Pico's" });
  const b = makeCandidate({ id: "b", name: "Ren Soba", price_tier: 4 });
  const out = run({
    candidates: [a, b],
    votes: [
      scoredVote("u1", { a: 4, b: 4 }, 4, { display_name: "samuel", q2_budget: 2 }),
      scoredVote("u2", { a: 4, b: 4 }, 4, { display_name: "alex" }),
    ],
  });
  assertEquals(out.winning_option_id, "a");
  assert(!out.rule_text.toLowerCase().includes("samuel"));
  assert(!out.rule_text.toLowerCase().includes("alex"));
});

Deno.test("single-member room still resolves (initiator alone)", () => {
  const a = makeCandidate({ id: "a", name: "Solo Pick" });
  const b = makeCandidate({ id: "b", name: "Other" });
  const out = run({
    candidates: [a, b],
    votes: [scoredVote("u1", { a: 5, b: 3 })],
  });
  assertEquals(out.winning_option_id, "a");
});

Deno.test("empty candidate pool returns a no_survivor terminal, not a throw", () => {
  const out = run({ candidates: [], votes: [scoredVote("u1", {})] });
  assertEquals(out.winning_option_id, null);
  assertEquals(out.method, "no_survivor");
});

Deno.test("no votes throws — the engine needs at least one member", () => {
  let threw = false;
  try {
    run({ candidates: [makeCandidate()], votes: [] });
  } catch (_e) {
    threw = true;
  }
  assert(threw, "computeVerdict should throw with zero votes");
});

Deno.test("method passthrough — caller-supplied quorum/deadline is preserved on a win", () => {
  const a = makeCandidate({ id: "a", name: "A" });
  const out = run({
    candidates: [a],
    votes: [scoredVote("u1", { a: 4 })],
    method: "quorum",
  });
  assertEquals(out.method, "quorum");
});

Deno.test("excluded_option_ids removes a venue from the pool before pruning", () => {
  const a = makeCandidate({ id: "a", name: "Excluded" });
  const b = makeCandidate({ id: "b", name: "Kept" });
  const out = run({
    candidates: [a, b],
    votes: [scoredVote("u1", { a: 5, b: 4 })],
    excluded_option_ids: ["a"],
  });
  // `a` scored higher but was excluded → `b` wins.
  assertEquals(out.winning_option_id, "b");
  assert(!out.cuts.some((c) => c.option_id === "a"));
});

Deno.test("prefFn — an injected preference function is honoured over the score map", () => {
  // When a member supplies a `prefFn`, the engine uses it instead of
  // the static `scores` map. This is the live path: the pool manager
  // hands the engine each member's cached `prefFn`.
  const a = makeCandidate({ id: "a", name: "A" });
  const b = makeCandidate({ id: "b", name: "B" });
  const out = run({
    candidates: [a, b],
    votes: [
      makeVote({
        user_id: "u1",
        prefFn: (cand) => (cand.id === "a" ? 5 : 4),
      }),
      makeVote({
        user_id: "u2",
        prefFn: (cand) => (cand.id === "a" ? 5 : 4),
      }),
    ],
  });
  assertEquals(out.winning_option_id, "a");
});
