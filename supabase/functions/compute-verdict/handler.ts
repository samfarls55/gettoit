// HTTP handler for the `compute-verdict` Edge Function — independent
// of the Supabase JS client so tests can exercise it with an in-memory
// data adapter and no network roundtrip.
//
// `index.ts` composes this handler with the real supabase-js adapter
// (service-role for verdicts/option_cuts writes) and the real
// Deno.serve entry point.
//
// Wire contract (POST body):
//   { "room_id": "<uuid>" }
//
// Response (200):
//   {
//     "verdict": {
//       "id":          "<uuid>",
//       "room_id":     "<uuid>",
//       "option_id":   "<uuid>",
//       "computed_at": "<iso-8601>",
//       "method":      "manual",
//       "rule_text":   "<string>"
//     },
//     "cuts": [
//       { "verdict_id": "<uuid>", "option_id": "<uuid>", "cut_reason": "<string>", "cut_text": "<string>" }
//     ]
//   }
//
// Error responses:
//   400 — invalid input
//   401 — missing JWT
//   404 — room not found / no votes / RLS hides the room. NOTE: an
//         empty candidate pool is NOT a 404 — bug-13 made it a terminal
//         `no_survivor` verdict (200), so the room never wedges in
//         `firing`.
//   409 — verdict already computed for this room
//   500 — engine misconfigured

import {
  type CandidateOption,
  type HardVeto,
  type VerdictMethod,
} from "../_shared/verdict-engine.ts";
import {
  type MemberFetchRow,
  type OptionInsertRow,
} from "../_shared/member-fetch-union.ts";
import type { MemberPreferenceInputs } from "../_shared/votes-schema.ts";
import {
  type VibeEmbeddingFetch,
  type VibeFitCandidate,
} from "../_shared/vibe-fit.ts";
import { createVerdictRunStore, runVerdictForRoom } from "./verdict-run.ts";

export {
  buildEligibleVibeFitCandidatesForVerdict,
  mergeHardVetoes,
  mergeQ1Vetoes,
  scoreVibeFitSignalForMember,
} from "./verdict-run.ts";

// TB-21 — re-export the union primitive's row types so the Edge entry
// point (`index.ts`) and the handler tests can bind them without a
// second import of `_shared/member-fetch-union.ts`.
export type { MemberFetchRow, OptionInsertRow };

// TB-23 — re-export the preference-input shape so the Edge entry point
// and the handler tests bind it without a second import of
// `_shared/votes-schema.ts`.
export type { MemberPreferenceInputs };

export interface ComputeVerdictEnv {
  /** Supabase project URL. */
  SUPABASE_URL?: string;
  /** Service-role key — bypasses RLS for verdict + cut writes. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Google Places API key for the server-owned verdict fetch. */
  GOOGLE_PLACES_API_KEY?: string;
  /** Server-side kill switch for transient Vibe Fit summary scoring. Legacy alias. */
  VIBE_FIT_ENABLED?: string;
  /** Server-side kill switch for transient Vibe embeddings. */
  VIBE_EMBEDDINGS_ENABLED?: string;
  /** Voyage API key for transient server-side Vibe embeddings. */
  VOYAGE_API_KEY?: string;
}

/** Read-side dependencies the handler needs. The Edge entry point
 *  binds these to supabase-js queries; tests bind them to in-memory
 *  fixtures. */
