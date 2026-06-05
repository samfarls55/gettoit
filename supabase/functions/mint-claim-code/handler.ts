// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// HTTP handler for the mint-claim-code Edge Function.
//
// tb-WF-13 / ADR 0015 â€” the mint half of the web-invitee account-claim
// bridge. A Web invitee on the web Waiting screen or the read-only
// verdict card taps the low-key "Getting the app?" affordance; the web
// client calls this function, which generates a single-use claim code,
// stashes the web anonymous session's refresh token against it
// (encrypted, ~30-min TTL), and returns the code for the user to type
// into the iOS S00a "Voted on the web?" field.
//
// â”€â”€ Why the request carries the refresh token in the body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// `linkApple` can only resume the *exact* web anonymous identity if the
// app installs that session's refresh token into its keychain. There is
// no Supabase server primitive to mint a session for an arbitrary
// anonymous user, so the code must carry the session key itself
// (ADR 0015 Â§Consequences). The web client already holds its own
// refresh token in `localStorage`; it sends it in the POST body. The
// transport is HTTPS to a first-party endpoint, the token is the
// caller's own, and it is encrypted before it ever lands in a row.
//
// â”€â”€ Security invariant â€” the caller can only mint for themselves â”€â”€â”€â”€â”€
// The handler validates the caller's access-token JWT (Authorization:
// Bearer) and resolves it to a `user_id`. The body-supplied refresh
// token is accepted only as the thing to encrypt; the recorded
// `claim_codes.user_id` is always the JWT-resolved id, never anything
// from the body. An unauthed caller (no / bad / expired JWT) is
// rejected with 401 before any row is written.
//
// â”€â”€ Re-mintable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Every call mints a fresh code. The web "Getting the app?" affordance
// lazily mints on each tap; an earlier code simply expires unused. No
// attempt is made to dedupe â€” a fresh code per tap is the spec.

import {
  encryptToken,
  generateClaimCode,
} from "../_shared/claim-code.ts";

/** ~30-minute TTL for a minted code (ADR 0015). */
export const CLAIM_CODE_TTL_MS = 30 * 60 * 1000;

/** Max INSERT attempts before giving up on a primary-key collision.
 *  With a 31^8 keyspace a collision is astronomically rare; a handful
 *  of retries makes it a non-event. */
const MAX_MINT_ATTEMPTS = 5;

export interface MintClaimCodeEnv {
  /** Supabase project URL â€” present on every Edge invocation. */
  SUPABASE_URL?: string;
  /** Supabase service-role key â€” required to write `claim_codes`
   *  (the table is RLS-locked; only the service role reaches it). */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Base64-encoded 32-byte AES-GCM key the refresh token is encrypted
   *  under before it is stored. A runtime secret â€” never in the
   *  database, never committed. */
  CLAIM_CODE_ENC_KEY?: string;
}

/** A row insert result â€” `ok` true means the code was stored, `false`
 *  means a primary-key collision (the caller retries with a new code).
 *  Any other failure is thrown. */
export type InsertResult = { ok: true } | { ok: false; collision: true };

export interface MintClaimCodeDeps {
  env: MintClaimCodeEnv;
  /** Validate the caller's access-token JWT and return their user id.
   *  Returns null when the token is missing, expired, or does not
   *  decode to a known user. `index.ts` binds this to
   *  `supabase.auth.getUser(jwt)`; tests bind a stub. */
  resolveCaller: (
    env: MintClaimCodeEnv,
    jwt: string,
  ) => Promise<string | null>;
  /** Insert a `claim_codes` row. Returns `{ ok: true }` on success,
   *  `{ ok: false, collision: true }` on a primary-key collision so the
   *  handler can retry with a fresh code. Throws for transport / other
   *  failures. `index.ts` binds this to a service-role insert. */
  insertCode: (
    env: MintClaimCodeEnv,
    row: {
      code: string;
      encryptedToken: string;
      userId: string;
      expiresAt: string;
    },
  ) => Promise<InsertResult>;
  /** Generate a candidate claim code. Defaults to the shared
   *  `generateClaimCode`; injectable so a test can force a collision. */
  makeCode?: () => string;
  /** Clock â€” injectable so tests can pin `expires_at`. */
  now?: () => number;
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
  deps: MintClaimCodeDeps,
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

  // â”€â”€ Auth gate â€” the caller must present a live web-session JWT â”€â”€â”€â”€â”€
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

  // â”€â”€ Config gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const supabaseUrl = deps.env.SUPABASE_URL ?? "";
  const serviceRoleKey = deps.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const encKey = deps.env.CLAIM_CODE_ENC_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey || !encKey) {
    console.error("mint-claim-code: service credentials are not set");
    return jsonResponse({ error: "mint_claim_code_misconfigured" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  // â”€â”€ Resolve the caller from the validated JWT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let userId: string | null;
  try {
    userId = await deps.resolveCaller(deps.env, jwt);
  } catch (e) {
    console.error("mint-claim-code resolveCaller failed:", e);
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

  // â”€â”€ Read the refresh token from the body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The code must carry the web session's refresh token (ADR 0015) â€”
  // the web client supplies its own token here. A missing token is a
  // malformed request, not an auth failure.
  let refreshToken: string;
  try {
    const body = await req.json();
    const raw = (body as { refresh_token?: unknown }).refresh_token;
    if (typeof raw !== "string" || raw.trim() === "") {
      return jsonResponse({ error: "missing_refresh_token" }, {
        status: 400,
        headers: corsHeaders(),
      });
    }
    refreshToken = raw;
  } catch {
    return jsonResponse({ error: "invalid_request_body" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // â”€â”€ Encrypt the refresh token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let encryptedToken: string;
  try {
    encryptedToken = await encryptToken(refreshToken, encKey);
  } catch (e) {
    console.error("mint-claim-code: token encryption failed:", e);
    return jsonResponse({ error: "mint_claim_code_failed" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  // â”€â”€ Mint â€” generate + INSERT, retrying on a PK collision â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const makeCode = deps.makeCode ?? generateClaimCode;
  const now = deps.now ?? Date.now;
  const expiresAt = new Date(now() + CLAIM_CODE_TTL_MS).toISOString();

  let code = "";
  let stored = false;
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt++) {
    code = makeCode();
    let result: InsertResult;
    try {
      result = await deps.insertCode(deps.env, {
        code,
        encryptedToken,
        userId,
        expiresAt,
      });
    } catch (e) {
      console.error("mint-claim-code: insert failed:", e);
      return jsonResponse({ error: "mint_claim_code_failed" }, {
        status: 500,
        headers: corsHeaders(),
      });
    }
    if (result.ok) {
      stored = true;
      break;
    }
    // result.ok === false â†’ collision; loop and try a fresh code.
  }

  if (!stored) {
    console.error(
      `mint-claim-code: gave up after ${MAX_MINT_ATTEMPTS} PK collisions`,
    );
    return jsonResponse({ error: "mint_claim_code_failed" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  return jsonResponse(
    { status: "ok", code, expires_at: expiresAt },
    { headers: corsHeaders() },
  );
}
