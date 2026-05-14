// GetToIt web — quiz constants + vote-row shaping.
//
// Mirrors `ios/Sources/App/QuizCoordinator.swift` and the schema in
// `supabase/migrations/20260513215000000_votes.sql`. The wire shape is
// intentionally identical to the iOS payload so the same `votes` row
// emerges regardless of which platform submitted it; the VerdictEngine
// (compute-verdict Edge Function) consumes both equally.

export const VIBE_LABELS = ["HUSHED", "MELLOW", "BUZZY", "LOUD", "ROWDY"] as const;

export const VETO_NOTHING = "nothing_tonight";

// Display order matches `QuizVeto.displayOrder` in iOS.
export const VETO_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Dairy" },
  { id: "shellfish", label: "Shellfish" },
  { id: "vegan_options", label: "Needs vegan options" },
  { id: "halal_only", label: "Halal-only" },
  { id: VETO_NOTHING, label: "Nothing tonight" },
];

// Q2 budget tiers — 1=$, 2=$$, 3=$$$, 4=$$$$.
export const BUDGET_TIERS: Array<{ tier: 1 | 2 | 3 | 4; label: string; sub: string }> = [
  { tier: 1, label: "$", sub: "Under $15" },
  { tier: 2, label: "$$", sub: "$15 – $30" },
  { tier: 3, label: "$$$", sub: "$30 – $60" },
  { tier: 4, label: "$$$$", sub: "No cap" },
];

// Q3 walk-minute stops — must match the migration check constraint.
export const WALK_STOPS = [5, 10, 15, 20, 30] as const;

export type VoteRow = {
  room_id: string;
  user_id: string;
  q1_vetoes: string[];
  q2_budget: number;
  q3_walk_minutes: number;
  q4_vibe: number;
  q5_regret: Record<string, number>;
};

// Mirrors `QuizCoordinator.toggleVeto` — "nothing_tonight" is mutually
// exclusive with all other chips.
export function toggleVeto(current: ReadonlySet<string>, chip: string): Set<string> {
  const next = new Set(current);
  if (chip === VETO_NOTHING) {
    return next.has(VETO_NOTHING) ? new Set() : new Set([VETO_NOTHING]);
  }
  next.delete(VETO_NOTHING);
  if (next.has(chip)) {
    next.delete(chip);
  } else {
    next.add(chip);
  }
  return next;
}

export const QUIZ_DEFAULTS = {
  q1_vetoes: [] as string[],
  q2_budget: 1 as 1 | 2 | 3 | 4,
  q3_walk_minutes: 15 as (typeof WALK_STOPS)[number],
  q4_vibe: 2,
} as const;

export type Candidate = { id: string; name: string; meta: string };

// Dummy candidates for the Q5 rater on the web fallback. The real
// candidate set lands from the `options` table once the room has been
// seeded by PlacesProxy; until then the web client renders the same
// three fixture cards as iOS so the surface still functions if the
// room was created before the candidates landed (e.g. solo testing
// rooms in dev).
export const DUMMY_CANDIDATES: Candidate[] = [
  { id: "dummy-pico", name: "Pico's Taqueria", meta: "Mexican · $$ · 8 min" },
  { id: "dummy-ren", name: "Ren Soba House", meta: "Japanese · $$ · 12 min" },
  { id: "dummy-pastoral", name: "Bar Pastoral", meta: "Italian · $$ · 5 min" },
];

// Seed Q5 ratings at the spec'd midpoint (3) so the surface renders
// with a chosen state per card.
export function seedRegret(candidates: ReadonlyArray<Candidate>): Record<string, number> {
  const seed: Record<string, number> = {};
  for (const c of candidates) seed[c.id] = 3;
  return seed;
}

// Build the wire row from current state. Sorted vetoes for determinism
// in tests; the server cares about set semantics.
export function buildVoteRow(args: {
  roomId: string;
  userId: string;
  q1Vetoes: ReadonlySet<string>;
  q2Budget: number;
  q3WalkMinutes: number;
  q4Vibe: number;
  q5Regret: Record<string, number>;
}): VoteRow {
  return {
    room_id: args.roomId,
    user_id: args.userId,
    q1_vetoes: Array.from(args.q1Vetoes).sort(),
    q2_budget: args.q2Budget,
    q3_walk_minutes: args.q3WalkMinutes,
    q4_vibe: args.q4Vibe,
    q5_regret: args.q5Regret,
  };
}
