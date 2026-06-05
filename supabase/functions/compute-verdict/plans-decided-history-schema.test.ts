// tb-WF-8 — schema guards for the Decided/History lifecycle migration.
//
// tb-WF-8 adds the visible Plan lifecycle on the S00 Plan list:
//
//   * Two new columns on `public.plans`:
//       - `verdict_fired_at timestamptz` — when the Plan flipped
//         `pending → decided-active`. Sort key for the Decided
//         section per surfaces/00-plan-list.md §"Ordering within
//         sections" (Q7).
//       - `expired_at timestamptz` — when the Plan flipped
//         `decided-active → decided-expired`. Sort key for the
//         History section.
//   * `set_plan_decided_active(uuid)` is amended to stamp
//     `verdict_fired_at = now()` alongside the existing fields.
//   * A new SECURITY DEFINER function `set_plan_decided_expired(uuid)`
//     transitions a plan to `decided-expired` and stamps `expired_at`.
//   * A pg_cron worker scans `decided-active` plans whose
//     `reroll_window_closes_at <= now()` and expires them — the
//     "reroll window closes" transition per the issue body.
//   * Triggers on `public.rerolls` (3rd burn) and `public.check_ins`
//     (any outcome) expire the linked plan via the same
//     `set_plan_decided_expired` function.
//   * Two new RPCs back the Decided + History sections of the mobile S00
//     Plan list:
//       - `plans_decided_for_user(uuid)` — Created + Joined Plans in
//         status='decided-active', joined inline with the verdict's
//         place name, ordered by `verdict_fired_at DESC`.
//       - `plans_history_for_user(uuid)`  — same for
//         status='decided-expired', ordered by `expired_at DESC`.
//
// These tests assert the structural shape of the committed migration
// rather than running it against a live PG — the `supabase-db` CI
// lane already exercises a real `supabase db push --linked` against
// `gettoit-prod` on merge.

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

function decidedHistoryMigration(): string {
  return migrationBySuffix("_plans_decided_history_lifecycle.sql");
}

// ── New columns ────────────────────────────────────────────────────

Deno.test("tb-WF-8: migration adds plans.verdict_fired_at (timestamptz, nullable)", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(sql, "verdict_fired_at");
  assert(
    /add column if not exists verdict_fired_at\s+timestamptz/i.test(sql),
    "expected `add column if not exists verdict_fired_at timestamptz`",
  );
});

Deno.test("tb-WF-8: migration adds plans.expired_at (timestamptz, nullable)", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(sql, "expired_at");
  assert(
    /add column if not exists expired_at\s+timestamptz/i.test(sql),
    "expected `add column if not exists expired_at timestamptz`",
  );
});

// ── set_plan_decided_active amendment ──────────────────────────────

Deno.test("tb-WF-8: set_plan_decided_active stamps verdict_fired_at", () => {
  const sql = decidedHistoryMigration();
  assert(
    /create or replace function public\.set_plan_decided_active[\s\S]+verdict_fired_at\s*=\s*now\(\)/i
      .test(sql),
    "expected set_plan_decided_active to stamp verdict_fired_at = now()",
  );
});

// ── set_plan_decided_expired function ──────────────────────────────

Deno.test("tb-WF-8: set_plan_decided_expired is a SECURITY DEFINER function", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(
    sql,
    "create or replace function public.set_plan_decided_expired",
  );
  assert(
    /create or replace function public\.set_plan_decided_expired[\s\S]{0,400}security definer/i
      .test(sql),
    "expected set_plan_decided_expired to be SECURITY DEFINER",
  );
});

Deno.test("tb-WF-8: set_plan_decided_expired flips status to decided-expired", () => {
  const sql = decidedHistoryMigration();
  assert(
    /set_plan_decided_expired[\s\S]+update\s+public\.plans[\s\S]+status\s*=\s*'decided-expired'/i
      .test(sql),
    "expected set_plan_decided_expired to set status='decided-expired'",
  );
});

Deno.test("tb-WF-8: set_plan_decided_expired stamps expired_at", () => {
  const sql = decidedHistoryMigration();
  assert(
    /set_plan_decided_expired[\s\S]+expired_at\s*=\s*now\(\)/i.test(sql),
    "expected set_plan_decided_expired to stamp expired_at = now()",
  );
});

Deno.test("tb-WF-8: set_plan_decided_expired is idempotent (where status = 'decided-active')", () => {
  const sql = decidedHistoryMigration();
  // Idempotent: re-invoking on an already-expired plan is a no-op.
  assert(
    /set_plan_decided_expired[\s\S]+where[\s\S]+status\s*=\s*'decided-active'/i
      .test(sql),
    "expected the set_plan_decided_expired body to gate on status='decided-active'",
  );
});

// ── reroll-window-close cron worker ────────────────────────────────

Deno.test("tb-WF-8: pg_cron worker expires plans whose reroll window has elapsed", () => {
  const sql = decidedHistoryMigration();
  // Function scans decided-active plans with reroll_window_closes_at
  // already passed, and calls set_plan_decided_expired on each.
  assert(
    /create or replace function public\.cron_expire_reroll_windows/i.test(sql),
    "expected `cron_expire_reroll_windows` function",
  );
  assertStringIncludes(sql, "decided-active");
  assert(
    /reroll_window_closes_at\s*<=\s*now\(\)/i.test(sql),
    "expected the cron worker to filter by reroll_window_closes_at <= now()",
  );
});

