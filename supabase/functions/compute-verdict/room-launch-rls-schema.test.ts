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

function roomLaunchRlsMigration(): string {
  return migrationBySuffix("_rooms_select_creator_policy.sql");
}

Deno.test("Plan launch Room insert can return the creator's Room before membership exists", () => {
  const sql = roomLaunchRlsMigration();

  assertStringIncludes(sql, 'drop policy if exists "rooms_select_creator"');
  assertStringIncludes(
    sql,
    'create policy "rooms_select_creator" on public.rooms',
  );
  assert(
    /for\s+select/i.test(sql),
    "expected rooms_select_creator to be a SELECT policy",
  );
  assertStringIncludes(sql, "to authenticated");
  assertStringIncludes(sql, "creator_user_id = (select auth.uid())");
});
