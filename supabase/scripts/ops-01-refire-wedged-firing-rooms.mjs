// ops-01 — one-off prod remediation: re-fire the rooms wedged in
// `status='firing'` so they resolve to a terminal verdict.
//
// Background
// ----------
// Before bug-13 shipped, `compute-verdict` returned `no_candidates`
// (HTTP 404) on an empty candidate pool and never wrote a `verdicts`
// row, so the room stayed `status='firing'` forever — a wedge. bug-13
// (commit f6eb35c) made an empty pool a terminal `no_survivor` verdict
// (HTTP 200) that advances the room out of `firing`.
//
// This script re-invokes the deployed `compute-verdict` once per
// wedged room. With the bug-13 fix deployed, each re-fire writes a
// terminal verdict and the room leaves `firing`.
//
// What counts as "wedged" / re-fireable
// -------------------------------------
// A room is re-fired iff it is `status='firing'` AND has no `verdicts`
// row. A room with no `votes` rows is reported separately and NOT
// counted as resolved: `compute-verdict` hard-404s a vote-less room
// (`no_votes`) — there is no group to render a verdict for, so that is
// an abandoned room, not the bug-13 empty-pool wedge. Re-firing it is
// harmless (it just 404s again and writes nothing) but it can never
// leave `firing` via this path.
//
// Idempotency / safety
// --------------------
// `compute-verdict` is idempotent: a room that already has a verdict
// returns `already_computed` 200 and is untouched. The script also
// skips any firing room that already has a verdict before re-firing,
// so no room with a valid pre-existing verdict is ever re-fired. All
// wedged rooms are the founder's own dogfood test data in
// `gettoit-prod` (TestFlight, pre-public-launch — no real users).
//
// Usage
// -----
//   set -a && . /workspace/.env && set +a
//   node supabase/scripts/ops-01-refire-wedged-firing-rooms.mjs
//
// Env: SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY.
// Add `--dry-run` to enumerate + classify without re-firing.

const PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!PROJECT_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY. " +
      "Source them: set -a && . /workspace/.env && set +a",
  );
  process.exit(1);
}

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

/** GET a PostgREST collection, following Range pagination to completion. */
async function restGetAll(path) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const res = await fetch(`${PROJECT_URL}/rest/v1/${path}`, {
      headers: {
        ...restHeaders,
        Range: `${from}-${from + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) {
      throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
    }
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** Re-invoke the deployed compute-verdict Edge Function for a room. */
async function refire(roomId) {
  const res = await fetch(`${PROJECT_URL}/functions/v1/compute-verdict`, {
    method: "POST",
    headers: restHeaders,
    // `deadline` — the wedged rooms were auto-fired by the deadline
    // path; stamp the durable verdict row to reflect that.
    body: JSON.stringify({ room_id: roomId, method: "deadline" }),
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = { error: "non_json_response" };
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`ops-01 refire — ${DRY_RUN ? "DRY RUN" : "LIVE"} — ${new Date().toISOString()}`);

  // 1. Enumerate every firing room.
  const firingRooms = await restGetAll("rooms?status=eq.firing&select=id");
  const firingIds = new Set(firingRooms.map((r) => r.id));
  console.log(`firing rooms: ${firingIds.size}`);

  // 2. Enumerate every room that already has a verdict — these are
  //    skipped, never re-fired (acceptance criterion 5).
  const verdicts = await restGetAll("verdicts?select=room_id");
  const roomsWithVerdict = new Set(verdicts.map((v) => v.room_id));

  // 3. Enumerate which firing rooms have at least one votes row. A
  //    vote-less firing room cannot resolve via re-fire (hard 404).
  const voteRows = await restGetAll("votes?select=room_id");
  const roomsWithVotes = new Set(voteRows.map((v) => v.room_id));

  // 4. Classify.
  const wedgedWithVotes = [];
  const wedgedNoVotes = [];
  let alreadyResolved = 0;
  for (const id of firingIds) {
    if (roomsWithVerdict.has(id)) {
      alreadyResolved++;
      continue; // pre-existing verdict — never touch.
    }
    if (roomsWithVotes.has(id)) wedgedWithVotes.push(id);
    else wedgedNoVotes.push(id);
  }

  console.log(`  - firing rooms with a pre-existing verdict (skipped): ${alreadyResolved}`);
  console.log(`  - wedged, has votes (re-fireable): ${wedgedWithVotes.length}`);
  console.log(`  - wedged, NO votes (abandoned, cannot resolve via re-fire): ${wedgedNoVotes.length}`);

  if (DRY_RUN) {
    console.log("dry run — no re-fire performed.");
    return;
  }

  // 5. Re-fire every re-fireable wedged room.
  const methodCounts = {};
  const failures = [];
  let resolvedCount = 0;
  for (let i = 0; i < wedgedWithVotes.length; i++) {
    const roomId = wedgedWithVotes[i];
    const { status, body } = await refire(roomId);
    if (status === 200 && body.verdict) {
      const m = body.verdict.method;
      methodCounts[m] = (methodCounts[m] ?? 0) + 1;
      resolvedCount++;
    } else {
      failures.push({ roomId, status, error: body.error ?? "unknown" });
    }
    if ((i + 1) % 50 === 0 || i + 1 === wedgedWithVotes.length) {
      console.log(`  re-fired ${i + 1}/${wedgedWithVotes.length}`);
    }
  }

  // 6. Re-fire vote-less rooms too — harmless, and confirms the
  //    `no_votes` classification rather than assuming it.
  let noVotesConfirmed = 0;
  for (const roomId of wedgedNoVotes) {
    const { status, body } = await refire(roomId);
    if (status === 404 && body.error === "no_votes") noVotesConfirmed++;
    else failures.push({ roomId, status, error: body.error ?? "unexpected" });
  }

  // 7. Verify: re-enumerate firing rooms; every re-fireable room must
  //    now have a verdict and have left `firing`.
  const firingAfter = await restGetAll("rooms?status=eq.firing&select=id");
  const firingAfterIds = new Set(firingAfter.map((r) => r.id));
  const verdictsAfter = await restGetAll("verdicts?select=room_id");
  const roomsWithVerdictAfter = new Set(verdictsAfter.map((v) => v.room_id));

  const stillWedged = wedgedWithVotes.filter(
    (id) => firingAfterIds.has(id) || !roomsWithVerdictAfter.has(id),
  );

  console.log("");
  console.log("=== RESULT ===");
  console.log(`re-fireable wedged rooms:        ${wedgedWithVotes.length}`);
  console.log(`resolved to a terminal verdict:  ${resolvedCount}`);
  console.log(`verdict-method breakdown:        ${JSON.stringify(methodCounts)}`);
  console.log(`vote-less firing rooms (abandoned, NOT resolvable): ${wedgedNoVotes.length} (no_votes confirmed: ${noVotesConfirmed})`);
  console.log(`firing rooms before:             ${firingIds.size}`);
  console.log(`firing rooms after:              ${firingAfterIds.size}`);
  console.log(`re-fired rooms still wedged:      ${stillWedged.length}`);
  if (failures.length > 0) {
    console.log(`failures (${failures.length}):`);
    for (const f of failures.slice(0, 25)) {
      console.log(`  ${f.roomId} -> ${f.status} ${f.error}`);
    }
    if (failures.length > 25) console.log(`  ... and ${failures.length - 25} more`);
  }
  if (stillWedged.length > 0) {
    console.error("FAIL — some re-fireable rooms did not resolve.");
    process.exit(1);
  }
  console.log("OK — every re-fireable wedged room resolved.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
