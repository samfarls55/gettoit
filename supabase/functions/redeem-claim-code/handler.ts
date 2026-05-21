// HTTP handler for the redeem-claim-code Edge Function.
//
// tb-WF-14 / ADR 0015 — the redeem half of the web-invitee account-
// claim bridge. A Web invitee who voted in the browser installs the
// iOS app, taps the S00a "Voted on the web?" affordance, and types in
// the claim code minted by the web "Getting the app?" affordance
// (tb-WF-13). This function takes that bare code, looks it up in
// `claim_codes`, rejects it if expired or already redeemed, burns it
// single-use, and returns the carried anonymous session's refresh
// token so the app can install that exact identity into its keychain.
// The subsequent Sign-in-with-Apple tap then runs `linkApple`,
// preserving the `user_id` (ADR 0015 §Decision).
//
// ── Why no caller-auth gate (unlike mint) ────────────────────────────
// `mint-claim-code` authenticates the caller against a live web-session
// JWT — the web invitee can only mint a code for their own session. The
// redeem side is the opposite: a freshly-installed app has NO session
// at all (it is sitting on S00a, the forced sign-in gate). It cannot
// present a bearer JWT because it does not have one yet — claiming is
// what gives it a session. So the *code itself* is the credential. The
// code is unguessable (31^8 keyspace), single-use, short-TTL, and the
// endpoint is rate-limited against brute force — those four together
// stand in for an auth gate (ADR 0015 §Decision "protected by the
// unguessable code + rate limiting").
//
// ── Single-use burn — the conditional UPDATE ─────────────────────────
// The burn is a conditional UPDATE (`set redeemed_at = now() where code
// = $1 and redeemed_at is null`). The handler treats a zero-row result
// as `{ burned: false }` and rejects with 409 — that closes the race
// where two concurrent redeems both read the row as unredeemed: only
// the UPDATE that flips `redeemed_at` first wins, and the loser never
// receives a session.
//
// The handler is pure: the rate-limit decision, the row lookup, and the
// conditional burn are all dependency-injected; `index.ts` binds them
// to a service-role Supabase client and the in-memory limiter.

import { decryptToken, isWellFormedClaimCode } from "../_shared/claim-code.ts";

export interface RedeemClaimCodeEnv {
  /** Supabase project URL — present on every Edge invocation. */
  SUPABASE_URL?: string;
  /** Supabase service-role key — required to read + update the
   *  RLS-locked `claim_codes` table. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Base64-encoded 32-byte AES-GCM key the stored refresh token was
   *  encrypted under by `mint-claim-code`. The same runtime secret. */
  CLAIM_CODE_ENC_KEY?: string;
}

/** A `claim_codes` row as the handler consumes it — camelCase, with
 *  the timestamps as ISO strings the handler parses against its clock. */
export interface ClaimCodeRow {
  code: string;
  /** The AES-GCM ciphertext of the web anonymous session refresh
   *  token (`<iv-b64>:<ciphertext-b64>`). */
  encryptedToken: string;
  /** The carried anonymous `user_id` — echoed to the client so it can
   *  sanity-check what it is about to install. */
  userId: string;
  /** ISO-8601 expiry. */
  expiresAt: string;
  /** ISO-8601 redemption time, or null when still unredeemed. */
  redeemedAt: string | null;
}

/** The result of the conditional single-use burn. `burned` true means
 *  the UPDATE flipped `redeemed_at` (this caller won the row); false
 *  means it matched zero rows (the code was redeemed concurrently). */
export type BurnResult = { burned: boolean };

/** A rate-limit verdict — `allowed` false carries an optional
 *  `retryAfterSeconds` for the `Retry-After` header. */