export interface ComputeVerdictDataAdapter {
  /** Verify the room exists. Returns null when RLS / lookup denies.
   *
   *  tb-WF-1 (workflow-overhaul) — the optional `plan_id` ties the
   *  in-flight Room to a durable Plan. When non-null, the handler
   *  invokes `setPlanDecidedActive(plan_id)` after the verdict insert
   *  so the Plan transitions `pending → decided-active`. Legacy
   *  rooms (created before the workflow-overhaul phase) carry NULL
   *  here and the Plan transition is skipped entirely. The supabase
   *  adapter selects `id, plan_id` so the field is always populated
   *  one-way-or-the-other. */
  fetchRoom(
    room_id: string,
  ): Promise<{ id: string; plan_id?: string | null } | null>;
  /** Current active member user IDs for the room. Exited members have
   *  no `members` row and must not contribute fetches, votes, profile
   *  vetoes, budgets, or preference signals to the verdict. Optional
   *  for legacy tests; when omitted, the handler preserves the prior
   *  all-votes behavior. */
  fetchActiveMemberIds?(room_id: string): Promise<string[]>;
  /** Fetch candidate options for the room. */
  fetchOptions(room_id: string): Promise<RoomOptionRow[]>;
  /** TB-10 — run the server-owned final Google verdict fetch cycle.
   *  When present, this is the source of truth for the final candidate
   *  pool. Q5 probe fetches are not reused for verdict ranking. */
  fetchGoogleVerdictCandidates?(
    room_id: string,
    context: GoogleVerdictFetchContext,
  ): Promise<GoogleVerdictCandidateRow[]>;
  /** TB-21 — fetch every member's persisted raw Foursquare fetch for
   *  the room (`member_fetches` rows). The handler unions these into
   *  the candidate pool and writes the union into `options` before the
   *  engine reads. Optional — tests that seed `options` directly omit
   *  it; the handler treats absence as "no persisted fetches." */
  fetchMemberFetches?(room_id: string): Promise<MemberFetchRow[]>;
  /** TB-21 — write the unioned candidate pool into `options`. Called
   *  only when `options` is empty for the room and `member_fetches`
   *  yielded a non-empty union. Optional — omitted by tests that seed
   *  `options` directly. */
  insertOptions?(rows: OptionInsertRow[]): Promise<void>;
  /** Fetch member votes for the room. `display_name` is sourced from
   *  the call-site (the Edge Function reads the join with members /
   *  auth.users; the test seeds it directly). */
  fetchVotes(room_id: string): Promise<MemberVoteRow[]>;
  /** Insert the verdict row. Returns the inserted id + computed_at. */
  insertVerdict(row: VerdictInsert): Promise<VerdictRow>;
  /** Insert the option_cuts rows for a verdict. */
  insertOptionCuts(rows: OptionCutInsert[]): Promise<void>;
  /** Persist the top-four Google Verdict slate. */
  insertVerdictSlateEntries?(rows: VerdictSlateEntryInsert[]): Promise<void>;
  /** Check whether a verdict already exists for this room (idempotency). */
  existingVerdict(room_id: string): Promise<VerdictRow | null>;
  /** Flip rooms.status to `verdict_ready` after the verdict row
   *  lands. The iOS client subscribes to Realtime Postgres changes on
   *  `rooms.status` to route into S05; the flip from `firing` to
   *  `verdict_ready` is the fire-side handshake. Optional — tests
   *  may omit. */
  markRoomVerdictReady?(room_id: string): Promise<void>;
  /** Emit a `verdict_ready` broadcast on `room:{room_id}` so iOS
   *  subscribers route into S05 within the Realtime window. Optional
   *  — production wires this to supabase-js Realtime, tests omit. */
  emitVerdictReadyBroadcast?(
    room_id: string,
    verdict_id: string,
  ): Promise<void>;
  /** Fetch the room's stored `radius_meters` so the engine can use it
   *  as the starting radius for the cascade. Returns null when the
   *  row doesn't carry the field (legacy / pre-TB-03 rooms). */
  fetchRoomRadius(room_id: string): Promise<number | null>;
  /** Drop the prior verdict + cascaded option_cuts (FK cascade) for a
   *  room. Called by the widen-radius re-run path so a fresh verdict
   *  can be inserted under the `verdicts.room_id` UNIQUE constraint. */
  deleteVerdictForRoom(room_id: string): Promise<void>;
  /** TB-10 — fetch the reroll-state slice the engine needs:
   *    * `excluded_option_ids` — option ids appended by `avail`-reason
   *      rerolls. Filter the pool before pruning.
   *    * `budget_tier_override` / `walk_minutes_override` — engine-
   *      tightened caps written by `cost` / `dist` rerolls. Merged
   *      into per-member caps as additional caps (engine takes
   *      MIN(member, override)).
   *    * `last_reroll_reason` — null on a clean run; one of
   *      `cost|dist|mood|diet|avail` after the apply_reroll RPC ran.
   *      The handler forwards it into `VerdictEngineInput.reroll_reason`
   *      and stamps it onto the new `verdicts.reroll_reason` column.
   *  Optional — tests that don't exercise the reroll path omit it; the
   *  handler treats absence as "all defaults / no reroll." */
  fetchRoomRerollState?(room_id: string): Promise<RoomRerollState>;
  /** TB-10 — fetch the human name of the option that the prior
   *  verdict named. Used to populate
   *  `VerdictEngineInput.previous_winner_name` for the reroll prefix.
   *  Returns null when the prior verdict was a `no_survivor` (no
   *  option_id) or when the option lookup fails (RLS / race). */
  fetchPreviousWinnerName?(room_id: string): Promise<string | null>;
  /** TB-12 — fetch each member's sticky per-account profile vetoes
   *  (allergies, dietary restrictions, cuisine NEVERS). Profile data
   *  lives on the account record, NOT the per-session `votes` row, so
   *  the handler reads it here and folds the result into every
   *  member's `hard_vetoes` before calling the engine — feeding the
   *  same generic EBA channel the schema mapping layer uses.
   *
   *  The return is keyed by `user_id`; a user with no profile row is
   *  simply absent from the map (treated as "no profile vetoes").
   *  Optional — tests that don't exercise profile vetoes omit it; the
   *  handler treats absence as "every member has an empty profile." */
  fetchProfileVetoes?(user_ids: string[]): Promise<Record<string, HardVeto[]>>;
  /** tb-WF-1 (workflow-overhaul) — transition the parent Plan from
   *  `pending` to `decided-active`. Called after a successful verdict
   *  insert when the Room carries a non-null `plan_id`. Wraps the
   *  `set_plan_decided_active(p_plan_id uuid)` Postgres function,
   *  which is SECURITY DEFINER and idempotent (a non-pending plan is
   *  a no-op). Best-effort — a failure is logged but does NOT fail
   *  the verdict response, same pattern as `markRoomVerdictReady`
   *  and `emitVerdictReadyBroadcast`. Optional — tests omit it; the
   *  handler treats absence as "no Plan to transition." */
  setPlanDecidedActive?(plan_id: string): Promise<void>;
}

