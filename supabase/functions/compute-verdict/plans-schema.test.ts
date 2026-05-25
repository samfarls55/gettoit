// tb-WF-1 — guards for the workflow-overhaul `plans` table migration.
//
// The workflow-overhaul phase promotes today's ephemeral `rooms` row
// into a durable `Plan` entity. This issue lands the schema + the
// state-transition function used by `compute-verdict`; the iOS read
// path is the `PlansStore` covered by Swift tests.
//
// These tests assert the structural shape of the committed migration
// rather than running it against a live PG — the `supabase-db` CI
// lane already exercises a real `supabase db push --linked` against
// `gettoit-prod` on merge. What we want here is a regression guard
// that survives reformatting: the migration file's intent does not
// silently drift over time. We parse the SQL as plain text and assert
// the columns, constraints, RLS policies, and helper function all
// remain present.
//
// References:
//   * gti-vault/15_issues/0.1.0/issues/tb-wf-1-plans-table-schema.md
//   * gti-vault/50_product/0.1.0-workflow-overhaul-plan-setup.md
//   * gti-vault/60_engineering/adr/0010-generic-jsonb-votes-schema.md
//     (precedent for `session_params` jsonb shape)

import {
  assert,
  assertEquals,
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

function plansMigration(): string {
  return migrationBySuffix("_workflow_overhaul_plans_table.sql");
}

// ── plans table shape ───────────────────────────────────────────────

Deno.test("tb-WF-1: migration creates public.plans", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "create table public.plans");
});

Deno.test("tb-WF-1: plans.id is uuid primary key default gen_random_uuid", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "id");
  assertStringIncludes(sql, "uuid primary key default gen_random_uuid()");
});

Deno.test("tb-WF-1: plans.creator_id FKs auth.users on delete cascade", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "creator_id");
  assertStringIncludes(sql, "references auth.users(id) on delete cascade");
});

Deno.test("tb-WF-1: plans.name has 1..40 char_length CHECK", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "char_length(name) between 1 and 40");
});

Deno.test("tb-WF-1: plans.category defaults 'food' with single-value CHECK", () => {
  const sql = plansMigration();
  // category text not null default 'food' check (category in ('food'))
  assertStringIncludes(sql, "category");
  assertStringIncludes(sql, "default 'food'");
  assertStringIncludes(sql, "category in ('food')");
});

Deno.test("tb-WF-1: plans.scope defaults 'group' with solo/duo/group CHECK", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "scope");
  assertStringIncludes(sql, "default 'group'");
  assertStringIncludes(sql, "scope in ('solo', 'duo', 'group')");
});

Deno.test("tb-WF-1: plans.location is jsonb (nullable)", () => {
  const sql = plansMigration();
  // The column is declared as jsonb; null is allowed (no `not null`).
  assert(/location\s+jsonb/.test(sql), "expected `location jsonb` column declaration");
});

Deno.test("tb-WF-1: plans.session_params is jsonb not null default empty object", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "session_params");
  assertStringIncludes(sql, "jsonb not null default '{}'::jsonb");
});

Deno.test("tb-WF-1: plans.distance_meters defaults 1609 (1.0 mi)", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "distance_meters");
  assertStringIncludes(sql, "default 1609");
});

Deno.test("tb-WF-1: plans.status defaults 'pending' with three lifecycle values", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "status");
  assertStringIncludes(sql, "default 'pending'");
  // pending → decided-active → decided-expired
  assertStringIncludes(sql, "'pending'");
  assertStringIncludes(sql, "'decided-active'");
  assertStringIncludes(sql, "'decided-expired'");
});

Deno.test("tb-WF-1: plans.reroll_window_closes_at is nullable timestamptz", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "reroll_window_closes_at");
  assert(
    /reroll_window_closes_at\s+timestamptz(?!\s+not\s+null)/.test(sql),
    "reroll_window_closes_at must be timestamptz and nullable (no NOT NULL)",
  );
});

