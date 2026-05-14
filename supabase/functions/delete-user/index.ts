// delete-user Edge Function — runtime entry point.
//
// Composes the pure HTTP handler from `./handler.ts` with the
// supabase-js auth adapter and the Deno.serve listener.
//
// References:
//   * TB-16 ticket (gti-vault/15_issues/v1/issues/tb-16-privacy-legal-delete.md)
//   * ADR 0006 (gti-vault/60_engineering/adr/0006-privacy-posture-v1.md)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { type DeleteUserEnv, handleRequest } from "./handler.ts";

function buildAdminClient(env: DeleteUserEnv) {
  return createClient(
    env.SUPABASE_URL ?? "",
    env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

Deno.serve((req) =>
  handleRequest(req, {
    env: {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
    // Validate the caller's JWT against the auth service and return
    // their user_id. supabase-js's `auth.getUser(jwt)` round-trips to
    // the Supabase Auth endpoint which verifies the signature, expiry,
    // and that the user still exists.
    resolveCaller: async (env, jwt) => {
      const admin = buildAdminClient(env);
      const { data, error } = await admin.auth.getUser(jwt);
      if (error) return null;
      return data.user?.id ?? null;
    },
    // Issue the admin delete. `auth.admin.deleteUser` returns a 200
    // when the user existed, 404 when they didn't. We treat 404 as
    // "already gone" (existed=false) since the in-app delete is
    // idempotent from the user's perspective — the second tap should
    // not surface an error if the row is already absent.
    deleteUser: async (env, userId) => {
      const admin = buildAdminClient(env);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        // supabase-js surfaces missing-user as a thrown error with a
        // `User not found` message and status 404. Map it to existed=false
        // and a successful return. Anything else bubbles up.
        const status = (error as { status?: number }).status;
        if (status === 404) return false;
        throw error;
      }
      return true;
    },
  })
);