/** Aggregate of the reroll-state slice the engine reads from `rooms`
 *  and from `votes.q1_vetoes_extra`. See the apply_reroll RPC + the
 *  `20260514000300000_rerolls.sql` migration for the column meanings. */
export interface RoomRerollState {
  /** Option ids removed from the candidate pool before pruning. */
  excluded_option_ids: string[];
  /** Engine-tightened budget tier cap. Null = no override. */
  budget_tier_override: number | null;
  /** Engine-tightened walk-minutes cap. Null = no override. */
  walk_minutes_override: number | null;
  /** Most recent reroll reason on the room. Drives the rule_text
   *  prefix + the verdicts.reroll_reason stamp. */
  last_reroll_reason: "cost" | "dist" | "mood" | "diet" | "avail" | null;
}

export interface ComputeVerdictDeps {
  env: ComputeVerdictEnv;
  buildDataAdapter: (env: ComputeVerdictEnv) => ComputeVerdictDataAdapter;
  vibeEmbeddingFetch?: VibeEmbeddingFetch;
}

export interface RoomOptionRow {
  /** `options.id` — uuid. */
  id: string;
  /** Google provider identity, present after the Google baseline. */
  google_place_id?: string;
  place_provider?: "google";
  /** Shape mirrors `options.payload` JSONB. The engine reads the slice
   *  it cares about from this nested payload. */
  payload?: {
    fsq_place_id?: string;
    name?: string;
    price_tier?: number | null;
    dietary_tags?: string[];
    categories?: string[];
    /** Distance from the room's search centre in meters. Used by the
     *  TB-11 empty-floor cascade's radius-widen step. PlacesProxy
     *  populates this in its `ShapedPlace` and the iOS / Edge writes it
     *  through the options payload. */
    distance_meters?: number | null;
    /** TB-23 — Foursquare 0..10 venue rating. Read by the server-side
     *  venue classifier for the reputation axis. */
    rating?: number | null;
    /** TB-23 — Foursquare total-ratings count. Read by the classifier
     *  for the pool-relative reputation terciles. */
    total_ratings?: number | null;
    /** Google user rating count. Kept transient in option payloads for
     *  eligibility/scoring; never surfaced as verdict display content. */
    user_rating_count?: number | null;
    /** TB-23 — Foursquare ISO-8601 record-creation date. Read by the
     *  classifier for the reputation age check. */
    date_created?: string | null;
    /** TB-23 — Foursquare crowd-sourced `tastes` tag cloud. Read by the
     *  classifier for the vibe nudge. */
    tastes?: string[];
    current_open_now?: boolean | null;
    regular_opening_periods?: CandidateOption["regular_opening_periods"];
    dine_in?: boolean | null;
    takeout?: boolean | null;
  };
  vibe_fit_candidate?: VibeFitCandidate;
}

