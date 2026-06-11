// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// member-fetch-union â€” the server-side candidate-pool union (TB-21).
//
// Pure module. No network, no Supabase client, no clock. The
// compute-verdict Edge Function composes this with a data adapter; the
// Deno test suite exercises it directly with in-memory fixtures.
//
// Why this module exists
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Parent bug-08: the verdict candidate-pool integration was never
// wired. `QuizCandidateFetch` (iOS) fetched a member's full per-member
// Foursquare venue union, picked the three Q5 factorial cards from it,
// and then discarded the union as a local variable. Nothing wrote
// `options`, so it was empty across every room and `compute-verdict`
// returned `no_candidates` (404).
//
// The bug-08 fork was decided 2026-05-18: Option 2, server-side. TB-21
// is the load-bearing slice â€” the iOS quiz now persists each member's
// raw fetch into `member_fetches`, and at verdict fire time the server
// reads every member's row and unions them into `options`. This module
// is the canonical, fixture-tested statement of that union.
//
// The union rule
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// The candidate pool is the RUNNING UNION of every member's fetch,
// deduped first-seen by `fsq_place_id` â€” never an intersection. The
// verdict engine is built to take a broad set and narrow it (EBA
// prune, then satisficing floor); intersecting fetch sets would
// front-run that narrowing and leave no empty-pool safety net (PRD
// Â§"Design constraints", amendments Â§5). This mirrors the Swift
// `RunningUnionPoolManager` the quiz-redesign design originally placed on the
// device â€” TB-21 moves the union server-side per the bug-08 Option 2
// decision, so there is no cross-device coordination and iOS never
// writes `options`.
//
// The union has NO solo/group special case: a one-member room unions
// that single member's fetch; a multi-member room unions across every
// member. The same code path serves both.

/** One member's persisted raw fetch, as read from `member_fetches`.
 *  `payload` is the jsonb array of every venue the member's Foursquare
 *  fetch returned â€” the full raw union, not the three Q5 factorial
 *  cards. Each entry mirrors the iOS / Edge `ShapedPlace` shape. */
export interface MemberFetchRow {
  user_id: string;
  /** The fetched venue list. Defensively typed `unknown[]` â€” a
   *  malformed / non-array persisted payload is tolerated as an empty
   *  fetch rather than crashing the union. */
  payload: unknown[];
}

/** An `options` insert row. `payload` is the venue object carried
 *  straight through from the member fetch â€” the `compute-verdict`
 *  handler's `RoomOptionRow.payload` reads `fsq_place_id`, `name`,
 *  `price_tier`, `dietary_tags`, `categories`, `distance_meters` from
 *  it. The shape is kept opaque so the venue schema can evolve without
 *  a migration. */
export interface OptionInsertRow {
  room_id: string;
  fsq_place_id: string;
  google_place_id?: string;
  payload: unknown;
}

/** Pull a string `fsq_place_id` off a fetched-venue payload entry.
 *  Returns null when the entry is not an object or carries no usable
 *  id â€” those entries are skipped rather than emitted with a
 *  placeholder id. */
function placeIdOf(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const id = (entry as Record<string, unknown>).fsq_place_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Assemble the room's candidate pool as the running union of every
 *  member's persisted fetch, deduped first-seen by `fsq_place_id`, and
 *  shape it into `options` insert rows.
 *
 *  - First-seen wins: a venue id contributed by an earlier member's
 *    fetch keeps that member's payload; a later member re-contributing
 *    the same id never overwrites it. This keeps the union stable as
 *    it grows.
 *  - Order is first-seen: the rows come back in the order venues were
 *    first encountered, walking the fetches in the order supplied.
 *  - A member with an empty (or malformed / non-array) fetch payload
 *    contributes nothing but is otherwise harmless.
 *
 *  @param roomId the room the union is for â€” stamped on every row.
 *  @param fetches every member's persisted `member_fetches` row.
 *  @returns the deduped `options` insert rows. Empty when no fetch
 *           contributed a usable venue. */
export function unionMemberFetches(
  roomId: string,
  fetches: readonly MemberFetchRow[],
): OptionInsertRow[] {
  const seen = new Set<string>();
  const rows: OptionInsertRow[] = [];
  for (const fetch of fetches) {
    const payload = Array.isArray(fetch.payload) ? fetch.payload : [];
    for (const entry of payload) {
      const id = placeIdOf(entry);
      if (id === null || seen.has(id)) continue;
      seen.add(id);
      rows.push({ room_id: roomId, fsq_place_id: id, payload: entry });
    }
  }
  return rows;
}
