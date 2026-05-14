// HTTP handler for the delete-user Edge Function.
//
// TB-16 — implements ADR 0006's in-app account deletion. Invoked by the
// iOS Settings surface after the user confirms in the native alert.
//
// Why this lives behind an Edge function rather than calling
// `supabase.auth.admin.deleteUser()` directly from iOS:
//   * The admin endpoint requires the project's service_role key.
//   * The service_role key bypasses RLS — shipping it in an iOS binary
//     is equivalent to publishing it.
//   * The Edge function holds the key server-side and validates the
//     caller's identity from their JWT before issuing the delete.
//
// Security invariant: the caller can ONLY delete themselves. The
// handler extracts the user_id from the validated JWT — the request
// body is ignored for identity purposes. There is no path here for one
// user to delete another, even if they supply a target user_id.
//
// Cascade behavior: per ADR 0006, deleting an auth.users row triggers
// the FK cascades on every dependent public-schema table. Same
// mechanism the 30-day TTL sweeper relies on
// (`cron_purge_expired_anonymous_users`); identical semantics.
//
// Idempotency: a second call after the user is deleted returns 401
// (their JWT no longer maps to a live row) — which is the intended
// shape. The iOS client treats 200 and 401 (with reason
// "user_not_found") as equivalent success.

export interface DeleteUserEnv {
  /** Supabase project URL — present on every Edge invocation. */
  SUPABASE_URL?: string;
  /** Supabase service-role key — required to call auth.admin.deleteUser. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface DeleteUserDeps {
  env: DeleteUserEnv;
  /** Validate the caller's JWT and return their user id. Returns null
   *  when the token is missing, expired, or doesn't decode to a known
   *  user. `index.ts` binds this to `supabase.auth.getUser(jwt)`; tests
   *  bind it to a stub. */
  resolveCaller: (env: DeleteUserEnv, jwt: string) => Promise<string | null>;
  /** Delete a user by id using the admin API. Returns true on success,
   *  false if the user did not exist (already deleted — also a success
   *  for our purposes). Throws for transport / auth failures. */
  deleteUser: (env: DeleteUserEnv, userId: string) => Promise<boolean>;
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
  deps: DeleteUserDeps,
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

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }
  const jwt = authHeader.slice("Bearer ".length).trim();
  if (jwt === "") {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const supabaseUrl = deps.env.SUPABASE_URL ?? "";
  const serviceRoleKey = deps.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase service-role credentials are not set");
    return jsonResponse({ error: "delete_user_misconfigured" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  // Extract the caller's user_id from the validated JWT. We deliberately
  // do NOT read any user_id from the request body — that would let a
  // malicious caller delete anyone. The Edge runtime forwards the
  // caller's JWT verbatim; `resolveCaller` validates the signature and
  // returns the row.
  let userId: string | null;
  try {
    userId = await deps.resolveCaller(deps.env, jwt);
  } catch (e) {
    console.error("delete-user resolveCaller failed:", e);
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }
  if (userId === null) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  try {
    const existed = await deps.deleteUser(deps.env, userId);
    return jsonResponse(
      { status: "ok", user_id: userId, existed },
      { headers: corsHeaders() },
    );
  } catch (e) {
    console.error("delete-user admin.deleteUser failed:", e);
    return jsonResponse({ error: "delete_user_failed" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}
