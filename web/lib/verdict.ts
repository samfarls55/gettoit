// GetToIt web — verdict shaping helpers.
//
// Mirrors `ios/Sources/App/VerdictStore.swift` so the web verdict
// surface renders the same receipt copy + meta line as iOS for the
// same backing data. iOS does NOT recompute the verdict; neither do
// we. These helpers are pure-functional shaping over the rows the
// engine wrote (`verdicts`, `option_cuts`, `options`, `votes`,
// `members`).

export type OptionPayload = {
  fsq_place_id?: string;
  name?: string;
  price_tier?: number;
  walk_minutes_estimate?: number;
  dietary_tags?: string[];
  categories?: string[];
};

export type OptionRow = {
  id: string;
  payload: OptionPayload;
};

export type VerdictRow = {
  id: string;
  room_id: string;
  option_id: string | null;
  computed_at: string;
  method: "manual" | "quorum" | "deadline" | "no_survivor";
  rule_text: string;
};

export type CutRow = {
  verdict_id: string;
  option_id: string;
  cut_reason: string;
  cut_text: string;
};

export type VoteSummaryRow = {
  user_id: string;
  q1_vetoes: string[];
  q2_budget: number;
  q3_walk_minutes: number;
  q4_vibe: number;
  q5_regret: Record<string, number>;
};

export type Receipt = { name: string; action: string };
export type Cut = { name: string; reason: string };

export type VerdictView =
  | {
      mode: "default";
      placeName: string;
      metaLine: string;
      timeBadge: { time: string; audience: string };
      ruleText: string;
      receipts: Receipt[];
      cuts: Cut[];
    }
  | {
      mode: "no-survivor";
      placeName: string;
      metaLine: string;
      ruleText: string;
    };

// Display name for anonymous users. v1 has no profile name source
// (TB-08 / TB-12 land that). The short uuid prefix matches iOS
// `VerdictStore.displayName`.
export function displayName(userId: string): string {
  const prefix = userId.replace(/-/g, "").slice(0, 4).toLowerCase();
  return `m${prefix}`;
}

// Mirror of `VerdictStore.action(for:)` — priority order:
//   1. high-vibe → "wanted lively"
//   2. low-vibe → "wanted hushed"
//   3. dietary veto → "filtered <chip>"
//   4. budget cap → "capped at $..."
//   5. walk cap → "capped at N min walk"
//   6. default → "voted in"
export function actionFor(vote: VoteSummaryRow): string {
  if (vote.q4_vibe >= 3) return "wanted lively";
  if (vote.q4_vibe <= 0) return "wanted hushed";
  const chip = vote.q1_vetoes.find(
    (v) => v.length > 0 && v !== "nothing_tonight",
  );
  if (chip) return `filtered ${chip}`;
  if (vote.q2_budget < 4) {
    return `capped at ${"$".repeat(Math.max(1, vote.q2_budget))}`;
  }
  if (vote.q3_walk_minutes < 30) {
    return `capped at ${vote.q3_walk_minutes} min walk`;
  }
  return "voted in";
}

// Mirror of `VerdictStore.metaLine` — "Category · $$ · N min walk".
export function metaLine(payload: OptionPayload): string {
  const parts: string[] = [];
  const cat = payload.categories?.[0];
  if (cat) parts.push(cat);
  if (typeof payload.price_tier === "number") {
    const tier = Math.max(1, Math.min(4, payload.price_tier));
    parts.push("$".repeat(tier));
  }
  if (typeof payload.walk_minutes_estimate === "number") {
    parts.push(`${payload.walk_minutes_estimate} min walk`);
  }
  return parts.join(" · ");
}

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
};

export function audienceCopy(memberCount: number): string {
  const word = NUMBER_WORDS[memberCount] ?? String(memberCount);
  return `All ${word} of you`;
}

const DIETARY_LABELS: Record<string, string> = {
  vegan: "vegan options",
  vegetarian: "vegetarian options",
  halal: "halal options",
  kosher: "kosher options",
  gluten: "gluten-free options",
  dairy: "dairy-safe options",
  shellfish: "shellfish-safe options",
  nuts: "nut-safe options",
};

// Mirror of `VerdictStore.survivingHardNeeds` — dietary chips → budget
// cap → walk threshold. Anonymized labels.
export function survivingHardNeeds(votes: ReadonlyArray<VoteSummaryRow>): string[] {
  const labels: string[] = [];
  const dietarySeen = new Set<string>();
  for (const vote of votes) {
    for (const chip of vote.q1_vetoes) {
      const normalized = chip.trim().toLowerCase();
      if (!normalized) continue;
      if (
        normalized === "nothing_tonight" ||
        normalized === "nothing tonight" ||
        normalized === "nothing" ||
        normalized === "none"
      )
        continue;
      const label = DIETARY_LABELS[normalized];
      if (!label) continue;
      if (!dietarySeen.has(label)) {
        dietarySeen.add(label);
        labels.push(label);
      }
    }
  }
  if (votes.length > 0) {
    const minBudget = Math.min(...votes.map((v) => v.q2_budget));
    if (minBudget < 4) {
      labels.push(`${"$".repeat(Math.max(1, minBudget))} cap`);
    }
    const minWalk = Math.min(...votes.map((v) => v.q3_walk_minutes));
    if (minWalk < 30) {
      labels.push(`${minWalk} min walk`);
    }
  }
  return labels;
}

export function shapeVerdictView(args: {
  verdict: VerdictRow;
  winningOption: OptionRow | null;
  cuts: CutRow[];
  cutOptions: Record<string, OptionRow>;
  votes: VoteSummaryRow[];
  memberCount: number;
}): VerdictView | null {
  const { verdict, winningOption, cuts, cutOptions, votes, memberCount } = args;

  if (verdict.method === "no_survivor") {
    const labels = survivingHardNeeds(votes);
    return {
      mode: "no-survivor",
      placeName: "No spot fits",
      metaLine: labels.join(" · "),
      ruleText: verdict.rule_text,
    };
  }

  if (!winningOption) {
    return null;
  }

  const receipts: Receipt[] = votes.map((v) => ({
    name: displayName(v.user_id),
    action: actionFor(v),
  }));

  const shapedCuts: Cut[] = cuts.map((c) => ({
    name: cutOptions[c.option_id]?.payload.name ?? "—",
    reason: c.cut_text,
  }));

  return {
    mode: "default",
    placeName: winningOption.payload.name ?? "Unnamed",
    metaLine: metaLine(winningOption.payload),
    // Web fallback renders read-only verdict per ADR 0003 / 0007 /
    // TB-15 spec. We surface the same placeholder time as iOS until
    // post-v1 scheduling lands.
    timeBadge: {
      time: "7:00 PM",
      audience: audienceCopy(memberCount),
    },
    ruleText: verdict.rule_text,
    receipts,
    cuts: shapedCuts,
  };
}
