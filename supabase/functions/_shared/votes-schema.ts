// votes-schema — generic Q1..Q5 jsonb storage shape + the schema-driven
// mapping layer the verdict engine consumes its input through (TB-04,
// widened by TB-11).
//
// Why this module exists
// ──────────────────────
// The `votes` table used to carry one typed column per quiz question
// (`q1_vetoes text[]`, `q2_budget int`, `q3_walk_minutes int`,
// `q4_vibe int`, `q5_regret jsonb`). That coupled the storage schema
// to a fixed quiz: any change to the quiz — reordering questions,
// rewording a prompt, swapping option copy — needed a migration, and
// the verdict engine read those columns by hardcoded field name.
//
// The v1.1 quiz redesign (PRD module H) makes the quiz content
// session-variable. So `votes` carries five GENERIC jsonb slots,
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
// TB-11 widening
// ──────────────
// The TB-06 quiz rework reworded Q1 → cuisine craving and Q3 →
// reputation, writing the new `cuisine_craving` and `reputation`
// question kinds. TB-06 left `votes-schema.ts` untouched and flagged
// that the verdict-engine rewrite (TB-11) must extend the kind taxonomy
// before a verdict can fire over a v1.1-quiz vote. TB-11 does that here:
// the kind set gains `cuisine_craving` and `reputation`, and the engine
// `MemberVote` shape moves to the worst-off-protecting pipeline's
// inputs — `hard_vetoes` + a per-candidate `scores` map.

import type { HardVeto, MemberVote } from "./verdict-engine.ts";
import type { Axis, Q5MemberProfile, Q5Rating } from "./preference-function.ts";

// ───────────────────────────────────────────────────────────────────────
// Question-kind taxonomy
// ───────────────────────────────────────────────────────────────────────
//
// The kinds the verdict engine + the quiz currently write. Each maps to
// the `MemberVote` field(s) it contributes:
//
//   * dietary_veto    — Q1-era dietary chips → `q1_vetoes` (hard veto).
//   * budget_cap      — Q2 spend cap → `q2_budget` (hard veto).
//   * cuisine_craving — Q1 (v1.1) cuisine craving. A soft preference
//                       scored by `prefFn`, NOT a hard veto — it
//                       contributes nothing to the EBA prune. The
//                       member-local `prefFn`/`scores` carry it.
//   * reputation      — Q3 (v1.1) reputation/discovery. Soft, same.
//   * walk_minutes    — legacy Q3. Retired from the v1.1 quiz (moved to
//                       the parameters bucket) but kept in the taxonomy
//                       so a legacy vote row still maps without a throw.
//   * vibe            — Q4 vibe energy. Soft, scored by `prefFn`.
//   * regret          — Q5 preference probe. The `answer.scores` map is
//                       the member's per-candidate cached score, which
//                       the engine reads directly as the satisficing /
//                       maximin score.
//   * profile_veto    — TB-12 profile allergies / dietary restrictions /
//                       cuisine NEVERS. Feeds the engine's generic
//                       `hard_vetoes` channel. Not written by the quiz
//                       (profile data is sticky, set on the account);
//                       the kind exists so a profile slot maps cleanly
//                       once TB-12 wires the seeding path.

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

// ───────────────────────────────────────────────────────────────────────
// Mapping layer
// ───────────────────────────────────────────────────────────────────────

/** The slice of `MemberVote` produced by interpreting one slot. The
 *  mapper merges these onto a default `MemberVote`. Soft-preference
 *  kinds (`cuisine_craving`, `reputation`, `vibe`, `walk_minutes`)
 *  contribute nothing to the engine's hard inputs — they are carried by
 *  the per-member `prefFn` / `scores`, which the pool manager builds —
 *  so they produce an empty patch. */
type MemberVotePatch = Partial<
  Pick<MemberVote, "q1_vetoes" | "q2_budget" | "hard_vetoes" | "scores">
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

/** Read a per-candidate `scores` map from a `regret`-kind answer
 *  payload. The v1.1 Q5 probe writes `answer.scores` as
 *  `{ <venue_id>: <1..5 rating> }` — the member's cached per-candidate
 *  score, which the verdict engine reads directly. */
function readScores(raw: unknown): Record<string, number> {
  const scores: Record<string, number> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) scores[k] = v;
    }
  }
  return scores;
}