export interface GoogleVerdictFetchContext {
  active_member_ids: string[];
  votes: MemberVoteRow[];
}

export interface GoogleVerdictCandidateRow {
  google_place_id: string;
  payload: NonNullable<RoomOptionRow["payload"]>;
  vibe_fit_candidate?: VibeFitCandidate;
}

export interface MemberVoteRow {
  user_id: string;
  display_name: string;
  /** Q1-era dietary veto chips — hard veto in the EBA prune. */
  q1_vetoes: string[];
  /** Q2 spend cap tier (1..4) — hard veto in the EBA prune. */
  q2_budget: number;
  /** Generic schema-driven hard vetoes — TB-12 profile allergies /
   *  dietary restrictions / cuisine NEVERS. Empty for a session with
   *  no profile data. */
  hard_vetoes: HardVeto[];
  /** Per-candidate cached scores — keyed by `options.id`, valued 1..5.
   *  The legacy / replay scoring path. Pre-TB-23 the Q5 probe wrote a
   *  per-candidate map here and the engine read it directly. After
   *  TB-23 the live path builds a `prefFn` from `preference_inputs`
   *  instead; `scores` is read by the engine only when a vote row
   *  carries NO `preference_inputs` (the test / replay path). Absent /
   *  partial maps fall back to the neutral threshold inside the
   *  engine. */
  scores: Record<string, number>;
  /** TB-23 — the member's preference inputs: their stated Q1/Q3/Q4
   *  profile + their three Q5 factorial card ratings. When present, the
   *  handler builds the member's `prefFn` from these and the classified
   *  candidate pool, and injects it into the engine `MemberVote` —
   *  scoring the FULL pool on real preferences. Absent for the legacy
   *  scores path (the engine then reads the static `scores` map). */
  preference_inputs?: MemberPreferenceInputs;
  /** TB-10 — Q1 dietary chips appended after the initial vote via a
   *  `diet`-reason reroll. The handler merges these with `q1_vetoes`
   *  before feeding the engine so the EBA filter sees the union. */
  q1_vetoes_extra?: string[];
}

export interface VerdictInsert {
  room_id: string;
  /** Null for `no_survivor` — the engine emitted no winner. */
  option_id: string | null;
  method: VerdictMethod;
  rule_text: string;
  winner_place_provider?: "google" | null;
  winner_google_place_id?: string | null;
  final_fit_score?: number | null;
  scoring_version?: string | null;
  receipts?: unknown[];
  /** TB-10 — set when the verdict was produced after an apply_reroll
   *  RPC call. Drives the rule_chip prefix on subsequent renders.
   *  Null on clean runs. */
  reroll_reason?: "cost" | "dist" | "mood" | "diet" | "avail" | null;
}

