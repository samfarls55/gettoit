// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// mint-claim-code Edge Function â€” runtime entry point.
//
// Composes the pure HTTP handler from `./handler.ts` with the
// supabase-js auth + service-role adapters and the Deno.serve listener.
//
// tb-WF-13 / ADR 0015 â€” the mint half of the web-invitee account-claim
// bridge. The web "Getting the app?" affordance calls this function;
// it generates a single-use claim code, encrypts the caller's web
// anonymous session refresh token against it (~30-min TTL), and returns
// the code for the user to type into the iOS S00a "Voted on the web?"
// field.
//
// References:
//   * tb-WF-13 ticket
//     (gti-vault/15_issues/0.1.0/issues/tb-wf-13-claim-code-mint.md)
//   * ADR 0015
//     (gti-vault/60_engineering/adr/0015-web-invitee-account-claim-bridge.md)
//
// Runtime secrets (set via `supabase secrets set`, mirrored in the
// CI edge-deploy lane):
//   * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY â€” present on every Edge
//     invocation; the service-role key is what writes the RLS-locked
//     `claim_codes` table.
//   * CLAIM_CODE_ENC_KEY â€” a base64-encoded 32-byte AES-GCM key the
//     refresh token is encrypted under before storage.

import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import {
  type InsertResult,
  type MintClaimCodeEnv,
  handleRequest,
} from "./handler.ts";

function buildAdminClient(env: MintClaimCodeEnv) {
  return createClient(
    env.SUPABASE_URL ?? "",
    env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Postgres unique-violation SQLSTATE â€” a primary-key collision on
 *  `claim_codes.code`. PostgREST surfaces it as `error.code === '23505'`. */
const PG_UNIQUE_VIOLATION = "23505";

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      CLAIM_CODE_ENC_KEY: Deno.env.get("CLAIM_CODE_ENC_KEY"),
    },
    // Validate the caller's access-token JWT against the auth service
    // and return their user_id. `auth.getUser(jwt)` round-trips to the
    // Supabase Auth endpoint, which verifies the signature, the expiry,
    // and that the user still exists â€” so an expired or forged token
    // resolves to null and the handler returns 401.
    resolveCaller: async (env, jwt) => {
      const admin = buildAdminClient(env);
      const { data, error } = await admin.auth.getUser(jwt);
      if (error) return null;
      return data.user?.id ?? null;
    },
    // Insert the `claim_codes` row with the service-role client (the
    // table is RLS-locked â€” only the service role reaches it). A
    // primary-key collision on `code` surfaces as SQLSTATE 23505; we
    // map it to `{ ok: false, collision: true }` so the handler retries
    // with a fresh code. Any other error is thrown.
    insertCode: async (env, row): Promise<InsertResult> => {
      const admin = buildAdminClient(env);
      const { error } = await admin.from("claim_codes").insert({
        code: row.code,
        encrypted_token: row.encryptedToken,
        user_id: row.userId,
        expires_at: row.expiresAt,
      });
      if (!error) return { ok: true };
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        return { ok: false, collision: true };
      }
      throw error;
    },
  })
);
