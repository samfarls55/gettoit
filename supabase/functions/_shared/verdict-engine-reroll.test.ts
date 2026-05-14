// VerdictEngine — reroll-aware tests (TB-10).
//
// Exercises the reroll integration hooks added to the engine:
//   * `excluded_option_ids` filters the candidate pool BEFORE pruning.
//   * `reroll_reason` prefixes the rule_text in aggregate-rule register.
//   * Neither hook surfaces the rerolling member's identity.
//
// Sibling to `verdict-engine.test.ts` (clean-run) and
// `verdict-engine-relax.test.ts` (cascade). Same shape: pure
// (VerdictEngineInput) → VerdictEngineOutput, no Supabase round-trip.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type CandidateOption,
  computeVerdict,
  type MemberVote,
} from "./verdict-engine.ts";

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
// excluded_option_ids — pool filter
// ───────────────────────────────────────────────────────────────────────

Deno.test("reroll: excluded_option_ids removes the option from the pool before pruning", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico", name: "Pico's", price_tier: 2 }),
    makeCandidate({ id: "ren",  name: "Ren Soba", price_tier: 2 }),
    makeCandidate({ id: "lou",  name: "Café Lou", price_tier: 2 }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q5_regret: { pico: 5, ren: 4, lou: 3 },
    }),
    makeVote({
      user_id: "u2",
      q5_regret: { pico: 5, ren: 4, lou: 3 },
    }),
  ];

  // Clean run picks pico (regret max).
  const clean = computeVerdict({ candidates, votes });
  assertEquals(clean.winning_option_id, "pico");

  // With pico excluded, the engine picks ren (next regret-max).
  const rerolled = computeVerdict({
    candidates,
    votes,
    excluded_option_ids: ["pico"],
  });
  assertEquals(rerolled.winning_option_id, "ren");
  // The cuts surface should NOT include `pico` — it was filtered before
  // pruning, so it never made it onto the candidate list. (If a future
  // surface wants to show pre-filtered exclusions, that's a separate
  // emit; the engine treats the exclusion as if the option weren't
  // in the pool.)
  assert(
    !rerolled.cuts.some((c) => c.option_id === "pico"),
    "excluded options must not appear in cuts (filtered before pruning)",
  );
});

Deno.test("reroll: excluding every option lands on no_survivor terminal", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico" }),
  ];
  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { pico: 5 } }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    excluded_option_ids: ["pico"],
  });
  assertEquals(out.method, "no_survivor");
  assertEquals(out.winning_option_id, null);
});

// ───────────────────────────────────────────────────────────────────────
// reroll_reason — rule_text prefix in aggregate-rule register
// ───────────────────────────────────────────────────────────────────────

Deno.test("reroll: cost-reason rule_text prefixes with 'Cost reroll cut <prev>.' aggregate-rule", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba",  price_tier: 2 }),
    makeCandidate({ id: "lou",  name: "Café Lou",  price_tier: 2 }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q5_regret: { ren: 5, lou: 3 },
    }),
    makeVote({
      user_id: "u2",
      q5_regret: { ren: 5, lou: 3 },
    }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "cost",
    previous_winner_name: "Pico's",
  });

  assertEquals(out.winning_option_id, "ren");
  assert(
    out.rule_text.startsWith("Cost reroll cut Pico's."),
    `rule_text should lead with 'Cost reroll cut Pico\\'s.': ${out.rule_text}`,
  );
  // The prefix must not name the rerolling member.
  assert(!out.rule_text.toLowerCase().includes("alex"));
  assert(!out.rule_text.toLowerCase().includes("maya"));
});

Deno.test("reroll: dist-reason rule_text uses 'Distance reroll cut <prev>.'", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba" }),
  ];
  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { ren: 5 } }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "dist",
    previous_winner_name: "Pico's",
  });
  assert(
    out.rule_text.startsWith("Distance reroll cut Pico's."),
    `rule_text should lead with 'Distance reroll cut Pico\\'s.': ${out.rule_text}`,
  );
});

