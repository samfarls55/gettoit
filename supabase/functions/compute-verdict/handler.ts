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
//   404 — room not found (no options / no votes / RLS hides the room)
//   409 — verdict already computed for this room
//   422 — TB-06 scope-out: no survivors (TB-09 lands the terminal)
//   500 — engine misconfigured

import {
  type CandidateOption,
  computeVerdict,
  type HardVeto,
  type MemberVote,
  type VerdictEngineOutput,
  type VerdictMethod,
} from "../_shared/verdict-engine.ts";

/** Hard upper bound for `radius_meters_override`. S05's widen-radius
 *  slider exposes 1..10 mi (1609..16093 m); the handler clamps
 *  defensively against client tampering or accidental wild values. */
const WIDEN_RADIUS_HARD_CAP_METERS = 16093;
const WIDEN_RADIUS_HARD_MIN_METERS = 805;

export interface ComputeVerdictEnv {
  /** Supabase project URL. */
  SUPABASE_URL?: string;
  /** Service-role key — bypasses RLS for verdict + cut writes. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/** Read-side dependencies the handler needs. The Edge entry point
 *  binds these to supabase-js queries; tests bind them to in-memory
 *  fixtures. */
export interface ComputeVerdictDataAdapter {
  /** Verify the room exists. Returns null when RLS / lookup denies. */
  fetchRoom(room_id: string): Promise<{ id: string } | null>;
  /** Fetch candidate options for the room. */
  fetchOptions(room_id: string): Promise<RoomOptionRow[]>;
  /** Fetch member votes for the room. `display_name` is sourced from
   *  the call-site (the Edge Function reads the join with members /
   *  auth.users; the test seeds it directly). */
  fetchVotes(room_id: string): Promise<MemberVoteRow[]>;
  /** Insert the verdict row. Returns the inserted id + computed_at. */
  insertVerdict(row: VerdictInsert): Promise<VerdictRow>;
  /** Insert the option_cuts rows for a verdict. */
  insertOptionCuts(rows: OptionCutInsert[]): Promise<void>;
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
  emitVerdictReadyBroadcast?(room_id: string, verdict_id: string): Promise<void>;
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
}

export interface RoomOptionRow {
  /** `options.id` — uuid. */
  id: string;
  /** Shape mirrors `options.payload` JSONB. The engine reads the slice
   *  it cares about from this nested payload. */
  payload: {
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
  };
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
   *  The Q5 preference probe (TB-08) writes these; the verdict engine
   *  reads them as the satisficing / maximin score. Absent / partial
   *  maps fall back to the neutral threshold inside the engine. */
  scores: Record<string, number>;
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

/** TB-10 — merge the original Q1 dietary chips with the diet-reason
 *  reroll additions. Dedupe on lowercase token; order preserved per the
 *  spec's "Q1 chips" + reroll-extra append rule. */
export function mergeQ1Vetoes(
  base: readonly string[],
  extra: readonly string[] | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chip of base) {
    const key = chip.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
  }
  if (!extra) return out;
  for (const chip of extra) {
    const key = chip.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
  }
  return out;
}

/** TB-12 — union session hard vetoes with the member's sticky profile
 *  vetoes. Deduped on the `(kind, token)` pair (token compared
 *  case-insensitively, matching the engine's own normalization);
 *  `session` entries land first, `profile` entries are appended. The
 *  engine's veto lookup is set-based so a duplicate would not change
 *  the verdict — the dedupe keeps the engine input minimal. */
export function mergeHardVetoes(
  session: readonly HardVeto[],
  profile: readonly HardVeto[],
): HardVeto[] {
  const out: HardVeto[] = [];
  const seen = new Set<string>();
  for (const v of [...session, ...profile]) {
    const key = `${v.kind} ${v.token.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
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
    return jsonResponse({ error: "invalid_input", detail: "room_id must be a uuid" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Optional `method` field — TB-07's auto-fire trigger and cron pass
  // `quorum` / `deadline` so the durable verdict row reflects how the
  // fire actually happened. Anything else falls back to `manual` (the
  // legacy TB-06 behavior).
  const rawMethod = (body as { method?: unknown })?.method;
  const method: VerdictMethod = (rawMethod === "quorum" || rawMethod === "deadline")
    ? rawMethod
    : "manual";

  // Optional widen-radius override (S05 no-survivor "Widen radius"
  // CTA, TB-09). When supplied, the handler bypasses the standard
  // idempotency check for prior `no_survivor` verdicts so the engine
  // can re-run at the wider radius. Clamped to the 1..10 mi window
  // exposed by the S05 slider.
  const rawWiden = (body as { radius_meters_override?: unknown })?.radius_meters_override;
  let widenOverride: number | null = null;
  if (typeof rawWiden === "number" && Number.isFinite(rawWiden)) {
    widenOverride = Math.max(
      WIDEN_RADIUS_HARD_MIN_METERS,
      Math.min(WIDEN_RADIUS_HARD_CAP_METERS, Math.round(rawWiden)),
    );
  } else if (rawWiden !== undefined) {
    return jsonResponse({
      error: "invalid_input",
      detail: "radius_meters_override must be a number when supplied",
    }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const data = deps.buildDataAdapter(deps.env);

  // TB-10 — read the reroll-state slice up front so the idempotency
  // check can short-circuit on reroll runs: when the room has a
  // `last_reroll_reason` set, the apply_reroll RPC just deleted the
  // prior verdict and tightened the room state; we must run the
  // engine fresh and NOT return a stale "already_computed" payload.
  const rerollState: RoomRerollState | null = data.fetchRoomRerollState
    ? await data.fetchRoomRerollState(roomId)
    : null;
  const isRerollRun = (rerollState?.last_reroll_reason ?? null) !== null;

  // Idempotency — if a verdict already exists for this room, return it
  // with the cuts, 200. TB-07 will use ON CONFLICT to support trigger-
  // retry. The widen-radius re-run path is the one exception: when
  // the caller supplies `radius_meters_override` AND the existing
  // verdict is a `no_survivor`, drop the old verdict (cascading the
  // option_cuts) so the engine can write a fresh row. TB-10 widens
  // the exception list — when `last_reroll_reason` is set on the
  // room, the apply_reroll RPC already deleted the prior verdict;
  // any verdict we see now is post-reroll and must NOT be re-returned
  // as "already_computed."
  const existing = await data.existingVerdict(roomId);
  if (existing && !isRerollRun) {
    if (widenOverride !== null && existing.method === "no_survivor") {
      await data.deleteVerdictForRoom(roomId);
    } else {
      return jsonResponse({
        verdict: existing,
        cuts: [],
        already_computed: true,
      }, { status: 200, headers: corsHeaders() });
    }
  } else if (existing && isRerollRun) {
    // Race: a stale verdict slipped past the apply_reroll DELETE.
    // Drop it so the fresh engine run can write under the UNIQUE
    // constraint.
    await data.deleteVerdictForRoom(roomId);
  }

  const room = await data.fetchRoom(roomId);
  if (!room) {
    return jsonResponse({ error: "room_not_found" }, {
      status: 404,
      headers: corsHeaders(),
    });
  }

  const optionRows = await data.fetchOptions(roomId);
  const voteRows = await data.fetchVotes(roomId);

  if (optionRows.length === 0) {
    return jsonResponse({ error: "no_candidates" }, {
      status: 404,
      headers: corsHeaders(),
    });
  }
  if (voteRows.length === 0) {
    return jsonResponse({ error: "no_votes" }, {
      status: 404,
      headers: corsHeaders(),
    });
  }

  // Start with the override when supplied; fall back to the stored
  // room radius for the standard fire path.
  const startingRadius = widenOverride
    ?? (await data.fetchRoomRadius(roomId))
    ?? null;
  // Widen-radius re-runs lift the cap to the requested override (so
  // the engine doesn't itself widen past where the user asked). The
  // standard fire path keeps the engine's default 5 mi cap.
  const radiusCap = widenOverride !== null
    ? widenOverride
    : undefined;

  const candidates: CandidateOption[] = optionRows.map((row) => ({
    id: row.id,
    name: row.payload?.name ?? "Unnamed",
    price_tier: row.payload?.price_tier ?? null,
    dietary_tags: row.payload?.dietary_tags ?? [],
    categories: row.payload?.categories ?? [],
    distance_meters: row.payload?.distance_meters ?? null,
  }));

  // TB-12 — fetch each member's sticky per-account profile vetoes
  // (allergies / dietary restrictions / cuisine NEVERS). Profile data
  // lives on the account record, not the per-session `votes` row, so
  // it is read here and folded into the member's `hard_vetoes` channel
  // — the same generic EBA channel the schema mapping layer feeds. A
  // member with no profile row contributes nothing.
  const profileVetoes: Record<string, HardVeto[]> = data.fetchProfileVetoes
    ? await data.fetchProfileVetoes(voteRows.map((r) => r.user_id))
    : {};

  // TB-10 — merge q1_vetoes + q1_vetoes_extra so the EBA filter sees
  // the union of "original quiz answer" + "diet-reason reroll add."
  // The engine itself doesn't need the split visible — its lookup
  // table is set-based and the dedupe in the engine handles duplicates
  // naturally.
  const votes: MemberVote[] = voteRows.map((row) => {
    const mergedVetoes = mergeQ1Vetoes(row.q1_vetoes, row.q1_vetoes_extra);
    // TB-10 — apply the room-level budget override as an additional
    // cap. Each member's effective cap is MIN(member, override). The
    // walk override no longer applies: walk-minutes left the quiz (it
    // moved to the parameters bucket in the v1.1 redesign), so a
    // `dist`-reason reroll's effect is carried through the radius
    // gate, not a per-member walk cap.
    const effectiveBudget = rerollState?.budget_tier_override != null
      ? Math.min(row.q2_budget, rerollState.budget_tier_override)
      : row.q2_budget;
    // TB-12 — union any session hard_vetoes (a `profile_veto` slot,
    // were one ever written to the vote row) with the member's sticky
    // profile vetoes. Order: session entries first, profile entries
    // appended, deduped on (kind, token). The engine's lookup is
    // set-based so duplicates are harmless — the dedupe just keeps the
    // engine input tidy.
    const hardVetoes = mergeHardVetoes(
      row.hard_vetoes ?? [],
      profileVetoes[row.user_id] ?? [],
    );
    return {
      user_id: row.user_id,
      display_name: row.display_name,
      q1_vetoes: mergedVetoes,
      q2_budget: effectiveBudget,
      hard_vetoes: hardVetoes,
      scores: row.scores ?? {},
    };
  });

  // TB-10 — fetch the previous winner's display name when this run is
  // a reroll. The aggregate-rule prefix reads "Cost reroll cut Pico's."
  const previousWinnerName: string | undefined = (isRerollRun && data.fetchPreviousWinnerName)
    ? ((await data.fetchPreviousWinnerName(roomId)) ?? undefined)
    : undefined;

  let result: VerdictEngineOutput;
  try {
    result = computeVerdict({
      candidates,
      votes,
      method,
      radius_meters: startingRadius ?? undefined,
      radius_meters_cap: radiusCap,
      excluded_option_ids: rerollState?.excluded_option_ids,
      reroll_reason: rerollState?.last_reroll_reason ?? undefined,
      previous_winner_name: previousWinnerName,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("compute-verdict engine error:", e);
    return jsonResponse({ error: "engine_error", detail: message }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  // Persist — the no_survivor row carries `option_id = null` and no
  // option_cuts; the manual row carries both. TB-10 — stamp the
  // reroll_reason on the verdict so subsequent reads (and the iOS
  // VerdictStore) know the surface should attribute the reroll.
  const verdict = await data.insertVerdict({
    room_id: roomId,
    option_id: result.winning_option_id,
    method: result.method,
    rule_text: result.rule_text,
    reroll_reason: rerollState?.last_reroll_reason ?? null,
  });

  if (result.cuts.length > 0) {
    await data.insertOptionCuts(result.cuts.map((c) => ({
      verdict_id: verdict.id,
      option_id: c.option_id,
      cut_reason: c.cut_reason,
      cut_text: c.cut_text,
    })));
  }

  // Post-write notifications. The room status flip lets iOS clients
  // observing rooms.status route to S05; the broadcast emit is the
  // canonical "verdict_ready" signal per stack-patterns.md §Realtime
  // ("Use Realtime Broadcast for live ... the verdict_ready notification").
  // Both are best-effort — a failure here is logged but doesn't fail
  // the user-visible verdict response.
  if (data.markRoomVerdictReady) {
    try {
      await data.markRoomVerdictReady(roomId);
    } catch (e) {
      console.warn("compute-verdict markRoomVerdictReady failed:", e);
    }
  }
  if (data.emitVerdictReadyBroadcast) {
    try {
      await data.emitVerdictReadyBroadcast(roomId, verdict.id);
    } catch (e) {
      console.warn("compute-verdict emitVerdictReadyBroadcast failed:", e);
    }
  }

  return jsonResponse({
    verdict,
    cuts: result.cuts,
    receipts: result.receipts,
    surviving_hard_needs: result.surviving_hard_needs,
    radius_meters_used: result.radius_meters_used,
    relax_chain_applied: result.relax_chain_applied,
  }, { status: 200, headers: corsHeaders() });
}
