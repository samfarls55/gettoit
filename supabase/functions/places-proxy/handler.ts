// HTTP handler for the PlacesProxy Edge Function, independent of Deno.serve.

import {
  GooglePlacesGuardrailError,
  handleGoogleQ5PlacesProxy,
  handleGoogleVerdictDisplayProxy,
  isGoogleQ5Input,
  isGoogleVerdictDisplayInput,
  PlacesProxyInputError,
  validateInput,
} from "../_shared/places-proxy-core.ts";
import {
  collectLocalDebugTrace,
  type LocalDebugTraceEvent,
} from "../_shared/local-test-run-logger.ts";

export interface HandlerEnv {
  GOOGLE_PLACES_API_KEY?: string;
}

export interface HandlerDeps {
  env: HandlerEnv;
  fetch?: typeof fetch;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

export async function handleRequest(
  req: Request,
  deps: HandlerDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, {
      status: 405,
      headers: { ...corsHeaders(), Allow: "POST" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return Response.json({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_e) {
    return Response.json({ error: "invalid_json" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const fetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const debugTrace = shouldCollectDebugTrace(body);
  const dispatch = () =>
    dispatchPlacesProxyRequest(body, deps, fetch, debugTrace);
  if (debugTrace) {
    const { result, trace } = await collectLocalDebugTrace(dispatch);
    return responseWithDebugTrace(result, trace);
  }

  return dispatch();
}

async function dispatchPlacesProxyRequest(
  body: unknown,
  deps: HandlerDeps,
  fetch: typeof globalThis.fetch,
  debugTrace: boolean,
): Promise<Response> {
  if (isGoogleVerdictDisplayInput(body)) {
    try {
      const result = await handleGoogleVerdictDisplayProxy(body, {
        fetch,
        googleApiKey: deps.env.GOOGLE_PLACES_API_KEY ?? "",
      });
      return Response.json(result, { headers: corsHeaders() });
    } catch (e) {
      if (e instanceof PlacesProxyInputError) {
        return Response.json({ error: "invalid_input", detail: e.message }, {
          status: 400,
          headers: corsHeaders(),
        });
      }
      if (e instanceof GooglePlacesGuardrailError) {
        console.error("Google Places verdict display guardrail:", e.code);
        return Response.json({ error: e.code }, {
          status: 200,
          headers: corsHeaders(),
        });
      }
      throw e;
    }
  }

  let input;
  try {
    input = validateInput(body);
  } catch (e) {
    if (e instanceof PlacesProxyInputError) {
      return Response.json({ error: "invalid_input", detail: e.message }, {
        status: 400,
        headers: corsHeaders(),
      });
    }
    throw e;
  }

  if (!isGoogleQ5Input(body)) {
    return Response.json({ error: "unsupported_surface" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  try {
    const result = await handleGoogleQ5PlacesProxy(input, {
      fetch,
      googleApiKey: deps.env.GOOGLE_PLACES_API_KEY ?? "",
      debugTrace,
    });
    return Response.json(result, { headers: corsHeaders() });
  } catch (e) {
    if (e instanceof GooglePlacesGuardrailError) {
      console.error("Google Places Q5 guardrail:", e.code);
      return Response.json({ error: e.code }, {
        status: 200,
        headers: corsHeaders(),
      });
    }
    console.error("places-proxy unexpected failure:", e);
    return Response.json({ error: "places_proxy_unexpected_error" }, {
      status: 200,
      headers: corsHeaders(),
    });
  }
}

function shouldCollectDebugTrace(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const objectBody = body as Record<string, unknown>;
  return objectBody.debug_trace === "expo_dev_run" ||
    objectBody.debugTrace === "expo_dev_run" ||
    objectBody.debugTrace === true;
}

async function responseWithDebugTrace(
  response: Response,
  debugTrace: LocalDebugTraceEvent[],
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed = await response.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    body = {};
  }

  const headers = new Headers(response.headers);
  return Response.json({ ...body, debugTrace }, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
