// tb-WF-13 — schema guard for the claim_codes migration.
//
// Asserts the structural shape of the committed migration rather than
// running it against a live PG — the `supabase-db` CI lane already
// exercises a real `supabase db push --linked` against `gettoit-prod`
// on merge. This test catches an accidental loosening of the RLS lock
// or a missing column before it reaches that lane.

import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

function migrationBySuffix(suffix: string): string {
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(suffix)) {
      return Deno.readTextFileSync(new URL(entry.name, MIGRATIONS_DIR));
    }
  }
  throw new Error(`no migration ending in '${suffix}' found`);
}

function claimCodesMigration(): string {
  return migrationBySuffix("_claim_codes.sql");
}

Deno.test("tb-WF-13: migration creates the public.claim_codes table", () => {
  const sql = claimCodesMigration();
  assert(
    /create table if not exists public\.claim_codes/i.test(sql),
    "expected `create table if not exists public.claim_codes`",
  );
});

Deno.test("tb-WF-13: claim_codes carries code, encrypted_token, expiry, redeemed marker", () => {
  const sql = claimCodesMigration();
  // The code is the primary key.
  assert(
    /code\s+text\s+primary key/i.test(sql),
    "expected `code text primary key`",
  );
  // The encrypted refresh token column.
  assert(
    /encrypted_token\s+text\s+not null/i.test(sql),
    "expected `encrypted_token text not null`",
  );
  // A ~30-minute TTL expiry column.
  assertStringIncludes(sql, "expires_at");
  assert(
    /interval\s+'30 minutes'/i.test(sql),
    "expected a ~30-minute TTL default on expires_at",
  );
  // The single-use redeemed marker.
  assertStringIncludes(sql, "redeemed_at");
});

Deno.test("tb-WF-13: RLS is enabled on claim_codes", () => {
  const sql = claimCodesMigration();
  assert(
    /alter table public\.claim_codes\s+enable row level security/i.test(sql),
    "expected RLS enabled on public.claim_codes",
  );
});

Deno.test("tb-WF-13: claim_codes has NO RLS policy — service-role only", () => {
  const sql = claimCodesMigration();
  // The whole point of the lock is that no `create policy` touches the
  // table — RLS-on + zero policies denies every non-superuser role, so
  // only the service-role key (which bypasses RLS) reaches it. A policy
  // appearing here would be a real regression.
  assert(
    !/create policy[^;]*on public\.claim_codes/i.test(sql),
    "claim_codes must have NO RLS policy — a policy would open a client path",
  );
  // Belt-and-braces: the table grants are revoked from anon /
  // authenticated so PostgREST cannot reach it at all.
  assert(
    /revoke all on table public\.claim_codes from anon, authenticated/i
      .test(sql),
    "expected table grants revoked from anon, authenticated",
  );
});
