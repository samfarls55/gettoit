// TB-21 — tests for the per-member fetch union primitive.
//
// `unionMemberFetches` is the pure function the compute-verdict Edge
// Function calls at verdict fire time: it folds every member's
// persisted raw Foursquare fetch into the running union of the room's
// candidate pool (first-seen dedup by `fsq_place_id`) and shapes the
// result into `options` insert rows.

import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type MemberFetchRow,
  type OptionInsertRow,
  unionMemberFetches,
} from "./member-fetch-union.ts";

/** A minimal fetched-venue payload entry. The iOS writer persists the
 *  full `ShapedPlace` shape; the union only needs `fsq_place_id` for
 *  dedup and passes the rest of the payload through. */
function venue(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { fsq_place_id: id, name: `Venue ${id}`, ...extra };
}

Deno.test("unionMemberFetches: single member's fetch becomes the pool", () => {
  const fetches: MemberFetchRow[] = [
    { user_id: "u1", payload: [venue("a"), venue("b"), venue("c")] },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  assertEquals(rows.length, 3);
  assertEquals(rows.map((r) => r.fsq_place_id), ["a", "b", "c"]);
  assertEquals(rows.every((r) => r.room_id === "room-1"), true);
});

Deno.test("unionMemberFetches: group pool is the union across all members", () => {
  // Two members, partially overlapping fetches. The pool is the union.
  const fetches: MemberFetchRow[] = [
    { user_id: "u1", payload: [venue("a"), venue("b")] },
    { user_id: "u2", payload: [venue("b"), venue("c"), venue("d")] },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  assertEquals(
    rows.map((r) => r.fsq_place_id).sort(),
    ["a", "b", "c", "d"],
  );
});

Deno.test("unionMemberFetches: dedup is first-seen by fsq_place_id", () => {
  // `b` appears in both members' fetches with a different payload.
  // First-seen wins — u1's `b` payload survives, u2's is dropped.
  const fetches: MemberFetchRow[] = [
    { user_id: "u1", payload: [venue("a"), venue("b", { name: "First B" })] },
    { user_id: "u2", payload: [venue("b", { name: "Second B" }), venue("c")] },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  assertEquals(rows.length, 3);
  const b = rows.find((r) => r.fsq_place_id === "b");
  assertEquals((b?.payload as { name?: string })?.name, "First B");
});

Deno.test("unionMemberFetches: running-union order is first-seen", () => {
  const fetches: MemberFetchRow[] = [
    { user_id: "u1", payload: [venue("a"), venue("b")] },
    { user_id: "u2", payload: [venue("c"), venue("a")] },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  // a, b from u1; c new from u2; a already seen — order a, b, c.
  assertEquals(rows.map((r) => r.fsq_place_id), ["a", "b", "c"]);
});

Deno.test("unionMemberFetches: a member with an empty fetch contributes nothing", () => {
  const fetches: MemberFetchRow[] = [
    { user_id: "u1", payload: [venue("a")] },
    { user_id: "u2", payload: [] },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  assertEquals(rows.map((r) => r.fsq_place_id), ["a"]);
});

Deno.test("unionMemberFetches: no fetches yields an empty pool", () => {
  assertEquals(unionMemberFetches("room-1", []), []);
});

Deno.test("unionMemberFetches: a venue entry missing fsq_place_id is skipped", () => {
  const fetches: MemberFetchRow[] = [
    {
      user_id: "u1",
      payload: [venue("a"), { name: "no id" }, venue("b")],
    },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  assertEquals(rows.map((r) => r.fsq_place_id), ["a", "b"]);
});

Deno.test("unionMemberFetches: the full venue payload is carried onto the option row", () => {
  const fetches: MemberFetchRow[] = [
    {
      user_id: "u1",
      payload: [
        venue("a", {
          price_tier: 2,
          categories: ["Mexican Restaurant"],
          dietary_tags: ["vegan_friendly"],
          distance_meters: 320,
        }),
      ],
    },
  ];
  const rows: OptionInsertRow[] = unionMemberFetches("room-1", fetches);
  assertEquals(rows.length, 1);
  const payload = rows[0].payload as Record<string, unknown>;
  assertEquals(payload.price_tier, 2);
  assertEquals(payload.categories, ["Mexican Restaurant"]);
  assertEquals(payload.dietary_tags, ["vegan_friendly"]);
  assertEquals(payload.distance_meters, 320);
});

Deno.test("unionMemberFetches: a non-array payload is treated as an empty fetch", () => {
  // Defensive — a malformed persisted row must not crash the union.
  const fetches: MemberFetchRow[] = [
    { user_id: "u1", payload: null as unknown as unknown[] },
    { user_id: "u2", payload: [venue("a")] },
  ];
  const rows = unionMemberFetches("room-1", fetches);
  assertEquals(rows.map((r) => r.fsq_place_id), ["a"]);
});
