// votes-wire — the vote WIRE CONTRACT shared between the edge functions
// and the web fallback (tb-WF-10, ADR 0014).
//
// Why this module exists
// ──────────────────────
// The vote wire shape — the `{ meta, answer }` envelope per quiz slot,
// plus the helper that builds the five slots from a set of quiz answers
// — used to be defined three separate times: in iOS Swift, in the web
// fallback's `web/lib/quiz.ts`, and inside `votes-schema.ts`. The web
// hand-mirror rotted a whole quiz generation behind (it still wrote the
// retired pre-redesign typed columns). ADR 0014 fixes that by extracting the wire
// types + builder into this ONE module, imported directly by both the
// edge functions (`votes-schema.ts`) and the web app.
//
// Leaf-module rule (ADR 0014, load-bearing)
// ─────────────────────────────────────────
// `votes-wire.ts` is a LEAF MODULE: it imports no engine code and has
// NO relative imports of its own. The tiny `Axis` / `Q5Rating` types it
// needs are DEFINED HERE (they are two lines each) and re-exported by
// `preference-function.ts` rather than imported from it — so this file
// stays a true leaf.
//
// That leaf property is what keeps the module consumable by BOTH the
// Deno edge runtime AND the Next.js / Node web build: Deno and Node
// differ on import-extension resolution, and a relative import would
// force one build or the other to break. With zero relative imports
// there is nothing to resolve. If this module ever needs a non-type
// relative import, the Deno/Node portability constraint (ADR 0014
// re-evaluation trigger) has to be solved first.

// ───────────────────────────────────────────────────────────────────────
// Q5 factorial probe types
// ───────────────────────────────────────────────────────────────────────
//
// Defined here, not imported. `preference-function.ts` re-exports them
// from this module so the engine has one canonical definition while
// `votes-wire.ts` stays a relative-import-free leaf (ADR 0014).

/** The three preference axes the Q5 factorial probes. Mirrors the Swift
 *  `Q5FactorialCard.Axis` enum. */
export type Axis = "cuisine" | "reputation" | "vibe";

/** One Q5 factorial card's excitement rating, tagged with the axis that
 *  card deviates on. The Q5 factorial emits exactly three cards — one
 *  per axis — and the member rates each 1…5. Mirrors the Swift
 *  `Q5Rating` / `Q5RatingEntry` struct. */
export interface Q5Rating {
  /** The factorial axis the rated card deviates on. */
  droppedAxis: Axis;
  /** The member's 1…5 excitement rating for that card. */
  score: number;
}

// ───────────────────────────────────────────────────────────────────────
// Question-kind taxonomy
// ───────────────────────────────────────────────────────────────────────
//
// The discriminator `meta.question_kind` the verdict-engine mapping
// layer dispatches on. The full taxonomy lives here so a write path
// (iOS / web) and the read path (`votes-schema.ts`) agree on the kind
// set without a second copy.

export const QUESTION_KINDS = [
  "dietary_veto",
  "budget_cap",
  "cuisine_craving",
  "reputation",
  "walk_minutes",
  "vibe",
  "regret",
  "profile_veto",
] as const;

export type QuestionKind = typeof QUESTION_KINDS[number];

// ───────────────────────────────────────────────────────────────────────
// Slot shape — the `{ meta, answer }` jsonb envelope
// ───────────────────────────────────────────────────────────────────────

/** Per-session question metadata. `question_kind` is required and
 *  load-bearing; everything else is descriptive and never read by the
 *  mapper (kept for audit / replay of what the member actually saw). */
export interface QuestionMeta {
  /** The discriminator the mapping layer dispatches on. */
  question_kind: QuestionKind;
  /** The prompt string the session displayed. Optional, not read. */
  prompt?: string;
  /** The option labels the session offered. Optional, not read. */
  options?: string[];
  /** Free-form per-session metadata — anything a later slice wants to
   *  stamp onto the slot without a migration. Never read by the mapper. */
  [extra: string]: unknown;
}

/** One quiz answer as stored in a generic jsonb slot. */
export interface QuestionSlot {
  meta: QuestionMeta;
  /** The response payload. Shape depends on `meta.question_kind` —
   *  see the per-kind `answer` readers in `votes-schema.ts`. */
  answer: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────────────────
// Inverse — build the jsonb row a write path inserts
// ───────────────────────────────────────────────────────────────────────
//
// The quiz produces typed answers per question; this helper wraps them
// in the generic `{ meta, answer }` slot shape so the quiz keeps
// writing — and the engine keeps reading — end-to-end.

export interface LegacyTypedAnswers {
  /** Q1-era dietary veto chips. */
  q1_vetoes: string[];
  /** Q2 spend cap tier. */
  q2_budget: number;
  /** Q1 (quiz redesign) craved cuisine tokens. Soft preference. */
  cuisines?: string[];
  /** Q3 (quiz redesign) reputation chip. Soft preference. */
  reputation?: string;
  /** Q4 vibe energy index 0..4. Soft preference. */
  q4_vibe?: number;
  /** Q5 factorial preference probe — one `{ droppedAxis, score }` entry
   *  per factorial card (cuisine-drop / reputation-drop / vibe-drop).
   *  `compute-verdict` reads this via `mapVotesRowToPreferenceInputs` to
   *  re-weight each member's preference function. */
  q5_ratings: Q5Rating[];
}

/** The five generic slots, ready to insert into `votes.q1`..`q5`. */
export interface VotesSlotInsert {
  q1: QuestionSlot;
  q2: QuestionSlot;
  q3: QuestionSlot;
  q4: QuestionSlot;
  q5: QuestionSlot;
}

/** Wrap typed quiz answers in the generic `{ meta, answer }` envelopes.
 *  Q1 carries the quiz-redesign `cuisine_craving` kind; Q3 carries `reputation`.
 *  The `meta.prompt` strings are illustrative session copy — carried
 *  for audit, never read by the mapper.
 *
 *  The Q5 `regret` slot emits `answer.ratings` — the canonical quiz-redesign
 *  factorial probe shape `[{ droppedAxis, score }]` that
 *  `mapVotesRowToPreferenceInputs` / `readQ5Ratings` consume. No
 *  parallel `answer.scores` map is emitted (tb-23 moved verdict scoring
 *  server-side; a second shape would be dead weight on the slot). */
export function buildVotesSlotsFromLegacyAnswers(
  answers: LegacyTypedAnswers,
): VotesSlotInsert {
  return {
    q1: {
      meta: {
        question_kind: "cuisine_craving",
        prompt: "What are you craving tonight?",
      },
      answer: { cuisines: answers.cuisines ?? [] },
    },
    q2: {
      meta: {
        question_kind: "budget_cap",
        prompt: "Where's the ceiling tonight?",
      },
      answer: { tier: answers.q2_budget },
    },
    q3: {
      meta: {
        question_kind: "reputation",
        prompt: "What kind of place are you after?",
      },
      answer: { reputation: answers.reputation ?? "no_preference" },
    },
    q4: {
      meta: {
        question_kind: "vibe",
        prompt: "What's the energy you're after?",
      },
      answer: { level: answers.q4_vibe ?? 2 },
    },
    q5: {
      meta: {
        question_kind: "regret",
        prompt: "How excited does each of these make you?",
      },
      answer: { ratings: answers.q5_ratings },
    },
  };
}
