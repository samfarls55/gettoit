// GetToIt web — Supabase browser client.
//
// Singleton client created with the public anon key. Reads
// `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The keys
// are public — RLS policies are the actual gate, see
// `supabase/migrations/*` and ADR 0003.
//
// Anonymous auth is the web fallback's identity model per ADR 0007:
// invitees stay anonymous indefinitely on the browser (no Sign in with
// Apple chip per ticket TB-15 hard rule 4). The web client signs in
// anonymously the first time a session route loads, then reuses the
// resulting JWT for inserts (votes + member rows).

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars are missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Ensure the browser session is signed in anonymously. Returns the
// user id. Idempotent — if the session already has a user, returns
// that user's id without a network round-trip.
export async function ensureAnonSession(): Promise<string> {
  const client = getSupabaseClient();
  const { data: session } = await client.auth.getSession();
  if (session.session?.user?.id) {
    return session.session.user.id;
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error("anon sign-in returned no user id");
  }
  return userId;
}
