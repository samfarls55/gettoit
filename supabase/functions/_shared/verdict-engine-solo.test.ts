// VerdictEngine solo-flow tests (TB-13).
//
// The engine is member-agnostic by construction — it never inspects
// `votes.length` when building `rule_text`. A solo run (votes.length === 1)
// must therefore:
//   * produce the same shape of verdict as a group run (a survivor + cuts + rule chip);
//   * never reference "N of M wanted X" counts in the rule_text — the
//     rule chip names rules ("Budget cap cut Ren Soba."), not voices;
//   * never name the solo member (the receipt-row would expose them — the
//     surface suppresses it but the engine still produces a receipt for
//     the votes that did happen);
//   * apply the EBA prune chain the same way: the singular voice is
//     itself the room-aggregate min budget / min walk / max vibe.
//
// See `design-system/surfaces/05-verdict.md` §"solo" for the surface
// contract that depends on this engine guarantee.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type CandidateOption,
  computeVerdict,
  type MemberVote,
} from "./verdict-engine.ts";

function makeCandidate(overrides: Partial<CandidateOption> = {}): CandidateOption {
  return {
    id: overrides.id ?? "opt-a",
    name: overrides.name ?? "Pico's Taqueria",
    price_tier: overrides.price_tier ?? 2,
    walk_minutes_estimate: overrides.walk_minutes_estimate ?? 8,
    dietary_tags: overrides.dietary_tags ?? [],
    categories: overrides.categories ?? ["Mexican Restaurant"],
    vibe_signal: overrides.vibe_signal,
    distance_meters: overrides.distance_meters,
  };
}

function makeVote(overrides: Partial<MemberVote> = {}): MemberVote {
  return {
    user_id: overrides.user_id ?? "user-1",
    display_name: overrides.display_name ?? "you",
    q1_vetoes: overrides.q1_vetoes ?? [],
    q2_budget: overrides.q2_budget ?? 4,
    q3_walk_minutes: overrides.q3_walk_minutes ?? 30,
    q4_vibe: overrides.q4_vibe ?? 2,
    q5_regret: overrides.q5_regret ?? {},
    soft_cuisine_vetoes: overrides.soft_cuisine_vetoes ?? [],
  };
}

// ───────────────────────────────────────────────────────────────────────
// Solo-flow happy path
// ───────────────────────────────────────────────────────────────────────

Deno.test("solo run with one vote and two candidates produces a sensible verdict", () => {
  // Solo user, two candidates; budget cap binds and cuts the splurge
  // option. The single survivor (`pico`) wins by short-circuit.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico",    name: "Pico's",  price_tier: 2 }),
    makeCandidate({ id: "splurge", name: "Splurge", price_tier: 4 }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      q2_budget: 2,
      q5_regret: { pico: 5, splurge: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual");
  assertEquals(out.winning_option_id, "pico",
    "the binding budget cap on the solo voice cuts splurge");
  assertEquals(out.cuts.length, 1);
  assertEquals(out.cuts[0].option_id, "splurge");
  assertEquals(out.cuts[0].cut_reason, "budget");
});

Deno.test("solo rule_text never references vote counts or 'N of M' framing", () => {
  // Defensive: the rule_text generator has no member-count branch, so
  // this should be structurally impossible. The test guards against
  // marketing-pass drift that might sneak in "N of M wanted X" copy.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico",    name: "Pico's",   price_tier: 2 }),
    makeCandidate({ id: "ren-soba", name: "Ren Soba", price_tier: 3 }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      q2_budget: 2,
      q5_regret: { pico: 5, "ren-soba": 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  const ruleText = out.rule_text;

  // Negative guards — count framing must not appear.
  assert(
    !ruleText.includes(" of "),
    `solo rule_text must not include 'N of M' framing: ${ruleText}`,
  );
  assert(
    !/\bwanted\b/i.test(ruleText),
    `solo rule_text must not reference voice counts (\`wanted\`): ${ruleText}`,
  );
  assert(
    !/\b\d+\s+(member|voice|voter|user)/i.test(ruleText),
    `solo rule_text must not reference member counts: ${ruleText}`,
  );

  // Positive guard — the rule still names the rule that produced the
  // verdict (the surface contract on S05 depends on this).
  assert(
    ruleText.length > 0,
    "solo rule_text must surface a non-empty rule chip",
  );
});

Deno.test("solo run uses singular voice as the min-budget / min-walk / max-vibe", () => {
  // With a single vote, every aggregate IS that vote — budget cap is
  // their cap, walk threshold is their threshold. Reach the same
  // place a group-of-1 would: the binding constraints come from one voice.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "close",  name: "Close Spot",  walk_minutes_estimate: 5 }),
    makeCandidate({ id: "far",    name: "Far Spot",    walk_minutes_estimate: 25 }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      q3_walk_minutes: 10,
      q5_regret: { close: 5, far: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.winning_option_id, "close",
    "the singular voice's walk threshold binds — far spot is cut");
  assertEquals(out.cuts.find((c) => c.option_id === "far")?.cut_reason, "walk");
});

Deno.test("solo receipts list has exactly one entry, named after the lone voter", () => {
  // The receipts array still gets populated — the surface (S05 solo
  // variant) suppresses the row, but the engine doesn't know that. The
  // receipts array shape is one entry per vote, lowercase name.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico", name: "Pico's", price_tier: 2 }),
  ];
  const votes: MemberVote[] = [
    makeVote({
      display_name: "Sam",
      q5_regret: { pico: 5 },
    }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.receipts.length, 1, "one vote → one receipt");
  assertEquals(out.receipts[0].name, "sam",
    "receipt name is lowercase first-name per spec");
});

Deno.test("solo run does NOT emit no_survivor for a clean single-survivor pool", () => {
  // Sanity check — the engine never short-circuits to no_survivor
  // because of vote-count. A solo run with a healthy candidate set
  // seats a winner the same way a group run would.
  const candidates: CandidateOption[] = [
    makeCandidate({ id: "pico", name: "Pico's", price_tier: 2 }),
  ];
  const votes: MemberVote[] = [
    makeVote({ q5_regret: { pico: 5 } }),
  ];

  const out = computeVerdict({ candidates, votes });
  assertEquals(out.method, "manual",
    "solo run with a survivor → manual, not no_survivor");
  assertEquals(out.winning_option_id, "pico");
});