Deno.test("tb-WF-8: pg_cron worker is scheduled every minute", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(sql, "cron.schedule");
  assertStringIncludes(sql, "gettoit_expire_reroll_windows");
});

// ── 3rd-burn → expire trigger ──────────────────────────────────────

Deno.test("tb-WF-8: rerolls AFTER INSERT trigger expires the plan on the 3rd burn", () => {
  const sql = decidedHistoryMigration();
  assert(
    /create or replace function public\.tg_rerolls_maybe_expire_plan/i.test(sql),
    "expected `tg_rerolls_maybe_expire_plan` trigger function",
  );
  // Count the reroll rows and expire when count >= 3.
  assert(
    /count\(\*\)[\s\S]+from public\.rerolls[\s\S]+>=\s*3/i.test(sql),
    "expected the trigger to expire the plan when reroll count >= 3",
  );
  assert(
    /set_plan_decided_expired/i.test(sql),
    "expected the trigger to invoke set_plan_decided_expired",
  );
  // Wires up as AFTER INSERT trigger on public.rerolls.
  assert(
    /create trigger[\s\S]+after insert on public\.rerolls/i.test(sql),
    "expected an AFTER INSERT trigger on public.rerolls",
  );
});

// ── check-in → expire trigger ──────────────────────────────────────

Deno.test("tb-WF-8: check_ins AFTER INSERT trigger expires the plan on check-in", () => {
  const sql = decidedHistoryMigration();
  assert(
    /create or replace function public\.tg_check_ins_maybe_expire_plan/i.test(sql),
    "expected `tg_check_ins_maybe_expire_plan` trigger function",
  );
  assert(
    /set_plan_decided_expired/i.test(sql),
    "expected the check-in trigger to invoke set_plan_decided_expired",
  );
  // Wires up as AFTER INSERT trigger on public.check_ins.
  assert(
    /create trigger[\s\S]+after insert on public\.check_ins/i.test(sql),
    "expected an AFTER INSERT trigger on public.check_ins",
  );
});

// ── plans_decided_for_user RPC ─────────────────────────────────────

Deno.test("tb-WF-8: plans_decided_for_user RPC exists, returns plan rows + verdict_place_name", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(
    sql,
    "create or replace function public.plans_decided_for_user",
  );
  // Projects the verdict place name from options.payload->>'name'.
  assertStringIncludes(sql, "verdict_place_name");
  assert(
    /payload\s*->>\s*'name'/i.test(sql),
    "expected the RPC body to extract options.payload->>'name'",
  );
});

Deno.test("tb-WF-8: plans_decided_for_user orders by verdict_fired_at DESC", () => {
  const sql = decidedHistoryMigration();
  assert(
    /plans_decided_for_user[\s\S]+order by[\s\S]+verdict_fired_at\s+desc/i.test(sql),
    "expected plans_decided_for_user to order by verdict_fired_at DESC",
  );
});

Deno.test("tb-WF-8: plans_decided_for_user filters status='decided-active'", () => {
  const sql = decidedHistoryMigration();
  assert(
    /plans_decided_for_user[\s\S]+status\s*=\s*'decided-active'/i.test(sql),
    "expected plans_decided_for_user to gate on status='decided-active'",
  );
});

// ── plans_history_for_user RPC ─────────────────────────────────────

Deno.test("tb-WF-8: plans_history_for_user RPC exists with verdict_place_name", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(
    sql,
    "create or replace function public.plans_history_for_user",
  );
  assert(
    /plans_history_for_user[\s\S]+verdict_place_name/i.test(sql),
    "expected plans_history_for_user to project verdict_place_name",
  );
});

Deno.test("tb-WF-8: plans_history_for_user orders by expired_at DESC", () => {
  const sql = decidedHistoryMigration();
  assert(
    /plans_history_for_user[\s\S]+order by[\s\S]+expired_at\s+desc/i.test(sql),
    "expected plans_history_for_user to order by expired_at DESC",
  );
});

Deno.test("tb-WF-8: plans_history_for_user filters status='decided-expired'", () => {
  const sql = decidedHistoryMigration();
  assert(
    /plans_history_for_user[\s\S]+status\s*=\s*'decided-expired'/i.test(sql),
    "expected plans_history_for_user to gate on status='decided-expired'",
  );
});

// ── Role flag (Created vs Joined) ──────────────────────────────────

Deno.test("tb-WF-8: decided + history RPCs project a `role` column ('owner' | 'joined')", () => {
  const sql = decidedHistoryMigration();
  // Both RPCs return a `role` text column so the mobile surface can
  // render the JOINED chip on Joined cards without an extra lookup.
  assert(
    /plans_decided_for_user[\s\S]+role\s+text/i.test(sql),
    "expected plans_decided_for_user to return a role text column",
  );
  assert(
    /plans_history_for_user[\s\S]+role\s+text/i.test(sql),
    "expected plans_history_for_user to return a role text column",
  );
});

// ── Grants ─────────────────────────────────────────────────────────

Deno.test("tb-WF-8: RPCs and helpers are granted to authenticated", () => {
  const sql = decidedHistoryMigration();
  assertStringIncludes(
    sql,
    "grant execute on function public.set_plan_decided_expired(uuid) to authenticated",
  );
  assertStringIncludes(
    sql,
    "grant execute on function public.plans_decided_for_user(uuid) to authenticated",
  );
  assertStringIncludes(
    sql,
    "grant execute on function public.plans_history_for_user(uuid) to authenticated",
  );
});
