// VerdictEngine fixture tests (TB-06).
//
// Pure-logic tests against the engine's public interface. No Supabase
// round-trip, no Edge runtime — just `(VerdictEngineInput) → VerdictEngineOutput`.
//
// Scope of TB-06: clean-run path only. Soft-pref relax, hard-need
// terminal, and no-survivor handling are TB-09 and not exercised here.
//
// Fixtures shape the public contract of the engine:
//   * Q1 dietary vetoes prune candidates whose `dietary_tags` lack
//     the corresponding `emit_tag` (menu-compliance filter per PRD).
//   * Q2 budget tier prunes candidates with `price_tier` above the
//     MAX member cap … actually MIN. Each member's tier is a cap;
//     a candidate survives only if it satisfies every member's cap.
//   * Q3 walk-minutes prunes candidates with `walk_minutes_estimate`
//     above the MIN member threshold (every member's "willing to walk"
//     must be satisfied).
//   * Q4 vibe is currently a soft signal (not exercised in TB-06's
//     hard-veto chain — it lands in TB-09's relax logic).
//   * Q5 regret sums per-candidate scores across members; max wins.
//   * Flat-regret variance below threshold → random within survivors.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type CandidateOption,
  type MemberVote,
  computeVerdict,
  type VerdictEngineInput,
  type VerdictEngineOutput,
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
  };
}

// ───────────────────────────────────────────────────────────────────────
// Clean-run path — no vetoes apply, multi-survivor Q5 tiebreaker picks max
// ───────────────────────────────────────────────────────────────────────

Deno.test("clean run returns the candidate with the highest Q5 regret sum", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico",     name: "Pico's Taqueria" }),
    makeCandidate({ id: "ren",      name: "Ren Soba" }),
    makeCandidate({ id: "pastoral", name: "Bar Pastoral" }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      display_name: "you",
      q5_regret: { pico: 5, ren: 3, pastoral: 2 },
    }),
    makeVote({
      user_id: "u2",
      display_name: "alex",
      q5_regret: { pico: 4, ren: 4, pastoral: 1 },
    }),
    makeVote({
      user_id: "u3",
      display_name: "maya",
      q5_regret: { pico: 5, ren: 2, pastoral: 1 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "pico", "Pico totals 14 — highest of the survivors");
  assertEquals(out.cuts.length, 2, "the two non-winners are cuts");
  const cutIds = out.cuts.map((c) => c.option_id).sort();
  assertEquals(cutIds, ["pastoral", "ren"]);
});

// ───────────────────────────────────────────────────────────────────────
// Single survivor short-circuit
// ───────────────────────────────────────────────────────────────────────

Deno.test("single survivor short-circuits the Q5 tiebreaker", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico",   price_tier: 2 }),
    makeCandidate({ id: "splurge", price_tier: 4 }),
    makeCandidate({ id: "cheap",  walk_minutes_estimate: 60 }),
  ];

  // Member caps push price ≤ 3 and walk ≤ 15.
  // splurge cut by price; cheap cut by walk; pico survives.
  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q2_budget: 3,
      q3_walk_minutes: 15,
      q5_regret: { pico: 1, splurge: 1, cheap: 1 }, // flat — but only one survives, so irrelevant
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "pico");
  // Cuts: splurge (budget), cheap (walk)
  assertEquals(out.cuts.length, 2);
  const splurgeCut = out.cuts.find((c) => c.option_id === "splurge");
  assertExists(splurgeCut);
  assertEquals(splurgeCut!.cut_reason, "budget");
  const cheapCut = out.cuts.find((c) => c.option_id === "cheap");
  assertExists(cheapCut);
  assertEquals(cheapCut!.cut_reason, "walk");
});

// ───────────────────────────────────────────────────────────────────────
// Q5 regret tiebreaker — max-sum wins
// ───────────────────────────────────────────────────────────────────────

Deno.test("Q5 regret tiebreaker picks the maximum sum", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "a" }),
    makeCandidate({ id: "b" }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { a: 2, b: 5 } }),
    makeVote({ user_id: "u2", q5_regret: { a: 2, b: 5 } }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.winning_option_id, "b");
});

// ───────────────────────────────────────────────────────────────────────
// Flat regret falls back to random within survivors
// ───────────────────────────────────────────────────────────────────────

Deno.test("flat regret variance falls back to deterministic random within survivors", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "a" }),
    makeCandidate({ id: "b" }),
    makeCandidate({ id: "c" }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { a: 3, b: 3, c: 3 } }),
    makeVote({ user_id: "u2", q5_regret: { a: 3, b: 3, c: 3 } }),
  ];

  // Inject a deterministic random so the test is stable. Picks index 1 (b).
  const out = computeVerdict({ candidates, votes }, { random: () => 0.5 });
  assertEquals(out.winning_option_id, "b");
  assertEquals(out.flat_regret_fallback, true);
});

