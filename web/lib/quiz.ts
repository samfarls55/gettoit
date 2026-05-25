// GetToIt web — quiz-redesign quiz constants + vote-row shaping (tb-WF-10).
//
// The web fallback's quiz, brought to quiz-redesign parity with the iOS app
// (`ios/Sources/App/QuizCoordinator.swift`) and the verdict engine.
//
// The vote WIRE SHAPE is no longer hand-mirrored here. Per ADR 0014 the
// `{ meta, answer }` envelope + the `buildVotesSlotsFromLegacyAnswers`
// builder live in the leaf module `supabase/functions/_shared/votes-wire.ts`,
// imported directly below. The pre-redesign `web/lib/quiz.ts` wrote the
// retired pre-redesign typed columns (`q1_vetoes` / `q3_walk_minutes` / …); a web
// invitee voting through it produced a row `compute-verdict` could no
// longer read. This module now writes the generic `q1`..`q5` jsonb slots.
//
// The Q1-Q4 surface constants (cuisine ids, budget tiers, reputation
// chips, vibe labels) re-implement the iOS `QuizCuisine` / `QuizReputation`
// / `QuizConstants` vocabularies. Per ADR 0003 the web fallback
// re-implements design-system surfaces rather than importing the JSX;
// the id strings are the engine contract and must match iOS exactly.

import {
  buildVotesSlotsFromLegacyAnswers,
  type Q5Rating,
  type VotesSlotInsert,
} from "../../supabase/functions/_shared/votes-wire";

// ───────────────────────────────────────────────────────────────────────
// Q1 — Cuisine craving (multi-select, capped at 3)
// ───────────────────────────────────────────────────────────────────────

/** The cap on Q1 cuisine picks — mirrors `QuizCoordinator.cuisineCap`. */
export const CUISINE_CAP = 3;

/** Q1 cuisine options. The `id` is the stable engine wire value, the
 *  `label` is displayed copy. Display order matches iOS `QuizCuisine`. */
export const CUISINE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "mexican", label: "Mexican" },
  { id: "italian", label: "Italian" },
  { id: "japanese", label: "Japanese" },
  { id: "chinese", label: "Chinese" },
  { id: "thai", label: "Thai" },
  { id: "indian", label: "Indian" },
  { id: "american", label: "American" },
  { id: "mediterranean", label: "Mediterranean" },
];

// ───────────────────────────────────────────────────────────────────────
// Q2 — Spend cap
// ───────────────────────────────────────────────────────────────────────

/** Q2 budget tiers — 1=$, 2=$$, 3=$$$, 4=$$$$. */
export const BUDGET_TIERS: Array<{ tier: 1 | 2 | 3 | 4; label: string; sub: string }> = [
  { tier: 1, label: "$", sub: "Under $15" },
  { tier: 2, label: "$$", sub: "$15 – $30" },
  { tier: 3, label: "$$$", sub: "$30 – $60" },
  { tier: 4, label: "$$$$", sub: "No cap" },
];

// ───────────────────────────────────────────────────────────────────────
// Q3 — Reputation / discovery (single-select)
// ───────────────────────────────────────────────────────────────────────

/** The neutral, non-pruning Q3 answer and Q3 default. */
export const REPUTATION_NO_PREFERENCE = "no_preference";

/** Q3 reputation chips. Single-select. Display order matches iOS
 *  `QuizReputation`. */
export const REPUTATION_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "popular", label: "Popular" },
  { id: "hidden_gem", label: "Hidden gem" },
  { id: "classic", label: "Classic" },
  { id: "new", label: "New" },
  { id: REPUTATION_NO_PREFERENCE, label: "No preference" },
];

// ───────────────────────────────────────────────────────────────────────
// Q4 — Vibe energy (cardinal 5-point scale)
// ───────────────────────────────────────────────────────────────────────

/** Q4 vibe vocabulary — the quiz-redesign energy/loudness scale. Mirrors the
 *  design-system `vibe-labels` token (`QUIET · CHILL · SOCIAL · LIVELY ·
 *  ROWDY`) and iOS `GTIVibeLabels.all`. The pre-redesign `HUSHED · MELLOW · BUZZY
 *  · LOUD · ROWDY` vocabulary was retired by the quiz redesign. */
export const VIBE_LABELS = ["QUIET", "CHILL", "SOCIAL", "LIVELY", "ROWDY"] as const;

