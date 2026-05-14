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
} from "../_shared/verdict-engine.ts";

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
}

export interface VerdictInsert {
  room_id: string;
  option_id: string;
  method: "manual";
  rule_text: string;
}

export interface VerdictRow {
  id: string;
  room_id: string;
  option_id: string;
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

  const data = deps.buildDataAdapter(deps.env);

  // Idempotency — if a verdict already exists for this room, return it
  // with the cuts, 200. TB-07 will use ON CONFLICT to support trigger-
  // retry; for TB-06 we surface the existing row so manual re-runs are
  // safe.
  const existing = await data.existingVerdict(roomId);
  if (existing) {
    return jsonResponse({
      verdict: existing,
      cuts: [],
      already_computed: true,
    }, { status: 200, headers: corsHeaders() });
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

  const candidates: CandidateOption[] = optionRows.map((row) => ({
    id: row.id,
    name: row.payload?.name ?? "Unnamed",
    price_tier: row.payload?.price_tier ?? null,
    walk_minutes_estimate: row.payload?.walk_minutes_estimate ?? null,
    dietary_tags: row.payload?.dietary_tags ?? [],
    categories: row.payload?.categories ?? [],
  }));

  const votes: MemberVote[] = voteRows.map((row) => ({
    user_id: row.user_id,
    display_name: row.display_name,
    q1_vetoes: row.q1_vetoes,
    q2_budget: row.q2_budget,
    q3_walk_minutes: row.q3_walk_minutes,
    q4_vibe: row.q4_vibe,
    q5_regret: row.q5_regret,
  }));

  let result: VerdictEngineOutput;
  try {
    result = computeVerdict({ candidates, votes });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // TB-06 scope-out: empty survivor set is the TB-09 terminal.
    if (message.includes("no survivors")) {
      return jsonResponse({ error: "no_survivor", detail: "TB-09 will land the terminal surface" }, {
        status: 422,
        headers: corsHeaders(),
      });
    }
    console.error("compute-verdict engine error:", e);
    return jsonResponse({ error: "engine_error", detail: message }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

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

  return jsonResponse({
    verdict,
    cuts: result.cuts,
    receipts: result.receipts,
  }, { status: 200, headers: corsHeaders() });
}