Deno.test("flat regret fallback respects the survivor set order for determinism", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "a" }),
    makeCandidate({ id: "b" }),
    makeCandidate({ id: "c" }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { a: 3, b: 3, c: 3 } }),
    makeVote({ user_id: "u2", q5_regret: { a: 3, b: 3, c: 3 } }),
  ];

  // random() = 0.0 → index 0 = "a"; random() = 0.999 → last survivor.
  const first = computeVerdict({ candidates, votes }, { random: () => 0.0 });
  assertEquals(first.winning_option_id, "a");
  const last = computeVerdict({ candidates, votes }, { random: () => 0.999 });
  assertEquals(last.winning_option_id, "c");
});

// ───────────────────────────────────────────────────────────────────────
// Q1 dietary EBA pruning — menu-compliance filter
// ───────────────────────────────────────────────────────────────────────

Deno.test("Q1 vegan veto cuts candidates without vegan_friendly tag", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "steakhouse", dietary_tags: [] }),
    makeCandidate({ id: "plant",      dietary_tags: ["vegan_friendly"] }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q1_vetoes: ["vegan"], q5_regret: { steakhouse: 5, plant: 1 } }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.winning_option_id, "plant", "vegan veto excludes steakhouse even though its regret is higher");
  const steakCut = out.cuts.find((c) => c.option_id === "steakhouse");
  assertExists(steakCut);
  assertEquals(steakCut!.cut_reason, "dietary");
});

// ───────────────────────────────────────────────────────────────────────
// Rule text generation — aggregate-rule attribution, never names a person
// ───────────────────────────────────────────────────────────────────────

Deno.test("rule_text uses aggregate attribution and never names a person", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico",  name: "Pico's Taqueria" }),
    makeCandidate({ id: "ren",   name: "Ren Soba",       price_tier: 4 }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      display_name: "alex",
      q2_budget: 2,
      q5_regret: { pico: 5, ren: 1 },
    }),
    makeVote({
      user_id: "u2",
      display_name: "maya",
      q2_budget: 2,
      q5_regret: { pico: 5, ren: 1 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.winning_option_id, "pico");
  // Aggregate attribution: "Budget cap cut Ren Soba." — never "Alex's cap" / "Maya's cap".
  assert(out.rule_text.includes("Budget cap"), `rule_text should reference Budget cap: ${out.rule_text}`);
  assert(out.rule_text.includes("Ren Soba"),    `rule_text should name the cut option: ${out.rule_text}`);
  assert(!out.rule_text.toLowerCase().includes("alex"), "rule_text must not name alex");
  assert(!out.rule_text.toLowerCase().includes("maya"), "rule_text must not name maya");
});

Deno.test("rule_text mentions regret tiebreaker when multiple options survived", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico", name: "Pico's Taqueria" }),
    makeCandidate({ id: "ren",  name: "Ren Soba" }),
  ];

  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { pico: 5, ren: 2 } }),
    makeVote({ user_id: "u2", q5_regret: { pico: 5, ren: 2 } }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.winning_option_id, "pico");
  assert(
    out.rule_text.toLowerCase().includes("regret"),
    `rule_text should describe the regret-of-omission tiebreaker: ${out.rule_text}`,
  );
});

// ───────────────────────────────────────────────────────────────────────
// Private constraint anonymization — attribute-level, not person-level
// ───────────────────────────────────────────────────────────────────────

Deno.test("anonymized private constraint cuts emit attribute-level text, not a person", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "shellfish-only", dietary_tags: [] }),
    makeCandidate({ id: "safe",           dietary_tags: ["no_shellfish_unverified"] }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      display_name: "alex",
      q1_vetoes: ["shellfish"],
      q5_regret: { "shellfish-only": 5, safe: 1 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.winning_option_id, "safe");

  // Cut row for the eliminated option carries attribute attribution.
  const cut = out.cuts.find((c) => c.option_id === "shellfish-only");
  assertExists(cut);
  // Anonymized — "filtered shellfish" / "shellfish veto" style, never "alex".
  assert(
    !cut!.cut_text.toLowerCase().includes("alex"),
    `cut text must not name a person: ${cut!.cut_text}`,
  );
  assert(
    cut!.cut_text.toLowerCase().includes("shellfish"),
    `cut text should attribute the cut to the attribute: ${cut!.cut_text}`,
  );
});

// ───────────────────────────────────────────────────────────────────────
// Receipts shape — every member with a contributing answer gets one chip
// ───────────────────────────────────────────────────────────────────────

Deno.test("receipts emit one chip per member with the loudest contributing input", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "pico",
      name: "Pico's",
      dietary_tags: ["no_shellfish_unverified"],
    }),
  ];

  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      display_name: "you",
      q4_vibe: 3, // LOUD — `wanted lively`
      q5_regret: { pico: 5 },
    }),
    makeVote({
      user_id: "u2",
      display_name: "alex",
      q1_vetoes: ["shellfish"],
      q5_regret: { pico: 4 },
    }),
    makeVote({
      user_id: "u3",
      display_name: "maya",
      q2_budget: 2,
      q5_regret: { pico: 5 },
    }),
    makeVote({
      user_id: "u4",
      display_name: "sam",
      q3_walk_minutes: 15,
      q5_regret: { pico: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.receipts.length, 4);
  // Lowercase first names, no caps.
  for (const r of out.receipts) {
    assertEquals(r.name, r.name.toLowerCase());
  }
});
