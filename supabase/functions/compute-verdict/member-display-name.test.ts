// tb-WF-11 — tests for the member display-name resolver.
//
// `compute-verdict.fetchVotes` joins `members.display_name` and uses it
// for the member name shown on the verdict surface, keeping the existing
// `"m" + userId.slice(0, 4)` placeholder as the fallback when the column
// is NULL (iOS members, which have no name-entry surface).
//
// `resolveMemberDisplayName` is the pure resolution rule extracted from
// the `fetchVotes` adapter so the join's fallback behavior is testable
// without a live Postgres.

import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  memberPlaceholderName,
  resolveMemberDisplayName,
} from "./member-display-name.ts";

Deno.test("tb-WF-11: resolver uses the joined display_name when present", () => {
  assertEquals(
    resolveMemberDisplayName("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "Maya"),
    "Maya",
  );
});

Deno.test("tb-WF-11: resolver falls back to the m<uuid> placeholder when null", () => {
  assertEquals(
    resolveMemberDisplayName("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", null),
    "maaaa",
  );
});

Deno.test("tb-WF-11: resolver falls back when the joined name is undefined", () => {
  assertEquals(
    resolveMemberDisplayName("12345678-0000-0000-0000-000000000000", undefined),
    "m1234",
  );
});

Deno.test("tb-WF-11: resolver falls back for an empty / whitespace-only name", () => {
  // An empty or whitespace-only `display_name` is treated as no name —
  // the name-entry surface trims and rejects whitespace-only input, so
  // a blank value in the column is a data anomaly, not a real name.
  assertEquals(
    resolveMemberDisplayName("12345678-0000-0000-0000-000000000000", ""),
    "m1234",
  );
  assertEquals(
    resolveMemberDisplayName("12345678-0000-0000-0000-000000000000", "   "),
    "m1234",
  );
});

Deno.test("tb-WF-11: resolver trims surrounding whitespace from a real name", () => {
  assertEquals(
    resolveMemberDisplayName("12345678-0000-0000-0000-000000000000", "  Sam  "),
    "Sam",
  );
});

Deno.test("tb-WF-11: placeholder is the m + first-4-of-uuid format", () => {
  assertEquals(
    memberPlaceholderName("deadbeef-1111-2222-3333-444444444444"),
    "mdead",
  );
});
