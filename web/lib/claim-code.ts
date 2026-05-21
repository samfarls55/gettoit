// GetToIt web — claim-code mint client (tb-WF-13).
//
// Calls the `mint-claim-code` Edge Function to lazily mint a single-use
// claim code for the web-invitee account-claim bridge (ADR 0015). The
// "Getting the app?" affordance wires `mintClaimCode` to its `onMint`
// prop; the affordance owns the lazy-on-tap behavior.
//
// ── Why the refresh token rides in the body ─────────────────────────
// The code must carry the web anonymous session's refresh token so the
// freshly-installed app can resume the exact same anonymous identity
// (`linkApple`, not `signInWithApple`). The browser already holds its
// own refresh token in the Supabase session; this client reads it off
// `auth.getSession()` and posts it to the Edge Function, which encrypts
// it before storage. `functions.invoke` forwards the live access-token
// JWT in the Authorization header automatically — that is what the
// Edge Function authenticates the caller with.

"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabase";

export interface ClaimCodeMintDeps {
  /** The Supabase client. Defaults to the shared browser singleton;
   *  injectable so tests can pass a fake. */
  client?: SupabaseClient;
}

interface MintResponse {
  status?: string;
  code?: string;
  expires_at?: string;
}

/** Mint a single-use claim code from the caller's live web session.
 *  Resolves to the 8-character code; rejects when there is no live
 *  session, the Edge Function errors, or the response carries no code.
 *
 *  The "Getting the app?" affordance calls this on tap (lazy mint) and
 *  on a re-mint — each call yields a fresh code. */
export async function mintClaimCode(
  deps: ClaimCodeMintDeps = {},
): Promise<string> {
  const client = deps.client ?? getSupabaseClient();

  // Read the web anonymous session's refresh token — the thing the
  // claim code carries.
  const { data: sessionData } = await client.auth.getSession();
  const refreshToken = sessionData.session?.refresh_token;
  if (!refreshToken) {
    throw new Error("No live web session to mint a claim code from.");
  }

  // Invoke the Edge Function. `functions.invoke` attaches the caller's
  // access-token JWT in the Authorization header automatically — that
  // is how the function authenticates the caller.
  const { data, error } = await client.functions.invoke<MintResponse>(
    "mint-claim-code",
    { body: { refresh_token: refreshToken } },
  );
  if (error) {
    throw new Error(
      `Claim-code mint failed: ${error.message ?? "unknown error"}`,
    );
  }
  const code = data?.code;
  if (!code) {
    throw new Error("Claim-code mint returned no code.");
  }
  return code;
}
