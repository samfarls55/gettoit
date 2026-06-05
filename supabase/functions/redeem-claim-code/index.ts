// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// redeem-claim-code Edge Function â€” runtime entry point.
//
// Composes the pure HTTP handler from `./handler.ts` with the
// supabase-js service-role adapters, the in-memory rate limiter, and
// the Deno.serve listener.
//
// tb-WF-14 / ADR 0015 â€” the redeem half of the web-invitee account-
// claim bridge. The iOS S00a "Voted on the web?" affordance calls this
// function with a bare claim code; it looks the code up in
// `claim_codes`, rejects expired / already-redeemed / unknown codes,
// burns a valid code single-use, and returns the carried anonymous
// session's refresh token so the app can install that identity into
// its keychain and then `linkApple` over it.
//
// References:
//   * tb-WF-14 ticket
//     (gti-vault/15_issues/0.1.0/issues/tb-wf-14-claim-code-redeem.md)
//   * ADR 0015
//     (gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge.md)
//
// Runtime secrets (set via `supabase secrets set`, mirrored in the CI
// edge-deploy lane):
//   * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY â€” present on every Edge
//     invocation; the service-role key is what reads + updates the
//     RLS-locked `claim_codes` table.
//   * CLAIM_CODE_ENC_KEY â€” the base64-encoded 32-byte AES-GCM key the
//     stored refresh token was encrypted under by `mint-claim-code`.
//     A missing key surfaces as `redeem_claim_code_misconfigured` â€”
//     the CI edge-deploy lane treats it as a warning, not a failure
//     (mirrors tb-WF-13's mint-side convention).

import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import {
  type BurnResult,
  type ClaimCodeRow,
  handleRequest,
  type RedeemClaimCodeEnv,
} from "./handler.ts";
import { createRateLimiter } from "./rate-limit.ts";

function buildAdminClient(env: RedeemClaimCodeEnv) {
  return createClient(
    env.SUPABASE_URL ?? "",
    env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// â”€â”€ Rate limiter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// One process-wide sliding-window limiter, shared across every request
// this Edge instance serves. 10 redeem attempts per client IP per 10
// minutes â€” generous for a human mistyping an 8-char code a few times,
// punishing for a script. The structural defenses (31^8 keyspace,
// single-use burn, 30-min TTL) carry the real weight; see rate-limit.ts.
const limiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 10 * 60 * 1000,
});

/** The `claim_codes` row shape PostgREST returns (snake_case). */
interface ClaimCodeRowWire {
  code: string;
  encrypted_token: string;
  user_id: string;
  expires_at: string;
  redeemed_at: string | null;
}

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      CLAIM_CODE_ENC_KEY: Deno.env.get("CLAIM_CODE_ENC_KEY"),
    },
    checkRateLimit: (sourceKey) => limiter.check(sourceKey),
    // Look up the row with the service-role client (the table is
    // RLS-locked â€” only the service role reaches it). `maybeSingle`
    // returns null rather than throwing when no row matches.
    lookupCode: async (
      env,
      code,
    ): Promise<ClaimCodeRow | null> => {
      const admin = buildAdminClient(env);
      const { data, error } = await admin
        .from("claim_codes")
        .select("code, encrypted_token, user_id, expires_at, redeemed_at")
        .eq("code", code)
        .maybeSingle<ClaimCodeRowWire>();
      if (error) throw error;
      if (!data) return null;
      return {
        code: data.code,
        encryptedToken: data.encrypted_token,
        userId: data.user_id,
        expiresAt: data.expires_at,
        redeemedAt: data.redeemed_at,
      };
    },
    // Conditional single-use burn:
    //   update claim_codes set redeemed_at = now()
    //   where code = $1 and redeemed_at is null
    // The `.is("redeemed_at", null)` filter is what makes the UPDATE
    // race-safe â€” only the redeem that flips the column first matches a
    // row. We `select()` the affected rows so a zero-length result
    // tells us the code was already redeemed concurrently.
    burnCode: async (env, code): Promise<BurnResult> => {
      const admin = buildAdminClient(env);
      const { data, error } = await admin
        .from("claim_codes")
        .update({ redeemed_at: new Date().toISOString() })
        .eq("code", code)
        .is("redeemed_at", null)
        .select("code");
      if (error) throw error;
      return { burned: Array.isArray(data) && data.length > 0 };
    },
  })
);