Deno.test("tb-WF-1: plans has created_at + updated_at defaulted to now()", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "created_at");
  assertStringIncludes(sql, "updated_at");
  assertStringIncludes(sql, "default now()");
});

// ── updated_at trigger ──────────────────────────────────────────────

Deno.test("tb-WF-1: updated_at is refreshed by a BEFORE UPDATE trigger", () => {
  const sql = plansMigration();
  // We don't pin the function name verbatim — just that a trigger
  // function refreshes `updated_at` and a `before update on
  // public.plans` trigger wires it up.
  assert(
    /new\.updated_at\s*=\s*now\(\)/.test(sql),
    "expected the trigger function body to set new.updated_at = now()",
  );
  assert(
    /create trigger[\s\S]*before update on public\.plans/i.test(sql),
    "expected a BEFORE UPDATE trigger on public.plans",
  );
});

// ── rooms.plan_id extension ─────────────────────────────────────────

Deno.test("tb-WF-1: rooms.plan_id is added as nullable FK to plans", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "alter table public.rooms");
  assertStringIncludes(sql, "plan_id uuid");
  assertStringIncludes(sql, "references public.plans(id) on delete set null");
});

Deno.test("tb-WF-1: rooms.plan_id has a partial index", () => {
  const sql = plansMigration();
  // create index rooms_plan_id_idx on public.rooms (plan_id) where plan_id is not null;
  assertStringIncludes(sql, "rooms_plan_id_idx");
  assertStringIncludes(sql, "where plan_id is not null");
});

// ── RLS ─────────────────────────────────────────────────────────────

Deno.test("tb-WF-1: plans has RLS enabled", () => {
  const sql = plansMigration();
  assertStringIncludes(sql, "alter table public.plans enable row level security");
});

Deno.test("tb-WF-1: plans RLS gates select/insert/update/delete to the creator", () => {
  const sql = plansMigration();
  // The four policies all key off `creator_id = auth.uid()`. We
  // assert the policy exists for each verb plus the creator predicate.
  for (const verb of ["select", "insert", "update", "delete"]) {
    assert(
      new RegExp(`for\\s+${verb}`, "i").test(sql),
      `expected an RLS policy for ${verb}`,
    );
  }
  // The creator-self predicate appears multiple times across the
  // four policies; assertStringIncludes is enough to lock the shape.
  assertStringIncludes(sql, "creator_id = (select auth.uid())");
});

// ── state-transition function ───────────────────────────────────────

Deno.test("tb-WF-1: set_plan_decided_active is a security-definer function", () => {
  const sql = plansMigration();
  assertStringIncludes(
    sql,
    "create or replace function public.set_plan_decided_active",
  );
  assert(
    /create or replace function public\.set_plan_decided_active[\s\S]{0,400}security definer/i
      .test(sql),
    "expected set_plan_decided_active to be SECURITY DEFINER",
  );
});

Deno.test("tb-WF-1: set_plan_decided_active flips status to decided-active", () => {
  const sql = plansMigration();
  // Updates plans set status='decided-active' where id = p_plan_id
  assert(
    /update\s+public\.plans[\s\S]+set[\s\S]+status\s*=\s*'decided-active'/i.test(sql),
    "expected set_plan_decided_active to set status='decided-active'",
  );
});

Deno.test("tb-WF-1: set_plan_decided_active populates reroll_window_closes_at", () => {
  const sql = plansMigration();
  // Function body references reroll_window_closes_at — the exact
  // server-side computation mechanism is sg-WF-6; this issue just
  // provisions the field and stamps a non-null value.
  assertStringIncludes(sql, "reroll_window_closes_at");
  assert(
    /set_plan_decided_active[\s\S]+reroll_window_closes_at/i.test(sql),
    "expected set_plan_decided_active body to write reroll_window_closes_at",
  );
});
