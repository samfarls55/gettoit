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
    walk_minutes_estimate?: number | null;
    dietary_tags?: string[];
    categories?: string[];
    /** Distance from the room's search centre in meters. Used by the
     *  TB-09 radius_widen relax step. PlacesProxy populates this in
     *  its `ShapedPlace` and the iOS / Edge writes it through the
     *  options payload. */
    distance_meters?: number | null;
    /** Q4-style vibe signal carried via the option payload. Optional
     *  — Foursquare doesn't ship a vibe field today; PlacesProxy may
     *  emit it later. Drives the vibe_floor relax step when present. */
    vibe_signal?: number | null;
  };
}

export interface MemberVoteRow {
  user_id: string;
  display_name: string;
  q1_vetoes: string[];
  q2_budget: number;
  q3_walk_minutes: number;
  q4_vibe: number;
  q5_regret: Record<string, number>;
  /** Soft cuisine vetoes (TB-09). Optional — the v1 quiz does not
   *  currently surface this directly; reroll (TB-10) and future
   *  taste-profile prefill (post-v1) write into it. */
  soft_cuisine_vetoes?: string[];
}

export interface VerdictInsert {
  room_id: string;
  /** Null for `no_survivor` — the engine emitted no winner. */
  option_id: string | null;
  method: VerdictMethod;
  rule_text: string;
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

  // Idempotency — if a verdict already exists for this room, return it
  // with the cuts, 200. TB-07 will use ON CONFLICT to support trigger-
  // retry. The widen-radius re-run path is the one exception: when
  // the caller supplies `radius_meters_override` AND the existing
  // verdict is a `no_survivor`, drop the old verdict (cascading the
  // option_cuts) so the engine can write a fresh row.
  const existing = await data.existingVerdict(roomId);
  if (existing) {
    if (widenOverride !== null && existing.method === "no_survivor") {
      await data.deleteVerdictForRoom(roomId);
    } else {
      return jsonResponse({
        verdict: existing,
        cuts: [],
        already_computed: true,
      }, { status: 200, headers: corsHeaders() });
    }
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
    walk_minutes_estimate: row.payload?.walk_minutes_estimate ?? null,
    dietary_tags: row.payload?.dietary_tags ?? [],
    categories: row.payload?.categories ?? [],
    distance_meters: row.payload?.distance_meters ?? null,
    vibe_signal: row.payload?.vibe_signal ?? null,
  }));

  const votes: MemberVote[] = voteRows.map((row) => ({
    user_id: row.user_id,
    display_name: row.display_name,
    q1_vetoes: row.q1_vetoes,
    q2_budget: row.q2_budget,
    q3_walk_minutes: row.q3_walk_minutes,
    q4_vibe: row.q4_vibe,
    q5_regret: row.q5_regret,
    soft_cuisine_vetoes: row.soft_cuisine_vetoes,
  }));

  let result: VerdictEngineOutput;
  try {
    result = computeVerdict({
      candidates,
      votes,
      method,
      radius_meters: startingRadius ?? undefined,
      radius_meters_cap: radiusCap,
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
  // option_cuts; the manual row carries both.
  const verdict = await data.insertVerdict({
    room_id: roomId,
    option_id: result.winning_option_id,
    method: result.method,
    rule_text: result.rule_text,
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
