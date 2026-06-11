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

function lockMigration(): string {
  return migrationBySuffix("_lock_active_room_parameters.sql");
}

Deno.test("TB-06: pending Plans cannot be edited after a Room is minted", () => {
  const sql = lockMigration();
  assertStringIncludes(sql, "drop policy if exists \"plans_update_creator\"");
  assertStringIncludes(sql, "create policy \"plans_update_creator\"");
  assertStringIncludes(sql, "status = 'pending'");
  assert(
    /not\s+exists\s*\(\s*select\s+1[\s\S]*from\s+public\.rooms[\s\S]*where\s+r\.plan_id\s*=\s*plans\.id/i
      .test(sql),
    "expected plans_update_creator to reject updates once a Room points at the Plan",
  );
});

Deno.test("TB-06: Plan-backed Room parameter mutations raise search_area_locked", () => {
  const sql = lockMigration();
  assertStringIncludes(sql, "prevent_active_room_parameter_mutation");
  assertStringIncludes(sql, "old.plan_id is not null");
  assertStringIncludes(sql, "message = 'search_area_locked'");
  for (
    const column of [
      "location_name",
      "location_lat",
      "location_lng",
      "location_source",
      "radius_meters",
      "timer_minutes",
      "session_params",
    ]
  ) {
    assertStringIncludes(sql, `new.${column} is distinct from old.${column}`);
  }
  assertStringIncludes(sql, "create trigger rooms_lock_active_parameters");
});
