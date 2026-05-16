// votes-schema — generic Q1..Q5 jsonb storage shape + the schema-driven
// mapping layer the verdict engine consumes its input through (TB-04).
//
// Why this module exists
// ──────────────────────
// The `votes` table used to carry one typed column per quiz question
// (`q1_vetoes text[]`, `q2_budget int`, `q3_walk_minutes int`,
// `q4_vibe int`, `q5_regret jsonb`). That coupled the storage schema
// to a fixed quiz: any change to the quiz — reordering questions,
// reworording a prompt, swapping option copy — needed a migration, and
// the verdict engine read those columns by hardcoded field name.
//
// The v1.1 quiz redesign (PRD module H) makes the quiz content
// session-variable. So `votes` now carries five GENERIC jsonb slots,
// `q1`..`q5`. Each slot is a `{ meta, answer }` envelope:
//
//   * `meta`   — per-session question metadata. The load-bearing field
//                is `question_kind`, a discriminator that says how to
//                interpret `answer`. `meta` may also carry the prompt
//                and option copy the session showed; the mapper never
//                reads those — they're there for audit / replay.
//   * `answer` — the member's response payload, shaped per kind.
//
// `mapVotesRowToMemberVote` is the mapping layer: it dispatches each
// slot on `meta.question_kind`, NOT on the slot's column name. The quiz
// can move a question between slots, or change its copy, without a
// migration and without an engine change — the engine still receives a
// stable `MemberVote`.
//
// Scope (TB-04 — walking-skeleton slice): the engine's internal logic
// is unchanged. Only the storage shape and the engine's input path move
// here. The full engine rewrite (PRD module B) is a later slice and
// will widen the kind taxonomy; this module is the seam it builds on.

import type { MemberVote } from "./verdict-engine.ts";

// ───────────────────────────────────────────────────────────────────────
// Question-kind taxonomy
// ───────────────────────────────────────────────────────────────────────
//
// The five kinds the current verdict engine consumes. Each maps to one
// field (or field-pair) on `MemberVote`. The PRD module-B rewrite will
// add kinds (e.g. cuisine craving, reputation) — when it does, extend
// this set and the dispatch table below together.

export const QUESTION_KINDS = [
  "dietary_veto",
  "budget_cap",
  "walk_minutes",
  "vibe",
  "regret",
] as const;

export type QuestionKind = typeof QUESTION_KINDS[number];

const QUESTION_KIND_SET: ReadonlySet<string> = new Set(QUESTION_KINDS);

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
   *  see the per-kind `answer` readers below. */
  answer: Record<string, unknown>;
}

/** A `votes` table row as read from Postgres. The five slots are
 *  nullable: a slot is `null` when the session did not ask that
 *  question. `display_name` is joined in by the caller (it does not
 *  live on the `votes` row itself). */
export interface VotesRow {
  user_id: string;
  display_name: string;
  q1: QuestionSlot | null;
  q2: QuestionSlot | null;
  q3: QuestionSlot | null;
  q4: QuestionSlot | null;
  q5: QuestionSlot | null;
}

// ───────────────────────────────────────────────────────────────────────
// Defaults — what an absent slot maps to
// ───────────────────────────────────────────────────────────────────────
//
// A `null` slot means the session never asked that question. The
// engine still needs a value, so each kind has a no-constraint default:
// the most permissive answer, so an unasked question never prunes.

const OPEN_BUDGET_TIER = 4; // $$$$ — no cap.
const OPEN_WALK_MINUTES = 30; // the widest stop in the discrete set.
const NEUTRAL_VIBE = 2; // BUZZY — the mid level, neither floor nor ceiling.

// ───────────────────────────────────────────────────────────────────────
// Mapping layer
// ───────────────────────────────────────────────────────────────────────

/** The slice of `MemberVote` produced by interpreting one slot. The
 *  mapper merges these onto a default `MemberVote`. */
type MemberVotePatch = Partial<
  Pick<
    MemberVote,
    | "q1_vetoes"
    | "q2_budget"
    | "q3_walk_minutes"
    | "q4_vibe"
    | "q5_regret"
    | "soft_cuisine_vetoes"
  >
>;

/** Per-kind answer reader. Each takes the slot's `answer` payload and
 *  returns the `MemberVote` fields it contributes. */
type KindReader = (answer: Record<string, unknown>) => MemberVotePatch;

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Union two chip lists, order-preserving, deduped case-insensitively.
 *  `base` chips land first. Used to fold a diet-reason reroll's
 *  `vetoes_extra` additions into the immutable original `vetoes`. */
function unionChips(base: string[], extra: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chip of [...base, ...extra]) {
    const key = chip.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
  }
  return out;
}

