import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);
const SEED_SQL = new URL("../../seed.sql", import.meta.url);

function migrationBySuffix(suffix: string): string {
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(suffix)) {
      return Deno.readTextFileSync(new URL(entry.name, MIGRATIONS_DIR));
    }
  }
  throw new Error(`no migration ending in '${suffix}' found`);
}

function compact(sql: string): string {
  return sql.toLowerCase().replace(/\s+/g, " ");
}

function explicitGrantMigration(): string {
  return migrationBySuffix("_data_api_explicit_grants.sql");
}

function repairRerollMigration(): string {
  return migrationBySuffix("_repair_apply_reroll_generic_votes.sql");
}

Deno.test("production-like grants expose client Data API tables explicitly", () => {
  const sql = compact(explicitGrantMigration());

  assertStringIncludes(
    sql,
    "grant usage on schema public to anon, authenticated, service_role",
  );
  assertStringIncludes(sql, "grant select, insert, update, delete on table");
  for (const table of ["plans", "rooms", "members", "votes"]) {
    assertStringIncludes(sql, `public.${table}`);
  }
  assertStringIncludes(sql, "to authenticated");
});

Deno.test("production-like grants keep claim_codes service-only", () => {
  const sql = compact(explicitGrantMigration());

  assertStringIncludes(
    sql,
    "revoke all on table public.claim_codes from anon, authenticated",
  );
  assert(
    !/grant\s+(select|insert|update|delete|all privileges)[^;]*public\.claim_codes[^;]*to authenticated/i
      .test(explicitGrantMigration()),
    "claim_codes must not be granted to authenticated clients",
  );
});

Deno.test("production-like grants cover edge function support tables for service_role", () => {
  const sql = compact(explicitGrantMigration());

  assertStringIncludes(sql, "grant all privileges on table");
  for (
    const table of [
      "events",
      "check_ins",
      "ratifications",
      "push_tokens",
      "user_preferences",
      "claim_codes",
      "app_config",
    ]
  ) {
    assertStringIncludes(sql, `public.${table}`);
  }
  assertStringIncludes(sql, "to service_role");
});

Deno.test("local seed is synthetic, rerunnable, and non-destructive", () => {
  const sql = Deno.readTextFileSync(SEED_SQL);
  const normalized = compact(sql);

  assertStringIncludes(normalized, "local synthetic data only");
  assertStringIncludes(normalized, "on conflict");
  assert(
    !/\btruncate\b|\bdelete\s+from\b|\bdrop\s+table\b/i.test(sql),
    "seed must not delete, truncate, or drop local data",
  );
});

Deno.test("local seed covers plan lifecycle, rooms, votes, verdicts, and rerolls", () => {
  const sql = compact(Deno.readTextFileSync(SEED_SQL));

  assertStringIncludes(sql, "from generate_series(1, 48)");
  assertStringIncludes(sql, "from generate_series(1, 96)");
  for (
    const table of [
      "auth.users",
      "public.plans",
      "public.rooms",
      "public.members",
      "public.votes",
      "public.options",
      "public.verdicts",
      "public.verdict_slate_entries",
      "public.rerolls",
    ]
  ) {
    assertStringIncludes(sql, `insert into ${table}`);
  }
  for (const state of ["pending", "decided-active", "decided-expired"]) {
    assertStringIncludes(sql, state);
  }
  for (const state of ["open", "verdict_ready", "locked", "expired"]) {
    assertStringIncludes(sql, state);
  }
});

Deno.test("local seed leaves open rooms partially voted to avoid auto-firing triggers", () => {
  const sql = compact(Deno.readTextFileSync(SEED_SQL));

  assertStringIncludes(sql, "where n % 4 <> 0 and (n % 4 <> 1 or participant_offset in (0, 7))");
  assertStringIncludes(sql, "'regret'");
});

Deno.test("reroll repair uses generic JSONB vote helpers", () => {
  const rawSql = repairRerollMigration();
  const sql = compact(rawSql);

  assertStringIncludes(sql, "public.votes_min_int_answer");
  assertStringIncludes(sql, "public.votes_patch_answer");
  assert(
    !/\bq2_budget\b|\bq3_walk_minutes\b|\bq4_vibe\b|\bq1_vetoes_extra\b/i
      .test(rawSql),
    "apply_reroll must not reference retired typed vote columns",
  );
});
