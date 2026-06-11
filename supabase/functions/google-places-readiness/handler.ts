export interface GooglePlacesReadinessEnv {
  GOOGLE_PLACES_API_KEY?: string;
}

export type FetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface GooglePlacesReadinessDeps {
  env: GooglePlacesReadinessEnv;
  fetch?: FetchFn;
  now?: () => Date;
}

const READINESS_PLACE_RESOURCE = "places/ChIJN1t_tDeuEmsRUsoyG83frY4";
const READINESS_FIELD_MASK = "id";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function failureClass(
  status: number,
): "invalid_credential" | "provider_unavailable" {
  if (status === 401 || status === 403) return "invalid_credential";
  return "provider_unavailable";
}

export async function handleRequest(
  req: Request,
  deps: GooglePlacesReadinessDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, {
      status: 405,
      headers: { ...corsHeaders(), Allow: "GET" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const apiKey = deps.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!apiKey) {
    console.warn("google-places-readiness missing credential");
    return jsonResponse({
      provider: "google_places",
      readiness: "missing_credential",
      error: "google_places_not_configured",
      checked_at: (deps.now ?? (() => new Date()))().toISOString(),
    }, { status: 503, headers: corsHeaders() });
  }

  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const url = `https://places.googleapis.com/v1/${READINESS_PLACE_RESOURCE}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": READINESS_FIELD_MASK,
        "Accept": "application/json",
      },
    });
  } catch (_e) {
    console.warn("google-places-readiness provider network failure");
    return jsonResponse({
      provider: "google_places",
      readiness: "provider_unavailable",
      error: "google_places_provider_unavailable",
      checked_at: (deps.now ?? (() => new Date()))().toISOString(),
    }, { status: 503, headers: corsHeaders() });
  }

  if (!response.ok) {
    const readiness = failureClass(response.status);
    console.warn(
      `google-places-readiness failed status=${response.status} class=${readiness}`,
    );
    return jsonResponse({
      provider: "google_places",
      readiness,
      error: readiness === "invalid_credential"
        ? "google_places_invalid_credential"
        : "google_places_provider_unavailable",
      checked_at: (deps.now ?? (() => new Date()))().toISOString(),
    }, { status: 503, headers: corsHeaders() });
  }

  return jsonResponse({
    provider: "google_places",
    readiness: "configured",
    checked_at: (deps.now ?? (() => new Date()))().toISOString(),
    field_mask: "google_places_readiness_v1",
  }, { status: 200, headers: corsHeaders() });
}