const KIND_READERS: Readonly<Record<QuestionKind, KindReader>> = Object.freeze({
  dietary_veto: (answer) => {
    // `vetoes` is the immutable original quiz answer. `vetoes_extra`
    // holds dietary chips appended after the fact by a diet-reason
    // reroll (TB-10). The mapping layer is the single place these two
    // are unioned — the engine receives one flat `q1_vetoes`.
    const vetoes = asStringArray(answer.vetoes);
    const vetoesExtra = asStringArray(answer.vetoes_extra);
    const patch: MemberVotePatch = {
      q1_vetoes: vetoesExtra.length > 0
        ? unionChips(vetoes, vetoesExtra)
        : vetoes,
    };
    const soft = asStringArray(answer.soft_cuisine_vetoes);
    if (soft.length > 0) patch.soft_cuisine_vetoes = soft;
    return patch;
  },
  budget_cap: (answer) => ({
    q2_budget: asNumber(answer.tier, OPEN_BUDGET_TIER),
  }),
  walk_minutes: (answer) => ({
    q3_walk_minutes: asNumber(answer.minutes, OPEN_WALK_MINUTES),
  }),
  vibe: (answer) => ({
    q4_vibe: asNumber(answer.level, NEUTRAL_VIBE),
  }),
  regret: (answer) => {
    const raw = answer.scores;
    const scores: Record<string, number> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) scores[k] = v;
      }
    }
    return { q5_regret: scores };
  },
});

/** Map one generic `votes` row to the engine's `MemberVote`.
 *
 *  Dispatch is on `meta.question_kind` — the slot column name (`q1`..
 *  `q5`) is never inspected. A `null` slot contributes nothing and the
 *  field falls back to its no-constraint default. An unknown
 *  `question_kind` throws: a quiz that wrote a kind the engine cannot
 *  interpret is a bug, and silently dropping the answer would corrupt
 *  the verdict. */
export function mapVotesRowToMemberVote(row: VotesRow): MemberVote {
  // Start from the fully-permissive default vote.
  const vote: MemberVote = {
    user_id: row.user_id,
    display_name: row.display_name,
    q1_vetoes: [],
    q2_budget: OPEN_BUDGET_TIER,
    q3_walk_minutes: OPEN_WALK_MINUTES,
    q4_vibe: NEUTRAL_VIBE,
    q5_regret: {},
  };

  const slots: ReadonlyArray<QuestionSlot | null> = [
    row.q1,
    row.q2,
    row.q3,
    row.q4,
    row.q5,
  ];

  const softCuisine: string[] = [];

  for (const slot of slots) {
    if (slot == null) continue;
    const kind = slot.meta?.question_kind;
    if (typeof kind !== "string" || !QUESTION_KIND_SET.has(kind)) {
      throw new Error(
        `mapVotesRowToMemberVote: unknown question_kind "${String(kind)}" — ` +
          `expected one of ${QUESTION_KINDS.join(", ")}`,
      );
    }
    const reader = KIND_READERS[kind as QuestionKind];
    const patch = reader(slot.answer ?? {});
    if (patch.q1_vetoes !== undefined) vote.q1_vetoes = patch.q1_vetoes;
    if (patch.q2_budget !== undefined) vote.q2_budget = patch.q2_budget;
    if (patch.q3_walk_minutes !== undefined) {
      vote.q3_walk_minutes = patch.q3_walk_minutes;
    }
    if (patch.q4_vibe !== undefined) vote.q4_vibe = patch.q4_vibe;
    if (patch.q5_regret !== undefined) vote.q5_regret = patch.q5_regret;
    if (patch.soft_cuisine_vetoes !== undefined) {
      softCuisine.push(...patch.soft_cuisine_vetoes);
    }
  }

  if (softCuisine.length > 0) vote.soft_cuisine_vetoes = softCuisine;

  return vote;
}

// ───────────────────────────────────────────────────────────────────────
// Inverse — build the jsonb row a write path inserts
// ───────────────────────────────────────────────────────────────────────
//
// The current iOS quiz still produces the five typed answers. Until the
// PRD module-J quiz rework lands, the write path needs to wrap those
// answers in the generic envelope. This helper builds the canonical
// `q1`..`q5` slots from the legacy typed answers, so the existing quiz
// keeps writing — and the engine keeps reading — end-to-end.

export interface LegacyTypedAnswers {
  q1_vetoes: string[];
  q2_budget: number;
  q3_walk_minutes: number;
  q4_vibe: number;
  q5_regret: Record<string, number>;
  soft_cuisine_vetoes?: string[];
}

/** The five generic slots, ready to insert into `votes.q1`..`q5`. */
export interface VotesSlotInsert {
  q1: QuestionSlot;
  q2: QuestionSlot;
  q3: QuestionSlot;
  q4: QuestionSlot;
  q5: QuestionSlot;
}

/** Wrap the legacy typed quiz answers in the generic `{ meta, answer }`
 *  envelopes. The `meta.prompt` strings are the v1 quiz copy — carried
 *  for audit, never read by the mapper. */
export function buildVotesSlotsFromLegacyAnswers(
  answers: LegacyTypedAnswers,
): VotesSlotInsert {
  return {
    q1: {
      meta: {
        question_kind: "dietary_veto",
        prompt: "Anything off the menu tonight?",
      },
      answer:
        answers.soft_cuisine_vetoes && answers.soft_cuisine_vetoes.length > 0
          ? {
            vetoes: answers.q1_vetoes,
            soft_cuisine_vetoes: answers.soft_cuisine_vetoes,
          }
          : { vetoes: answers.q1_vetoes },
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
        question_kind: "walk_minutes",
        prompt: "How far are you willing to walk?",
      },
      answer: { minutes: answers.q3_walk_minutes },
    },
    q4: {
      meta: {
        question_kind: "vibe",
        prompt: "What's the energy you're after?",
      },
      answer: { level: answers.q4_vibe },
    },
    q5: {
      meta: {
        question_kind: "regret",
        prompt: "Which would you most regret missing?",
      },
      answer: { scores: answers.q5_regret },
    },
  };
}
