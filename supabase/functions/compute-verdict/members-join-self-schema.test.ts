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

function joinSelfMigration(): string {
  return migrationBySuffix("_members_join_self_rpc.sql");
}

Deno.test("members_join_self pins membership identity and role server-side", () => {
  const sql = joinSelfMigration();

  assertStringIncludes(sql, "create or replace function public.members_join_self");
  assertStringIncludes(sql, "v_caller uuid := (select auth.uid())");
  assert(
    /insert into public\.members\s*\(room_id,\s*user_id,\s*role,\s*display_name\)[\s\S]*values\s*\(p_room_id,\s*v_caller,\s*'participant',\s*v_display_name\)/i
      .test(sql),
    "expected members_join_self to write auth.uid() and participant role",
  );
});

Deno.test("members_join_self is exposed only as an authenticated RPC", () => {
  const sql = joinSelfMigration();

  assertStringIncludes(sql, "security definer");
  assertStringIncludes(sql, "set search_path = ''");
  assertStringIncludes(sql, "revoke all on function public.members_join_self(uuid, text) from public");
  assertStringIncludes(sql, "grant execute on function public.members_join_self(uuid, text) to authenticated");
});

Deno.test("votes_submit_self pins voter identity and checks membership", () => {
  const sql = joinSelfMigration();

  assertStringIncludes(sql, "create or replace function public.votes_submit_self");
  assert(
    /from public\.members[\s\S]*where room_id = p_room_id[\s\S]*and user_id = v_caller/i
      .test(sql),
    "expected votes_submit_self to require current room membership",
  );
  assert(
    /insert into public\.votes\s*\(room_id,\s*user_id,\s*q1,\s*q2,\s*q3,\s*q4,\s*q5\)[\s\S]*values\s*\(p_room_id,\s*v_caller,\s*p_q1,\s*p_q2,\s*p_q3,\s*p_q4,\s*p_q5\)/i
      .test(sql),
    "expected votes_submit_self to write auth.uid() as votes.user_id",
  );
  assertStringIncludes(sql, "grant execute on function public.votes_submit_self(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated");
});

Deno.test("events_insert_self pins event identity and checks room membership", () => {
  const sql = joinSelfMigration();

  assertStringIncludes(sql, "create or replace function public.events_insert_self");
  assert(
    /p_room_id is not null and not exists \([\s\S]*from public\.members[\s\S]*where room_id = p_room_id[\s\S]*and user_id = v_caller/i
      .test(sql),
    "expected events_insert_self to require membership when room_id is present",
  );
  assert(
    /insert into public\.events\s*\(room_id,\s*user_id,\s*event_type,\s*properties\)[\s\S]*values\s*\(p_room_id,\s*v_caller,\s*p_event_type,\s*v_properties\)/i
      .test(sql),
    "expected events_insert_self to write auth.uid() as events.user_id",
  );
  assertStringIncludes(sql, "grant execute on function public.events_insert_self(text, uuid, jsonb) to authenticated");
});
