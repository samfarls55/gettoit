// tb-WF-11 — schema guard for the members.display_name migration.
//
// The web invitee shell (sg-WF-5 surface §A) writes the first real
// display-name source into a new `members.display_name` column. This
// test asserts the structural shape of the committed migration rather
// than running it against a live PG — the `supabase-db` CI lane already
// exercises a real `supabase db push --linked` against `gettoit-prod`
// on merge.

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

function displayNameMigration(): string {
  return migrationBySuffix("_members_display_name.sql");
}

Deno.test("tb-WF-11: migration adds members.display_name as a nullable text column", () => {
  const sql = displayNameMigration();
  assertStringIncludes(sql, "display_name");
  // Additive: `add column if not exists`, typed `text`.
  assert(
    /alter table public\.members[\s\S]*add column if not exists display_name\s+text/i
      .test(sql),
    "expected `alter table public.members ... add column if not exists display_name text`",
  );
});

Deno.test("tb-WF-11: migration does NOT set a NOT NULL constraint on display_name", () => {
  const sql = displayNameMigration();
  // The column must stay nullable — a NULL is the explicit "no name
  // entered" signal the verdict fallback keys on (iOS members).
  assert(
    !/display_name\s+text[\s\S]{0,40}not null/i.test(sql),
    "expected display_name to remain nullable (no NOT NULL constraint)",
  );
});

Deno.test("tb-WF-11: migration does NOT set a DEFAULT on display_name", () => {
  const sql = displayNameMigration();
  // No default — a non-NULL empty-string default would defeat the
  // NULL-means-no-name distinction the verdict fallback relies on.
  assert(
    !/display_name\s+text[\s\S]{0,40}default/i.test(sql),
    "expected display_name to have no DEFAULT",
  );
});

Deno.test("tb-WF-11: migration documents the column with a COMMENT", () => {
  const sql = displayNameMigration();
  assertStringIncludes(sql, "comment on column public.members.display_name");
});
