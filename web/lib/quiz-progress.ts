// GetToIt web — quiz-progress contract.
//
// tb-WF-12 — the web invitee resume (web-01 §B, decision doc §Q5).
//
// `members.quiz_progress` is a `jsonb not null default '{}'` column
// landed by tb-WF-7. It is the server-side working copy of an in-flight
// quiz: a Web invitee who answers Q1–Q3, closes the tab, and re-clicks
// the `/join/<roomId>` link is routed straight back to Q3 with their
// prior answers intact, instead of restarting at Q1.
//
// The column shape (per the migration comment) is
//   { "last_index": 0..5, "answers": { ... } }.
// The mobile Joined-card resume packs the `answers` slots in the
// `{ meta, answer }` votes envelope; the column is `jsonb` precisely so
// each platform can carry the shape it needs without a migration. The
// web shell only resumes its OWN writes, so this module uses a flat
// typed `answers` shape — there is no cross-platform read of a web
// invitee's `quiz_progress` (the verdict still rides `votes`, written
// at submit). The Q5 ratings are deliberately NOT persisted: a resume
// into Q5 re-fires the per-member candidate fetch (decision doc §Q5,
// inherited limitation owned by tb-WF-10), so the rater rebuilds its
// cards fresh and there is nothing to restore.
//
// Decoding is total: a malformed or empty column never throws — it
// degrades to a clean "start at Q1 with defaults" state. `quiz_progress`
// is a resume convenience, not a verdict-engine input; a corrupt working
// copy must cost the invitee a re-walk, never an error screen.

import { QUIZ_DEFAULTS } from "./quiz";

/** The five quiz steps. `lastIndex` is the question the invitee is on. */
const QUIZ_MIN_STEP = 1;
const QUIZ_MAX_STEP = 5;
const BUDGET_MIN = 1;
const BUDGET_MAX = 4;
const VIBE_MIN = 0;
const VIBE_MAX = 4;

/** The web invitee's in-flight quiz state, as the resume layer reads
 *  and writes it. A flat typed shape — the shell only ever round-trips
 *  its own writes. */
export type QuizProgressState = {
  /** The quiz step the invitee should resume on, 1..5. */
  lastIndex: number;
  /** Q1 — the craved cuisine ids. */
  cuisines: string[];
  /** Q1 — the mutually-exclusive "No preference" flag. */
  noPreference: boolean;
  /** Q2 — the spend-cap tier, 1..4. */
  budget: number;
  /** Q3 — the reputation chip id. */
  reputation: string;
  /** Q4 — the vibe-energy index, 0..4. */
  vibe: number;
};

/** The `members.quiz_progress` jsonb payload shape. */
export type QuizProgressPayload = {
  last_index: number;
  answers: {
    cuisines: string[];
    no_preference: boolean;
    budget: number;
    reputation: string;
    vibe: number;
    q1CuisineCravings: string[];
    q2SpendCap: number;
    q3Reputation: string;
    q4VibeEnergy: string;
  };
};

const VIBE_ANSWER_BY_INDEX = [
  "quiet",
  "chill",
  "social",
  "lively",
  "rowdy",
] as const;

/** Pack the in-flight quiz state into the `quiz_progress` jsonb payload
 *  the `members_progress_upsert` RPC writes. */
export function packQuizProgress(
  state: QuizProgressState,
): QuizProgressPayload {
  return {
    last_index: state.lastIndex,
    answers: {
      cuisines: [...state.cuisines],
      no_preference: state.noPreference,
      budget: state.budget,
      reputation: state.reputation,
      vibe: state.vibe,
      q1CuisineCravings: state.noPreference
        ? ["noPreference"]
        : [...state.cuisines],
      q2SpendCap: state.budget,
      q3Reputation: state.reputation,
      q4VibeEnergy: VIBE_ANSWER_BY_INDEX[state.vibe] ?? "social",
    },
  };
}

/** Decode a raw `members.quiz_progress` jsonb value back to a quiz
 *  state. Total — a `null`, an empty `{}` (the column default), or any
 *  malformed shape decodes to a fresh "start at Q1 with quiz defaults"
 *  state rather than throwing. */
export function unpackQuizProgress(raw: unknown): QuizProgressState {
  const fresh: QuizProgressState = {
    lastIndex: QUIZ_MIN_STEP,
    cuisines: [],
    noPreference: false,
    budget: QUIZ_DEFAULTS.budget,
    reputation: QUIZ_DEFAULTS.reputation,
    vibe: QUIZ_DEFAULTS.vibe,
  };
  if (!isObject(raw)) return fresh;

  const answers = isObject(raw.answers) ? raw.answers : {};

  return {
    lastIndex: clampInt(raw.last_index, QUIZ_MIN_STEP, QUIZ_MAX_STEP, fresh.lastIndex),
    cuisines: readStringArray(answers.cuisines),
    noPreference:
      typeof answers.no_preference === "boolean"
        ? answers.no_preference
        : fresh.noPreference,
    budget: clampInt(answers.budget, BUDGET_MIN, BUDGET_MAX, fresh.budget),
    reputation:
      typeof answers.reputation === "string" && answers.reputation.length > 0
        ? answers.reputation
        : fresh.reputation,
    vibe: clampInt(answers.vibe, VIBE_MIN, VIBE_MAX, fresh.vibe),
  };
}

// ── decode helpers ──────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a `string[]` off a raw value, dropping every non-string entry.
 *  A non-array decodes to `[]`. */
function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Read an integer, clamp it into `[min, max]`. A non-finite value
 *  (string, NaN, missing) falls back to `fallback`. */
function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