const KIND_READERS: Readonly<Record<QuestionKind, KindReader>> = Object.freeze({
  dietary_veto: (answer) => {
    // `vetoes` is the immutable original quiz answer. `vetoes_extra`
    // holds dietary chips appended after the fact by a diet-reason
    // reroll (TB-10). The mapping layer is the single place these two
    // are unioned — the engine receives one flat `q1_vetoes`.
    const vetoes = asStringArray(answer.vetoes);
    const vetoesExtra = asStringArray(answer.vetoes_extra);
    return {
      q1_vetoes: vetoesExtra.length > 0
        ? unionChips(vetoes, vetoesExtra)
        : vetoes,
    };
  },
  budget_cap: (answer) => ({
    q2_budget: asNumber(answer.tier, OPEN_BUDGET_TIER),
  }),
  // Soft preference — carried by `prefFn` / `scores`, not a hard input.
  // The reader produces an empty patch: the cuisine craving never
  // prunes a venue, it only scores one.
  cuisine_craving: (_answer) => ({}),
  // Soft preference — same.
  reputation: (_answer) => ({}),
  // Legacy Q3 — retired from the v1.1 quiz (walk-minutes moved to the
  // parameters bucket). Kept so a legacy vote row maps without a throw;
  // contributes nothing.
  walk_minutes: (_answer) => ({}),
  // Soft preference — same.
  vibe: (_answer) => ({}),
  regret: (answer) => ({
    // The Q5 probe's per-candidate ratings ARE the member's cached
    // score map for the verdict engine.
    scores: readScores(answer.scores),
  }),
  profile_veto: (answer) => {
    // TB-12 profile vetoes — allergies, dietary restrictions, cuisine
    // NEVERS. Each entry is a `{ kind, token }` hard veto consumed by
    // the engine's EBA prune. The payload shape is
    // `answer.vetoes: HardVeto[]`.
    const raw = answer.vetoes;
    const hardVetoes: HardVeto[] = [];
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (entry && typeof entry === "object") {
          const kind = (entry as Record<string, unknown>).kind;
          const token = (entry as Record<string, unknown>).token;
          if (
            (kind === "dietary" || kind === "cuisine_never" || kind === "tag") &&
            typeof token === "string"
          ) {
            hardVetoes.push({ kind, token });
          }
        }
      }
    }
    return { hard_vetoes: hardVetoes };
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
    hard_vetoes: [],
    scores: {},
  };

  const slots: ReadonlyArray<QuestionSlot | null> = [
    row.q1,
    row.q2,
    row.q3,
    row.q4,
    row.q5,
  ];

  const hardVetoes: HardVeto[] = [];

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
    if (patch.scores !== undefined) vote.scores = patch.scores;
    if (patch.hard_vetoes !== undefined) {
      hardVetoes.push(...patch.hard_vetoes);
    }
  }

  if (hardVetoes.length > 0) vote.hard_vetoes = hardVetoes;

  return vote;
}

// ───────────────────────────────────────────────────────────────────────
// Inverse — build the jsonb row a write path inserts
// ───────────────────────────────────────────────────────────────────────
//
// The current iOS quiz still produces typed answers per question. Until
// every write path emits the generic envelope natively, this helper
// wraps the typed answers in the `{ meta, answer }` slot shape, so the
// existing quiz keeps writing — and the engine keeps reading —
// end-to-end.

export interface LegacyTypedAnswers {
  /** Q1-era dietary veto chips. */
  q1_vetoes: string[];
  /** Q2 spend cap tier. */
  q2_budget: number;
  /** Q1 (v1.1) craved cuisine tokens. Soft preference. */
  cuisines?: string[];
  /** Q3 (v1.1) reputation chip. Soft preference. */
  reputation?: string;
  /** Q4 vibe energy index 0..4. Soft preference. */
  q4_vibe?: number;
  /** Q5 per-candidate excitement ratings, keyed by venue id. */
  q5_scores: Record<string, number>;
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
 *  Q1 carries the v1.1 `cuisine_craving` kind; Q3 carries `reputation`.
 *  The `meta.prompt` strings are illustrative session copy — carried
 *  for audit, never read by the mapper. */
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
      answer: { scores: answers.q5_scores },
    },
  };
}

// ───────────────────────────────────────────────────────────────────────
// TB-23 — preference-input extraction (the prefFn build path)
// ───────────────────────────────────────────────────────────────────────
//
// `mapVotesRowToMemberVote` produces the engine's HARD inputs
// (`q1_vetoes`, `q2_budget`, `hard_vetoes`) plus — pre-TB-23 — a
// per-candidate `scores` map read straight from the `regret` slot's
// three Q5 card ratings.
//
// TB-23 changes the verdict's live scoring. The engine no longer reads
// `votes.q5.answer.scores` as the candidate scores; instead the handler
// builds each member's `prefFn` (`buildPreferenceFunction`,
// `preference-function.ts`) from the member's stated Q1/Q3/Q4 profile
// plus their three Q5 factorial ratings, and scores the FULL `options`
// pool with it. After TB-23 the Q5 ratings are the *preference probe*
// that feeds the prefFn build — they are no longer the candidate
// scores.
//
// `mapVotesRowToPreferenceInputs` is the slice of the mapping layer
// that produces those preference inputs. It dispatches on
// `meta.question_kind`, same as `mapVotesRowToMemberVote` — the slot
// column name is never inspected. A `null` slot falls back to the
// soft-default "no preference" answer for its axis.
//
// The `regret` slot's `answer` carries the canonical v1.1 probe shape:
//
//     answer.ratings: [{ droppedAxis, score }, ...]
//
// — the three Q5 factorial card ratings, one per axis. (The pre-TB-23
// `answer.scores` per-candidate map is left untouched on the slot for
// `mapVotesRowToMemberVote`'s legacy `scores` path / audit; the
// preference-input extractor reads `ratings`.)