Deno.test("reroll: mood-reason rule_text uses 'Mood reroll cut <prev>.'", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba" }),
  ];
  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { ren: 5 } }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "mood",
    previous_winner_name: "Pico's",
  });
  assert(out.rule_text.startsWith("Mood reroll cut Pico's."));
});

Deno.test("reroll: diet-reason rule_text uses 'Diet reroll cut <prev>.' (chip stays anonymized)", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba", dietary_tags: ["vegan_friendly"] }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q1_vetoes: ["vegan"],
      q5_regret: { ren: 5 },
    }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "diet",
    previous_winner_name: "Pico's",
  });
  assert(out.rule_text.startsWith("Diet reroll cut Pico's."));
  // Per anonymization rule the chip ("vegan") is NOT named in the
  // reroll prefix — the body of the rule chip uses the anonymized
  // "vegan options" attribute label elsewhere; the prefix is
  // attribute-free.
  assert(
    !/\bvegan\b/i.test(out.rule_text.split(".")[0]),
    `reroll prefix must not name the chip: ${out.rule_text}`,
  );
});

Deno.test("reroll: avail-reason rule_text uses 'Availability reroll cut <prev>.'", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba" }),
  ];
  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { ren: 5 } }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "avail",
    previous_winner_name: "Pico's",
  });
  assert(out.rule_text.startsWith("Availability reroll cut Pico's."));
});

Deno.test("reroll: rule_text never names the rerolling member even when display_name leaks in", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba" }),
  ];
  const votes: MemberVote[] = [
    // Hostile fixture — a member whose display_name is "cost" would
    // be a false positive on a substring check. The engine's rule
    // generator must surface the reason verbatim regardless.
    makeVote({
      user_id: "u1",
      display_name: "cost",
      q5_regret: { ren: 5 },
    }),
    makeVote({
      user_id: "u2",
      display_name: "alex",
      q5_regret: { ren: 5 },
    }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "cost",
    previous_winner_name: "Pico's",
  });
  // Aggregate-rule prefix is present.
  assert(out.rule_text.startsWith("Cost reroll cut Pico's."));
  // No "by alex" / "alex's" / "alex" substring outside the prefix.
  const withoutPrefix = out.rule_text.slice("Cost reroll cut Pico's.".length);
  assert(
    !/\balex\b/i.test(withoutPrefix),
    `rule_text body must not name the rerolling member: ${out.rule_text}`,
  );
});

Deno.test("reroll: omitting previous_winner_name produces a generic-but-aggregate prefix", () => {
  // Defensive: if the handler can't read the prior winner (e.g.
  // verdict was already cleaned up), the engine still emits an
  // aggregate-attribution sentence rather than crashing.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "ren",  name: "Ren Soba" }),
  ];
  const votes: MemberVote[] = [
    makeVote({ user_id: "u1", q5_regret: { ren: 5 } }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "cost",
    // previous_winner_name omitted on purpose
  });
  assert(
    out.rule_text.startsWith("Cost reroll cut the prior pick."),
    `rule_text should fall back to generic prior-pick copy: ${out.rule_text}`,
  );
});

// ───────────────────────────────────────────────────────────────────────
// no_survivor + reroll_reason — terminal still carries the reroll prefix
// ───────────────────────────────────────────────────────────────────────

Deno.test("reroll: no_survivor after reroll still carries the reroll prefix in rule_text", () => {
  const candidates: CandidateOption[] = [
    makeCandidate({
      id: "ren",
      name: "Ren Soba",
      dietary_tags: [], // fails vegan veto below
    }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      user_id: "u1",
      q1_vetoes: ["vegan"],
      q5_regret: { ren: 5 },
    }),
  ];

  const out = computeVerdict({
    candidates,
    votes,
    reroll_reason: "diet",
    previous_winner_name: "Pico's",
  });
  assertEquals(out.method, "no_survivor");
  assert(
    out.rule_text.startsWith("Diet reroll cut Pico's."),
    `no_survivor rule_text should still surface the reroll prefix: ${out.rule_text}`,
  );
});
