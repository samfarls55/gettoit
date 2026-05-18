// research-02 — validation suite for the curated vibe-token allowlist.
//
// A research-spike test: it asserts the deliverable's acceptance criteria
// against the LIVE-SAMPLED data, NOT application behaviour. It is run by
// the Deno test runner the same way the proxy's own suites are, but it
// touches no application code.
//
// Run:  deno test --allow-read \
//         gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/validate-allowlist.test.ts
//
// The two data files it reads are produced by sample-tastes.ts against
// the live Foursquare `/places/search` surface (2026-05-18 sample).

import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "jsr:@std/assert@1";

const here = new URL(".", import.meta.url).pathname;

interface FreqRow {
  token: string;
  venues: number;
  pct_of_tastes_venues: number;
}
interface FreqFile {
  venues_sampled: number;
  venues_with_tastes: number;
  tastes_coverage_rate: number;
  distinct_tokens: number;
  table: FreqRow[];
}
interface AllowEntry {
  token: string;
  direction: number;
  sample_venues: number;
}
interface AllowFile {
  sample_venues: number;
  sample_venues_with_tastes: number;
  tastes_coverage_rate: number;
  allowlist: AllowEntry[];
}

const freq = JSON.parse(
  Deno.readTextFileSync(`${here}data/token-frequency.json`),
) as FreqFile;
const allow = JSON.parse(
  Deno.readTextFileSync(`${here}data/vibe-token-allowlist.json`),
) as AllowFile;

const freqByToken = new Map(freq.table.map((r) => [r.token, r]));

// AC: the note includes a live-sampled token-frequency table from a
// representative venue pool — not a guessed token set.
Deno.test("frequency table is a real sample of meaningful size", () => {
  assert(
    freq.venues_sampled >= 500,
    `expected a representative pool, got ${freq.venues_sampled} venues`,
  );
  assert(
    freq.distinct_tokens >= 100,
    `a real tastes cloud has many tokens, got ${freq.distinct_tokens}`,
  );
  assert(freq.table.length === freq.distinct_tokens);
});

// AC: the note records the observed `tastes` coverage rate over the sample.
Deno.test("tastes coverage rate is recorded and internally consistent", () => {
  assertAlmostEquals(
    freq.tastes_coverage_rate,
    freq.venues_with_tastes / freq.venues_sampled,
    0.001,
  );
  // Coverage is a real fraction, not 0 or 1 — the field is genuinely
  // partial (the issue's premise) but not absent.
  assert(freq.tastes_coverage_rate > 0.3 && freq.tastes_coverage_rate < 1.0);
  // The allowlist artifact must quote the same coverage figure.
  assertAlmostEquals(
    allow.tastes_coverage_rate,
    freq.tastes_coverage_rate,
    0.001,
  );
});

// AC: every allowlist token tagged exactly +1 or -1.
Deno.test("every allowlist token is tagged exactly +1 or -1", () => {
  assert(allow.allowlist.length > 0);
  for (const e of allow.allowlist) {
    assert(
      e.direction === 1 || e.direction === -1,
      `token "${e.token}" has invalid direction ${e.direction}`,
    );
  }
});

// AC: allowlist is a flat list — no duplicate tokens, all lowercase
// (the classifier matches case-insensitively; the allowlist is the
// canonical lowercase form).
Deno.test("allowlist is flat, deduped, and lowercase", () => {
  const seen = new Set<string>();
  for (const e of allow.allowlist) {
    assertEquals(e.token, e.token.trim().toLowerCase(), `"${e.token}" not normalised`);
    assert(!seen.has(e.token), `duplicate token "${e.token}"`);
    seen.add(e.token);
  }
});

// AC: not a guessed token set — every allowlist token must actually
// appear in the live sample, with the frequency the note claims.
Deno.test("every allowlist token appears in the live sample", () => {
  for (const e of allow.allowlist) {
    const row = freqByToken.get(e.token);
    assert(row !== undefined, `"${e.token}" is not in the live sample`);
    assertEquals(
      e.sample_venues,
      row!.venues,
      `"${e.token}" sample_venues drifted from frequency table`,
    );
  }
});

// AC: folksonomy noise is excluded — a curation guard. These tokens are
// high-frequency in the sample but are dish names / meal slots / amenity
// noise, NOT atmosphere. They must NOT leak into the allowlist.
Deno.test("known folksonomy noise is excluded", () => {
  const noise = [
    "dinner", "lunch", "brunch food", "breakfast food", "great value",
    "coffee", "beer", "liquor", "cocktails", "chicken", "bacon", "cheese",
    "desserts", "sandwiches", "salads", "well", "town", "city", "music",
    "restaurants", "meats", "parking", "wifi", "lines", "staff",
    "casual", "cute", "good for a quick meal", "good for special occasions",
  ];
  const allowTokens = new Set(allow.allowlist.map((e) => e.token));
  for (const n of noise) {
    assert(!allowTokens.has(n), `noise token "${n}" leaked into the allowlist`);
  }
});

// Sanity: both directions are represented — a one-sided list would be a
// curation failure (the energy axis runs both ways).
Deno.test("allowlist carries both loud-leaning and quiet-leaning tokens", () => {
  const loud = allow.allowlist.filter((e) => e.direction === 1);
  const quiet = allow.allowlist.filter((e) => e.direction === -1);
  assert(loud.length >= 5, `too few +1 tokens: ${loud.length}`);
  assert(quiet.length >= 5, `too few -1 tokens: ${quiet.length}`);
});

// Direction sanity: spot-check that the obvious anchor tokens carry the
// direction a human would expect. Guards against a sign typo in the
// artifact that tb-18 would otherwise transcribe verbatim.
Deno.test("anchor tokens carry the expected direction", () => {
  const dir = new Map(allow.allowlist.map((e) => [e.token, e.direction]));
  for (const t of ["crowded", "lively", "loud", "trendy", "dancing"]) {
    assertEquals(dir.get(t), 1, `"${t}" should be loud-leaning (+1)`);
  }
  for (const t of ["quiet", "cozy", "romantic", "comfortable"]) {
    assertEquals(dir.get(t), -1, `"${t}" should be quiet-leaning (-1)`);
  }
});
