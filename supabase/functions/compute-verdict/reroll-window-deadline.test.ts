// sg-WF-6 — guards for the reroll-window-deadline migration + the
// deadline-formula reference computation.
//
// sg-WF-6 closes out the Plan reroll window (ADR 0016):
//
//   * `set_plan_decided_active(uuid)` — the tb-WF-1 placeholder
//     (`reroll_window_closes_at = now() + interval '2 days'`) is
//     replaced with the real search-area-TZ calendar-day formula:
//     the window closes at 23:59:59 on the calendar day AFTER the
//     verdict fired, measured in the Plan's
//     `location->>'timeZoneIdentifier'` (UTC fallback).
//   * `apply_reroll(uuid, text, text, text, int)` — gains a
//     time-exact `window_closed` guard: a reroll is rejected when the
//     room's linked Plan is `decided-expired`, OR `decided-active`
//     with `reroll_window_closes_at <= now()`. Null-`plan_id` rooms
//     (legacy S01-path) skip the guard.
//
// Two layers of coverage here:
//
//   1. **Structural** — the committed migration SQL carries the
//      formula + the guard. The `supabase-db` CI lane already runs a
//      real `supabase db push --linked` against gettoit-prod on
//      merge; these string-shape assertions are the regression guard
//      that the migration's intent does not silently drift.
//   2. **Behavioral** — the deadline-formula reference port in
//      `_shared/reroll-window.ts` is exercised end-to-end against
//      known instant/timezone pairs: a non-UTC zone, the UTC
//      fallback, and the calendar-day-boundary semantics. The SQL is
//      canonical; the port is kept in lockstep so the math is
//      executable in the test lane (Deno cannot run Postgres).

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeRerollWindowDeadline,
  REROLL_WINDOW_TZ_FALLBACK,
  resolveRerollWindowTz,
} from "../_shared/reroll-window.ts";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

function migrationBySuffix(suffix: string): string {
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(suffix)) {
      return Deno.readTextFileSync(new URL(entry.name, MIGRATIONS_DIR));
    }
  }
  throw new Error(`no migration ending in '${suffix}' found`);
}

function rerollWindowMigration(): string {
  return migrationBySuffix("_reroll_window_deadline.sql");
}

// ── Migration sort order ───────────────────────────────────────────

Deno.test("sg-WF-6: migration sorts after the tb-WF-8 lifecycle migration", () => {
  const names: string[] = [];
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".sql")) names.push(entry.name);
  }
  names.sort();
  const tbWf8Idx = names.findIndex((n) =>
    n.endsWith("_plans_decided_history_lifecycle.sql")
  );
  const sgWf6Idx = names.findIndex((n) =>
    n.endsWith("_reroll_window_deadline.sql")
  );
  assert(tbWf8Idx >= 0, "tb-WF-8 lifecycle migration must exist");
  assert(sgWf6Idx >= 0, "sg-WF-6 reroll-window migration must exist");
  assert(
    sgWf6Idx > tbWf8Idx,
    "the sg-WF-6 migration must sort after the tb-WF-8 lifecycle migration",
  );
});

// ── set_plan_decided_active — real deadline formula ────────────────

Deno.test("sg-WF-6: set_plan_decided_active no longer stamps the 2-day placeholder", () => {
  const sql = rerollWindowMigration();
  // The tb-WF-1 placeholder `reroll_window_closes_at = now() +
  // interval '2 days'` must be gone from the amended function.
  assert(
    !/reroll_window_closes_at\s*=\s*now\(\)\s*\+\s*interval\s*'2 days'/i
      .test(sql),
    "the `now() + interval '2 days'` placeholder must be replaced",
  );
});