/** The preference inputs for one member — everything
 *  `buildPreferenceFunction` needs to construct that member's
 *  `prefFn`. */
export interface MemberPreferenceInputs {
  user_id: string;
  /** The member's stated Q1/Q3/Q4 profile. */
  member: Q5MemberProfile;
  /** The three Q5 factorial card ratings — the preference probe. May be
   *  empty when the session had no Q5 slot; `buildPreferenceFunction`
   *  tolerates an empty probe (the equal-weight prior survives). */
  q5Ratings: Q5Rating[];
}

/** Soft-default member profile — the most permissive "no preference"
 *  answer for every axis. An unasked question contributes no signal. */
const NO_PREFERENCE_MEMBER: Q5MemberProfile = Object.freeze({
  cuisines: [],
  reputation: "no_preference",
  vibe: 2,
});

const Q5_AXES: ReadonlySet<string> = new Set(["cuisine", "reputation", "vibe"]);

/** Read the three Q5 card ratings from a `regret`-kind answer payload.
 *  The canonical v1.1 shape is `answer.ratings: [{ droppedAxis, score
 *  }]`. Entries with an unknown axis or a non-numeric score are
 *  dropped — a malformed entry must never corrupt the prefFn build. */
function readQ5Ratings(raw: unknown): Q5Rating[] {
  if (!Array.isArray(raw)) return [];
  const out: Q5Rating[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const axis = (entry as Record<string, unknown>).droppedAxis;
    const score = (entry as Record<string, unknown>).score;
    if (
      typeof axis === "string" && Q5_AXES.has(axis) &&
      typeof score === "number" && Number.isFinite(score)
    ) {
      out.push({ droppedAxis: axis as Axis, score });
    }
  }
  return out;
}

/** Map one generic `votes` row to the member's preference inputs.
 *
 *  Dispatch is on `meta.question_kind`. An unknown kind throws — same
 *  contract as `mapVotesRowToMemberVote`: a quiz that wrote a kind the
 *  engine cannot interpret is a bug.
 *
 *  Hard-input kinds (`dietary_veto`, `budget_cap`, `profile_veto`,
 *  `walk_minutes`) contribute nothing here — they are read by
 *  `mapVotesRowToMemberVote`. This extractor is concerned only with the
 *  soft preference axes. */
export function mapVotesRowToPreferenceInputs(
  row: VotesRow,
): MemberPreferenceInputs {
  let cuisines: string[] = [...NO_PREFERENCE_MEMBER.cuisines];
  let reputation = NO_PREFERENCE_MEMBER.reputation;
  let vibe = NO_PREFERENCE_MEMBER.vibe;
  let q5Ratings: Q5Rating[] = [];

  const slots: ReadonlyArray<QuestionSlot | null> = [
    row.q1,
    row.q2,
    row.q3,
    row.q4,
    row.q5,
  ];

  for (const slot of slots) {
    if (slot == null) continue;
    const kind = slot.meta?.question_kind;
    if (typeof kind !== "string" || !QUESTION_KIND_SET.has(kind)) {
      throw new Error(
        `mapVotesRowToPreferenceInputs: unknown question_kind "${String(kind)}" — ` +
          `expected one of ${QUESTION_KINDS.join(", ")}`,
      );
    }
    const answer = slot.answer ?? {};
    switch (kind as QuestionKind) {
      case "cuisine_craving":
        cuisines = asStringArray(answer.cuisines);
        break;
      case "reputation": {
        const r = answer.reputation;
        reputation = typeof r === "string" && r.length > 0
          ? r
          : NO_PREFERENCE_MEMBER.reputation;
        break;
      }
      case "vibe":
        vibe = asNumber(answer.level, NO_PREFERENCE_MEMBER.vibe);
        break;
      case "regret":
        q5Ratings = readQ5Ratings(answer.ratings);
        break;
      // Hard-input + legacy kinds contribute no preference signal.
      case "dietary_veto":
      case "budget_cap":
      case "walk_minutes":
      case "profile_veto":
        break;
    }
  }

  return {
    user_id: row.user_id,
    member: { cuisines, reputation, vibe },
    q5Ratings,
  };
}
