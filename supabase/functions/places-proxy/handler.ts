// HTTP handler for the PlacesProxy Edge Function, independent of the
// Supabase JS client. Splitting this out so the test file can exercise
// the handler without pulling supabase-js (and its transitive
// `@types/node`) into the deno-check graph.
//
// `index.ts` composes this handler with the real Supabase cache
// adapter and the real `Deno.serve` entry point.

import {
  type CacheAdapter,
  FoursquareUpstreamError,
  GooglePlacesGuardrailError,
  handleGoogleQ5PlacesProxy,
  handleGoogleVerdictDisplayProxy,
  handlePlacesProxy,
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
  /** Foursquare service key — server-only secret. */
  FOURSQUARE_API_KEY?: string;
  /** Google Places service key — server-only secret. */
  GOOGLE_PLACES_API_KEY?: string;
  /** Supabase project URL — present on every Edge invocation. */
  SUPABASE_URL?: string;
  /** Supabase service-role key — bypasses RLS for cache writes. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface HandlerDeps {
  env: HandlerEnv;
  /** Override for the upstream fetch (tests inject a stub). */
  fetch?: typeof fetch;
  /** Required: how the handler obtains a cache adapter. `index.ts`
   *  binds this to the supabase-js adapter; tests bind it to an
   *  in-memory map. */
  buildCacheAdapter: (env: HandlerEnv) => CacheAdapter;
}

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, {
      status: 405,
      headers: { ...corsHeaders(), Allow: "POST" },
    });
  }

  // Auth — the Supabase Edge Runtime forwards the caller's JWT via
  // the Authorization header. Any authenticated user (including anon)
  // can call the proxy; the function itself uses the service-role
  // key to write the cache.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const supabaseUrl = deps.env.SUPABASE_URL ?? "";
  const serviceRoleKey = deps.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase service-role credentials are not set");
    return jsonResponse({ error: "places_proxy_misconfigured" }, {
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
  const isGoogleVerdictDisplayRequest = isGoogleVerdictDisplayInput(body);
  if (isGoogleVerdictDisplayRequest) {
    try {
      const result = await handleGoogleVerdictDisplayProxy(body, {
        fetch,
        googleApiKey: deps.env.GOOGLE_PLACES_API_KEY ?? "",
      });
      return jsonResponse(result, { headers: corsHeaders() });
    } catch (e) {
      if (e instanceof PlacesProxyInputError) {
        return jsonResponse({ error: "invalid_input", detail: e.message }, {
          status: 400,
          headers: corsHeaders(),
        });
      }
      if (e instanceof GooglePlacesGuardrailError) {
        console.error("Google Places verdict display guardrail:", e.code);
        return jsonResponse({ error: e.code }, {
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
      return jsonResponse({ error: "invalid_input", detail: e.message }, {
        status: 400,
        headers: corsHeaders(),
      });
    }
    throw e;
  }

  const isGoogleQ5Request = isGoogleQ5Input(body);
  if (!isGoogleQ5Request && !deps.env.FOURSQUARE_API_KEY) {
    console.error("FOURSQUARE_API_KEY is not set on the Edge Function");
    return jsonResponse({ error: "places_proxy_misconfigured" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  try {
    if (isGoogleQ5Request) {
      const result = await handleGoogleQ5PlacesProxy(input, {
        fetch,
        googleApiKey: deps.env.GOOGLE_PLACES_API_KEY ?? "",
        debugTrace,
      });
      return jsonResponse(result, { headers: corsHeaders() });
    }

    const result = await handlePlacesProxy(input, {
      cache: deps.buildCacheAdapter(deps.env),
      fetch,
      apiKey: deps.env.FOURSQUARE_API_KEY ?? "",
    });
    return jsonResponse(result, { headers: corsHeaders() });
  } catch (e) {
    if (e instanceof GooglePlacesGuardrailError) {
      console.error("Google Places Q5 guardrail:", e.code);
      return jsonResponse({ error: e.code }, {
        status: 200,
        headers: corsHeaders(),
      });
    }
    if (e instanceof FoursquareUpstreamError && e.status === 410) {
      console.error("Foursquare 410:", e.message);
      return jsonResponse({
        places: [],
        disclaimers: [],
        is_thin: true,
        served_from_cache: false,
        error: "foursquare_version_pin_outdated",
      }, { status: 200, headers: corsHeaders() });
    }
    console.error("places-proxy unexpected failure:", e);
    return jsonResponse({
      places: [],
      disclaimers: [],
      is_thin: true,
      served_from_cache: false,
      error: "places_proxy_unexpected_error",
    }, { status: 200, headers: corsHeaders() });
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
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ ...body, debugTrace }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
