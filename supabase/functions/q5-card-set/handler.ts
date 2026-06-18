import {
  assignQ5CardSet,
  buildQ5ProbeFetchPlan,
  type Q5CardSetPoolCandidate,
  type Q5MemberProbeProfile,
  type Q5ProbeFetchPlanStep,
} from "../_shared/q5-card-set.ts";
import { logLocalTestEvent } from "../_shared/local-test-run-logger.ts";

export type QuizAnswers = {
  q1CuisineCravings?: string[];
  q2SpendCap?: number;
  q3Reputation?: string;
  q4VibeEnergy?: string;
};

export type Q5RoomMemberContext = {
  roomId: string;
  memberId: string;
  parametersLocked: boolean;
  answers: QuizAnswers;
  placesProxyRequest?: Record<string, unknown>;
};

export type Q5PoolFetchInput = {
  roomId: string;
  memberId: string;
  profile: Q5MemberProbeProfile;
  fetchPlan: Q5ProbeFetchPlanStep[];
  placesProxyRequest?: Record<string, unknown>;
};

export interface Q5CardSetDataAdapter {
  fetchRoomMember(
    roomId: string,
    userId: string,
  ): Promise<Q5RoomMemberContext | null>;
  fetchQ5Pool(input: Q5PoolFetchInput): Promise<Q5CardSetPoolCandidate[]>;
}

export interface HandlerDeps {
  getUserId: (bearerToken: string) => Promise<string | null>;
  data: Q5CardSetDataAdapter;
}

const defaultQ5CardSetId = "initial";

const vibeValueByAnswer: Record<string, number> = {
  quiet: 0,
  chill: 1,
  cozy: 1,
  social: 2,
  lively: 3,
  rowdy: 4,
};

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

export async function handleRequest(
  req: Request,
  deps: HandlerDeps,
): Promise<Response> {
  logLocalTestEvent("q5_card_set.handler.request", {
    method: req.method,
    url: req.url,
  });
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, {
      status: 405,
      headers: { ...corsHeaders(), Allow: "POST" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const userId = await deps.getUserId(authHeader.slice("Bearer ".length));
  if (!userId) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const input = parseRequestBody(body);
  if (!input) {
    logLocalTestEvent("q5_card_set.handler.invalid_input", { body });
    return jsonResponse({ error: "invalid_input" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }
  logLocalTestEvent("q5_card_set.handler.input", { userId, input });

  const memberContext = await deps.data.fetchRoomMember(input.roomId, userId);
  if (!memberContext) {
    logLocalTestEvent("q5_card_set.handler.room_not_found", {
      userId,
      input,
    });
    return jsonResponse({ error: "room_not_found" }, {
      status: 404,
      headers: corsHeaders(),
    });
  }
  if (!memberContext.parametersLocked) {
    logLocalTestEvent("q5_card_set.handler.parameters_unlocked", {
      userId,
      memberContext,
    });
    return jsonResponse({ error: "room_parameters_unlocked" }, {
      status: 409,
      headers: corsHeaders(),
    });
  }

  const profile = memberProfileFromAnswers(memberContext.answers);
  const fetchPlan = buildQ5ProbeFetchPlan(profile);
  logLocalTestEvent("q5_card_set.handler.before_pool_fetch", {
    userId,
    memberContext,
    profile,
    fetchPlan,
  });
  const pool = await deps.data.fetchQ5Pool({
    roomId: memberContext.roomId,
    memberId: memberContext.memberId,
    profile,
    fetchPlan,
    ...(memberContext.placesProxyRequest
      ? { placesProxyRequest: memberContext.placesProxyRequest }
      : {}),
  });
  logLocalTestEvent("q5_card_set.handler.pool", {
    roomId: memberContext.roomId,
    memberId: memberContext.memberId,
    profile,
    fetchPlan,
    poolCount: pool.length,
    pool,
  });

  const result = assignQ5CardSet({
    roomId: memberContext.roomId,
    memberId: memberContext.memberId,
    q5CardSetId: input.q5CardSetId,
    member: profile,
    pool,
  });
  logLocalTestEvent("q5_card_set.handler.result", {
    roomId: memberContext.roomId,
    memberId: memberContext.memberId,
    result,
  });

  return jsonResponse(result, { status: 200, headers: corsHeaders() });
}

function parseRequestBody(
  body: unknown,
): { roomId: string; q5CardSetId: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const objectBody = body as Record<string, unknown>;
  if (typeof objectBody.room_id !== "string") {
    return null;
  }

  const roomId = objectBody.room_id.trim();
  if (roomId.length === 0) {
    return null;
  }

  const rawCardSetId = objectBody.q5_card_set_id;
  const requestedCardSetId = typeof rawCardSetId === "string"
    ? rawCardSetId.trim()
    : "";

  return {
    roomId,
    q5CardSetId: requestedCardSetId.length > 0
      ? requestedCardSetId
      : defaultQ5CardSetId,
  };
}

function memberProfileFromAnswers(
  answers: QuizAnswers,
): Q5MemberProbeProfile {
  return {
    cuisines: (answers.q1CuisineCravings ?? [])
      .filter((cuisine) => cuisine !== "noPreference")
      .sort(),
    crowdApproval: crowdApprovalFromAnswer(answers.q3Reputation),
    vibe: vibeValueByAnswer[answers.q4VibeEnergy ?? "social"] ?? 2,
  };
}

function crowdApprovalFromAnswer(answer: string | undefined): string {
  switch (answer) {
    case "hiddenGem":
    case "hidden_gem":
      return "hidden_gem";
    case "noPreference":
    case "no_preference":
    case undefined:
      return "no_preference";
    default:
      return answer;
  }
}