export interface VerdictRow {
  id: string;
  room_id: string;
  option_id: string | null;
  method: string;
  rule_text: string;
  computed_at: string;
}

export interface OptionCutInsert {
  verdict_id: string;
  option_id: string;
  cut_reason: string;
  cut_text: string;
}

export interface VerdictSlateEntryInsert {
  verdict_id: string;
  room_id: string;
  slate_rank: number;
  place_provider: "google";
  google_place_id: string;
  final_fit_score: number;
  scoring_version: string;
  receipts: unknown[];
}

// ───────────────────────────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function handleRequest(
  req: Request,
  deps: ComputeVerdictDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, {
      status: 405,
      headers: { ...corsHeaders(), Allow: "POST" },
    });
  }

  // The Supabase Edge Runtime forwards the caller's JWT. Auth is
  // honored by the data adapter at the supabase-js layer; we still
  // require the header so unauthenticated calls fail fast.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  if (!deps.env.SUPABASE_URL || !deps.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "compute_verdict_misconfigured" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "invalid_json" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const roomId = (body as { room_id?: unknown })?.room_id;
  if (!isUuid(roomId)) {
    return jsonResponse({
      error: "invalid_input",
      detail: "room_id must be a uuid",
    }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Optional `method` field — TB-07's auto-fire trigger and cron pass
  // `quorum` / `deadline` so the durable verdict row reflects how the
  // fire actually happened. Anything else falls back to `manual` (the
  // legacy TB-06 behavior).
  const rawMethod = (body as { method?: unknown })?.method;
  const method: VerdictMethod =
    (rawMethod === "quorum" || rawMethod === "deadline") ? rawMethod : "manual";

  // Optional widen-radius override (S05 no-survivor "Widen radius"
  // CTA, TB-09). Plan-backed Rooms now lock search area parameters,
  // so a numeric override is rejected before any adapter calls.
  const rawWiden = (body as { radius_meters_override?: unknown })
    ?.radius_meters_override;
  if (typeof rawWiden === "number" && Number.isFinite(rawWiden)) {
    return jsonResponse({
      error: "search_area_locked",
      detail:
        "Room parameters are locked; start a new decision to change them.",
    }, {
      status: 409,
      headers: corsHeaders(),
    });
  }
  if (rawWiden !== undefined) {
    return jsonResponse({
      error: "invalid_input",
      detail: "radius_meters_override must be a number when supplied",
    }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const run = await runVerdictForRoom({
    roomId,
    method,
    env: deps.env,
    store: createVerdictRunStore(deps.buildDataAdapter(deps.env)),
    vibeEmbeddingFetch: deps.vibeEmbeddingFetch,
  });

  switch (run.kind) {
    case "already_computed":
      return jsonResponse({
        verdict: run.verdict,
        cuts: [],
        already_computed: true,
      }, { status: 200, headers: corsHeaders() });
    case "room_not_found":
      return jsonResponse({ error: "room_not_found" }, {
        status: 404,
        headers: corsHeaders(),
      });
    case "no_votes":
      return jsonResponse({ error: "no_votes" }, {
        status: 404,
        headers: corsHeaders(),
      });
    case "engine_error":
      return jsonResponse({ error: "engine_error", detail: run.detail }, {
        status: 500,
        headers: corsHeaders(),
      });
    case "computed":
      return jsonResponse({
        verdict: run.verdict,
        cuts: run.cuts,
        receipts: run.receipts,
        surviving_hard_needs: run.surviving_hard_needs,
        radius_meters_used: run.radius_meters_used,
        relax_chain_applied: run.relax_chain_applied,
      }, { status: 200, headers: corsHeaders() });
  }
}