// ───────────────────────────────────────────────────────────────────────
// Quiz state defaults
// ───────────────────────────────────────────────────────────────────────

export const QUIZ_DEFAULTS = {
  /** Q1 — no cuisine picked. The "No preference" flag also starts off. */
  cuisines: [] as string[],
  /** Q2 — defaults to tier 1, the same as iOS. */
  budget: 1 as 1 | 2 | 3 | 4,
  /** Q3 — the neutral, non-pruning answer. */
  reputation: REPUTATION_NO_PREFERENCE,
  /** Q4 — mid-scale (SOCIAL). */
  vibe: 2,
} as const;

// ───────────────────────────────────────────────────────────────────────
// Q1 cuisine toggle — cap + "No preference" mutual exclusion
// ───────────────────────────────────────────────────────────────────────

/** The Q1 cuisine answer — the (capped) craved set plus the mutually-
 *  exclusive "No preference" flag. The two are never both populated. */
export interface CuisineSelection {
  cuisines: ReadonlySet<string>;
  noPreference: boolean;
}

/** Toggle a Q1 cuisine chip. Mirrors `QuizCoordinator.toggleCuisine`:
 *  - selecting a cuisine clears the "No preference" flag;
 *  - the set is capped at `CUISINE_CAP` — a pick that would exceed it
 *    is a no-op; deselecting always works (it frees a slot). */
export function toggleCuisine(
  current: CuisineSelection,
  id: string,
): CuisineSelection {
  const next = new Set(current.cuisines);
  if (next.has(id)) {
    next.delete(id);
    return { cuisines: next, noPreference: current.noPreference };
  }
  // A new selection — cap-gated.
  if (next.size >= CUISINE_CAP) return current;
  next.add(id);
  return { cuisines: next, noPreference: false };
}

/** Toggle the mutually-exclusive "No preference" cuisine option.
 *  Mirrors `QuizCoordinator.toggleCuisineNoPreference`. */
export function toggleCuisineNoPreference(
  current: CuisineSelection,
): CuisineSelection {
  if (current.noPreference) {
    return { cuisines: current.cuisines, noPreference: false };
  }
  return { cuisines: new Set(), noPreference: true };
}

/** True while the cuisine set has room for another pick — the Q1
 *  surface dims unselected chips when this is false. */
export function hasFreeCuisineSlot(selection: CuisineSelection): boolean {
  return selection.cuisines.size < CUISINE_CAP;
}

// ───────────────────────────────────────────────────────────────────────
// The vote row — generic q1..q5 jsonb slots
// ───────────────────────────────────────────────────────────────────────

/** A `votes` table insert row. `q1`..`q5` are the generic
 *  `{ meta, answer }` jsonb slots built by `votes-wire.ts`. */
export interface VoteRow extends VotesSlotInsert {
  room_id: string;
  user_id: string;
}

/** Build the generic-slot `votes` row from the member's quiz-redesign answers.
 *
 *  The five typed answers are wrapped into the `{ meta, answer }`
 *  envelopes by the shared `buildVotesSlotsFromLegacyAnswers` builder —
 *  the SAME builder the edge functions use — so a web-invitee vote round
 *  is readable by `compute-verdict` end-to-end. */
export function buildVoteRow(args: {
  roomId: string;
  userId: string;
  cuisines: ReadonlySet<string>;
  noPreference: boolean;
  budget: number;
  reputation: string;
  vibe: number;
  q5Ratings: Q5Rating[];
}): VoteRow {
  // "No preference" on Q1 is a genuine zero-weight signal — it writes an
  // empty craved set, exactly as iOS does (`QuizFetchAnswers` zeroes the
  // cuisine list when `q1NoPreference`).
  const cuisines = args.noPreference
    ? []
    : Array.from(args.cuisines).sort();
  const slots = buildVotesSlotsFromLegacyAnswers({
    q1_vetoes: [],
    q2_budget: args.budget,
    cuisines,
    reputation: args.reputation,
    q4_vibe: args.vibe,
    q5_ratings: args.q5Ratings,
  });
  return {
    room_id: args.roomId,
    user_id: args.userId,
    q1: slots.q1,
    q2: slots.q2,
    q3: slots.q3,
    q4: slots.q4,
    q5: slots.q5,
  };
}

// Re-export the wire types web callers need, so they don't reach across
// the repo boundary themselves.
export type { Q5Rating } from "../../supabase/functions/_shared/votes-wire";