Deno.test("sg-WF-6: set_plan_decided_active computes the search-area-TZ deadline", () => {
  const sql = rerollWindowMigration();
  assertStringIncludes(
    sql,
    "create or replace function public.set_plan_decided_active",
  );
  // The formula resolves the search-area zone from
  // location->>'timeZoneIdentifier' with a UTC fallback.
  assert(
    /location\s*->>\s*'timeZoneIdentifier'/i.test(sql),
    "expected the deadline formula to read location->>'timeZoneIdentifier'",
  );
  assert(
    /coalesce\(\s*[\s\S]*?->>\s*'timeZoneIdentifier'\s*,\s*'UTC'\s*\)/i
      .test(sql),
    "expected a coalesce(..., 'UTC') fallback on the timezone resolution",
  );
  // The calendar-day computation: date_trunc to the day, + 2 days,
  // - 1 second, the whole thing AT TIME ZONE the area zone.
  assert(
    /date_trunc\(\s*'day'/i.test(sql),
    "expected date_trunc('day', ...) in the deadline formula",
  );
  assert(
    /interval\s*'2 days'/i.test(sql),
    "expected `interval '2 days'` in the deadline formula",
  );
  assert(
    /interval\s*'1 second'/i.test(sql),
    "expected `interval '1 second'` in the deadline formula",
  );
  assert(
    /at time zone/i.test(sql),
    "expected `AT TIME ZONE` conversions in the deadline formula",
  );
});

Deno.test("sg-WF-6: set_plan_decided_active keeps the tb-WF-8 stamps + idempotent gate", () => {
  const sql = rerollWindowMigration();
  // verdict_fired_at = now() — the tb-WF-8 sort-key stamp survives.
  assert(
    /set_plan_decided_active[\s\S]+verdict_fired_at\s*=\s*now\(\)/i.test(sql),
    "expected set_plan_decided_active to still stamp verdict_fired_at = now()",
  );
  // The idempotent `where status = 'pending'` gate survives.
  assert(
    /set_plan_decided_active[\s\S]+where[\s\S]+status\s*=\s*'pending'/i
      .test(sql),
    "expected the set_plan_decided_active body to keep the status='pending' gate",
  );
  // Still SECURITY DEFINER.
  assert(
    /create or replace function public\.set_plan_decided_active[\s\S]{0,400}security definer/i
      .test(sql),
    "expected set_plan_decided_active to remain SECURITY DEFINER",
  );
});

// ── apply_reroll — server-authoritative window guard ───────────────

Deno.test("sg-WF-6: apply_reroll rejects a reroll past the window with window_closed", () => {
  const sql = rerollWindowMigration();
  assertStringIncludes(
    sql,
    "create or replace function public.apply_reroll",
  );
  // The guard returns the {"error": "window_closed"} JSONB shape.
  assert(
    /jsonb_build_object\(\s*'error'\s*,\s*'window_closed'\s*\)/i.test(sql),
    "expected apply_reroll to return {\"error\":\"window_closed\"}",
  );
  // It rejects decided-expired plans.
  assert(
    /status\s*=\s*'decided-expired'/i.test(sql),
    "expected the guard to reject status='decided-expired'",
  );
  // It rejects decided-active plans whose deadline has passed —
  // reading reroll_window_closes_at directly (time-exact, not status).
  assert(
    /reroll_window_closes_at\s*<=\s*now\(\)/i.test(sql),
    "expected the guard to check reroll_window_closes_at <= now()",
  );
});

Deno.test("sg-WF-6: apply_reroll skips the guard for null-plan_id rooms", () => {
  const sql = rerollWindowMigration();
  // The guard is gated on `plan_id is not null` — a legacy S01-path
  // room with no Plan passes straight through.
  assert(
    /plan_id\s+is\s+not\s+null/i.test(sql),
    "expected the window guard to be gated on plan_id IS NOT NULL",
  );
});

Deno.test("sg-WF-6: apply_reroll keeps the TB-10 cap + member checks intact", () => {
  const sql = rerollWindowMigration();
  // The 3-cap suspender survives.
  assert(
    /cap_exhausted/i.test(sql),
    "expected apply_reroll to keep the cap_exhausted return",
  );
  // The member check survives.
  assert(
    /not_a_member/i.test(sql),
    "expected apply_reroll to keep the not_a_member return",
  );
  // The rerolls INSERT survives.
  assert(
    /insert into public\.rerolls/i.test(sql),
    "expected apply_reroll to keep the rerolls INSERT",
  );
  // Still SECURITY DEFINER.
  assert(
    /create or replace function public\.apply_reroll[\s\S]{0,600}security definer/i
      .test(sql),
    "expected apply_reroll to remain SECURITY DEFINER",
  );
});

// ── Grants ─────────────────────────────────────────────────────────

Deno.test("sg-WF-6: amended functions are re-granted to authenticated", () => {
  const sql = rerollWindowMigration();
  assertStringIncludes(
    sql,
    "grant execute on function public.set_plan_decided_active(uuid) to authenticated",
  );
  assertStringIncludes(
    sql,
    "grant execute on function public.apply_reroll(uuid, text, text, text, int) to authenticated",
  );
});

// ── resolveRerollWindowTz — UTC fallback ───────────────────────────

Deno.test("sg-WF-6: resolveRerollWindowTz returns the location's IANA zone when present", () => {
  assertEquals(
    resolveRerollWindowTz({ timeZoneIdentifier: "America/New_York" }),
    "America/New_York",
  );
  assertEquals(
    resolveRerollWindowTz({ timeZoneIdentifier: "Asia/Tokyo", lat: 1, lng: 2 }),
    "Asia/Tokyo",
  );
});

Deno.test("sg-WF-6: resolveRerollWindowTz falls back to UTC on absent/empty timezone", () => {
  assertEquals(resolveRerollWindowTz(null), "UTC");
  assertEquals(resolveRerollWindowTz(undefined), "UTC");
  assertEquals(resolveRerollWindowTz({}), "UTC");
  assertEquals(resolveRerollWindowTz({ lat: 1, lng: 2 }), "UTC");
  assertEquals(resolveRerollWindowTz({ timeZoneIdentifier: "" }), "UTC");
  assertEquals(REROLL_WINDOW_TZ_FALLBACK, "UTC");
});

// ── computeRerollWindowDeadline — the TZ formula, behaviorally ──────

Deno.test("sg-WF-6: deadline is 23:59:59 on the next calendar day (UTC)", () => {
  // Verdict fires 2026-05-20 18:30:00Z. The window closes at the end
  // of the next calendar day — 2026-05-21 23:59:59Z.
  const fired = new Date("2026-05-20T18:30:00Z");
  const deadline = computeRerollWindowDeadline(fired, "UTC");
  assertEquals(deadline.toISOString(), "2026-05-21T23:59:59.000Z");
});

Deno.test("sg-WF-6: deadline anchors to the search-area calendar day, not UTC", () => {
  // Verdict fires 2026-05-21 03:00:00Z. In America/New_York (UTC-4 in
  // May, EDT) that wall clock is still 2026-05-20 23:00. So the
  // search-area calendar day the verdict fired on is May 20 — the
  // window closes at the end of May 21, New-York time: 2026-05-21
  // 23:59:59 EDT = 2026-05-22 03:59:59Z.
  const fired = new Date("2026-05-21T03:00:00Z");
  const deadline = computeRerollWindowDeadline(fired, "America/New_York");
  assertEquals(deadline.toISOString(), "2026-05-22T03:59:59.000Z");
});

Deno.test("sg-WF-6: a non-UTC east-of-UTC zone closes on its own calendar day", () => {
  // Verdict fires 2026-05-20 16:00:00Z. In Asia/Tokyo (UTC+9) that is
  // 2026-05-21 01:00 — already May 21 locally. The window closes at
  // the end of May 22, Tokyo time: 2026-05-22 23:59:59 JST =
  // 2026-05-22 14:59:59Z.
  const fired = new Date("2026-05-20T16:00:00Z");
  const deadline = computeRerollWindowDeadline(fired, "Asia/Tokyo");
  assertEquals(deadline.toISOString(), "2026-05-22T14:59:59.000Z");
});

Deno.test("sg-WF-6: the UTC fallback path produces a valid end-of-next-day deadline", () => {
  // A Plan with no location TZ resolves to UTC; the deadline is then
  // computed exactly as the UTC case.
  const fired = new Date("2026-12-31T10:00:00Z");
  const tz = resolveRerollWindowTz(null); // → "UTC"
  const deadline = computeRerollWindowDeadline(fired, tz);
  // Next calendar day after Dec 31 is Jan 1 of the next year.
  assertEquals(deadline.toISOString(), "2027-01-01T23:59:59.000Z");
});

Deno.test("sg-WF-6: a verdict at local midnight still closes end of the next day", () => {
  // Verdict fires exactly at 2026-05-20 00:00:00Z. The next calendar
  // day is May 21; the window closes 2026-05-21 23:59:59Z.
  const fired = new Date("2026-05-20T00:00:00Z");
  const deadline = computeRerollWindowDeadline(fired, "UTC");
  assertEquals(deadline.toISOString(), "2026-05-21T23:59:59.000Z");
});

Deno.test("sg-WF-6: deadline crossing a spring-forward DST boundary stays calendar-correct", () => {
  // US DST springs forward on 2026-03-08. A verdict that fires
  // 2026-03-07 evening in America/New_York (EST, UTC-5) closes at the
  // end of 2026-03-08 — a day that loses an hour. The deadline is
  // 2026-03-08 23:59:59 EDT (UTC-4) = 2026-03-09 03:59:59Z. The
  // calendar-day semantics survive the DST step.
  const fired = new Date("2026-03-08T01:00:00Z"); // 2026-03-07 20:00 EST
  const deadline = computeRerollWindowDeadline(fired, "America/New_York");
  assertEquals(deadline.toISOString(), "2026-03-09T03:59:59.000Z");
});