export interface RateLimitVerdict {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface RedeemClaimCodeDeps {
  env: RedeemClaimCodeEnv;
  /** Decide whether this request is within the rate-limit budget. The
   *  handler passes the request's source key (client IP). `index.ts`
   *  binds this to the in-memory sliding-window limiter; tests stub it. */
  checkRateLimit: (sourceKey: string) => RateLimitVerdict;
  /** Look up a `claim_codes` row by its (already uppercased, trimmed)
   *  code. Returns null when no row exists. Throws on transport
   *  failure. `index.ts` binds this to a service-role SELECT. */
  lookupCode: (
    env: RedeemClaimCodeEnv,
    code: string,
  ) => Promise<ClaimCodeRow | null>;
  /** Conditionally burn the code single-use:
   *  `update claim_codes set redeemed_at = now()
   *   where code = $1 and redeemed_at is null`.
   *  Returns `{ burned: true }` iff the UPDATE matched the still-
   *  unredeemed row. Throws on transport failure. */
  burnCode: (
    env: RedeemClaimCodeEnv,
    code: string,
  ) => Promise<BurnResult>;
  /** Clock — injectable so tests can pin expiry comparisons. */
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

/** Resolve a best-effort source key for the rate limiter from the
 *  request headers. Edge invocations sit behind a proxy that sets
 *  `x-forwarded-for`; `cf-connecting-ip` is the Cloudflare-edge
 *  fallback. An empty string collapses every un-attributable caller
 *  into one shared (still capped) bucket — never unlimited. */
function sourceKeyFor(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    // x-forwarded-for is a comma list; the first entry is the client.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip")?.trim() ?? "";
}

export async function handleRequest(
  req: Request,
  deps: RedeemClaimCodeDeps,
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

  // ── Config gate ───────────────────────────────────────────────────
  const supabaseUrl = deps.env.SUPABASE_URL ?? "";
  const serviceRoleKey = deps.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const encKey = deps.env.CLAIM_CODE_ENC_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey || !encKey) {
    console.error("redeem-claim-code: service credentials are not set");
    return jsonResponse({ error: "redeem_claim_code_misconfigured" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  // ── Rate-limit gate — before any DB work ──────────────────────────
  // A guessing burst must be refused as cheaply as possible: the limit
  // is checked before the body is even parsed so a denied caller never
  // costs a lookup.
  const verdict = deps.checkRateLimit(sourceKeyFor(req));
  if (!verdict.allowed) {
    const headers: Record<string, string> = { ...corsHeaders() };
    if (verdict.retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(verdict.retryAfterSeconds);
    }
    return jsonResponse({ error: "rate_limited" }, {
      status: 429,
      headers,
    });
  }

  // ── Read the code from the body ───────────────────────────────────
  let rawCode: unknown;
  try {
    const body = await req.json();
    rawCode = (body as { code?: unknown }).code;
  } catch {
    return jsonResponse({ error: "invalid_request_body" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }
  if (typeof rawCode !== "string") {
    return jsonResponse({ error: "invalid_code" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Normalize: trim surrounding whitespace, uppercase. The mint side
  // stores uppercase; a lowercase paste or stray space must still
  // match (claim-code.ts §alphabet comment).
  const code = rawCode.trim().toUpperCase();

  // Cheap structural pre-check — reject a malformed code before a DB
  // round-trip. A code that fails this can never exist in the table.
  if (!isWellFormedClaimCode(code)) {
    return jsonResponse({ error: "invalid_code" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // ── Look the code up ──────────────────────────────────────────────
  let row: ClaimCodeRow | null;
  try {
    row = await deps.lookupCode(deps.env, code);
  } catch (e) {
    console.error("redeem-claim-code: lookup failed:", e);
    return jsonResponse({ error: "redeem_claim_code_failed" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }
  if (row === null) {
    return jsonResponse({ error: "code_not_found" }, {
      status: 404,
      headers: corsHeaders(),
    });
  }

  // ── Reject an already-redeemed code (fast path) ───────────────────
  // The conditional burn below is the authoritative single-use guard;
  // this check just turns the common already-spent case into a clear
  // 409 without an UPDATE round-trip.
  if (row.redeemedAt !== null) {
    return jsonResponse({ error: "code_already_redeemed" }, {
      status: 409,
      headers: corsHeaders(),
    });
  }

  // ── Reject an expired code ────────────────────────────────────────
  // A code expiring exactly at now() is treated as expired — the TTL
  // is inclusive of its lower bound only.
  const now = deps.now ?? Date.now;
  const expiresAtMs = Date.parse(row.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now()) {
    return jsonResponse({ error: "code_expired" }, {
      status: 410,
      headers: corsHeaders(),
    });
  }

  // ── Burn the code single-use (conditional UPDATE) ─────────────────
  // The UPDATE only matches a still-unredeemed row; a zero-row result
  // means a concurrent redeem won the race. Either way, a caller that
  // does not win the burn never gets a session.
  let burn: BurnResult;
  try {
    burn = await deps.burnCode(deps.env, code);
  } catch (e) {
    console.error("redeem-claim-code: burn failed:", e);
    return jsonResponse({ error: "redeem_claim_code_failed" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }
  if (!burn.burned) {
    return jsonResponse({ error: "code_already_redeemed" }, {
      status: 409,
      headers: corsHeaders(),
    });
  }

  // ── Decrypt the carried refresh token ─────────────────────────────
  // The code is now burned. A decryption failure here is a server-side
  // fault (wrong key, corrupt ciphertext) — surface 500. The code is
  // already spent; that is acceptable, the user re-mints a fresh one
  // from the web link (re-mintable by design).
  let refreshToken: string;
  try {
    refreshToken = await decryptToken(row.encryptedToken, encKey);
  } catch (e) {
    console.error("redeem-claim-code: token decryption failed:", e);
    return jsonResponse({ error: "redeem_claim_code_failed" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  // The carried anonymous session — the app installs this refresh
  // token into its keychain, reaches `.anonymous`, and the Apple tap
  // then runs `linkApple` preserving `user_id` (ADR 0015 §Decision).
  return jsonResponse(
    { status: "ok", refresh_token: refreshToken, user_id: row.userId },
    { headers: corsHeaders() },
  );
}
