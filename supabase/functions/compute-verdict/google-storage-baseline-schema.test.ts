// TB-02 (Google provider migration) — durable storage boundary guards.
//
// These tests assert the committed migration shape that a fresh
// Supabase reset ends with. They intentionally inspect migration SQL:
// the linked Supabase lane runs real database pushes, while local edge
// verification can still catch accidental reintroduction of provider
// caches, display-content snapshots, or raw payload storage.

import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);
const BASELINE_SUFFIX = "_google_only_durable_storage_baseline.sql";
const SLATE_REROLL_SUFFIX = "_verdict_slate_reroll_rpc.sql";
const FORBIDDEN_DISPLAY_COLUMN_NAMES = [
  "display_name",
  "place_name",
  "formatted_address",
  "address",
  "maps_uri",
  "summary",
  "rating",
  "hours",
  "price",
  "atmosphere",
  "types",
  "photos",
  "raw_payload",
  "distance",
];

function migrationBySuffix(suffix: string): string {
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(suffix)) {
      return Deno.readTextFileSync(new URL(entry.name, MIGRATIONS_DIR));
    }
  }
  throw new Error(`no migration ending in '${suffix}' found`);
}

function baselineMigration(): string {
  return migrationBySuffix(BASELINE_SUFFIX);
}

function slateRerollMigration(): string {
  return migrationBySuffix(SLATE_REROLL_SUFFIX);
}

function assertSqlDoesNotMatch(
  sql: string,
  pattern: RegExp,
  message: string,
): void {
  assert(!pattern.test(sql), message);
}

Deno.test("TB-02: baseline removes active Foursquare and MapKit storage artifacts", () => {
  const sql = baselineMigration();

  assertStringIncludes(sql, "drop table if exists public.places");
  assertStringIncludes(sql, "drop table if exists public.member_fetches");
  assertStringIncludes(sql, "drop column if exists fsq_place_id");
  assertStringIncludes(sql, "drop column if exists payload");

  assertSqlDoesNotMatch(
    sql,
    /\bmapkit\b/i,
    "baseline must not retain MapKit storage",
  );
  assertSqlDoesNotMatch(
    sql,
    /\bfoursquare\b/i,
    "baseline must not retain Foursquare storage",
  );
});

Deno.test("TB-02: options durable identity is Google provider plus Google Place ID", () => {
  const sql = baselineMigration();

  assert(
    /alter table public\.options[\s\S]+add column if not exists place_provider\s+text/i
      .test(sql),
    "expected options.place_provider text",
  );
  assert(
    /alter table public\.options[\s\S]+add column if not exists google_place_id\s+text/i
      .test(sql),
    "expected options.google_place_id text",
  );
  assertStringIncludes(sql, "check (place_provider = 'google')");
  assertStringIncludes(
    sql,
    "unique (room_id, place_provider, google_place_id)",
  );
});

Deno.test("TB-02: verdict slate stores top-four Google IDs and app-owned metadata", () => {
  const sql = baselineMigration();

  assertStringIncludes(
    sql,
    "create table if not exists public.verdict_slate_entries",
  );
  assertStringIncludes(sql, "google_place_id");
  assertStringIncludes(sql, "slate_rank");
  assertStringIncludes(sql, "final_fit_score");
  assertStringIncludes(sql, "scoring_version");
  assertStringIncludes(sql, "receipts");
  assertStringIncludes(sql, "check (slate_rank between 1 and 4)");
  assertStringIncludes(sql, "check (place_provider = 'google')");
});

Deno.test("TB-11: slate reroll RPC advances through stored Google slate without display storage", () => {
  const sql = slateRerollMigration();

  assertStringIncludes(sql, "create or replace function public.apply_verdict_slate_reroll");
  assertStringIncludes(sql, "public.verdict_slate_entries");
  assertStringIncludes(sql, "google_place_id = p_google_place_id");
  assertStringIncludes(sql, "insert into public.rerolls");
  assertStringIncludes(sql, "winner_google_place_id = p_google_place_id");
  assertStringIncludes(sql, "grant execute on function public.apply_verdict_slate_reroll");

  for (const forbidden of ["display_name", "formatted_address", "maps_uri", "rating", "hours", "photos", "summary"]) {
    assertSqlDoesNotMatch(
      sql,
      new RegExp(`\\b${forbidden}\\b`, "i"),
      `slate reroll RPC must not store ${forbidden}`,
    );
  }
});

Deno.test("TB-11: slate reroll RPC burns only after membership, cap, verdict, and slate checks", () => {
  const sql = slateRerollMigration();
  const burnIndex = sql.toLowerCase().indexOf("insert into public.rerolls");

  for (
    const requiredBeforeBurn of [
      "not_a_member",
      "cap_exhausted",
      "verdict_not_found",
      "not_in_slate",
    ]
  ) {
    const guardIndex = sql.toLowerCase().indexOf(requiredBeforeBurn);
    assert(
      guardIndex >= 0 && guardIndex < burnIndex,
      `${requiredBeforeBurn} guard must run before the reroll burn insert`,
    );
  }
});

Deno.test("TB-02: durable schema does not add forbidden Google display-content fields", () => {
  const sql = baselineMigration();

  for (const name of FORBIDDEN_DISPLAY_COLUMN_NAMES) {
    assertSqlDoesNotMatch(
      sql,
      new RegExp(`add column if not exists\\s+${name}\\b`, "i"),
      `baseline migration must not add durable ${name}`,
    );
  }
});

Deno.test("TB-02: Plan list RPCs stop projecting stored verdict place names", () => {
  const sql = baselineMigration();

  assertStringIncludes(
    sql,
    "create or replace function public.plans_decided_for_user",
  );
  assertStringIncludes(
    sql,
    "create or replace function public.plans_history_for_user",
  );
  assertSqlDoesNotMatch(
    sql,
    /\bverdict_place_name\b/i,
    "Plan list RPCs must not project verdict_place_name",
  );
  assertSqlDoesNotMatch(
    sql,
    /payload\s*->>\s*'name'/i,
    "Plan list RPCs must not project provider payload names",
  );
});
