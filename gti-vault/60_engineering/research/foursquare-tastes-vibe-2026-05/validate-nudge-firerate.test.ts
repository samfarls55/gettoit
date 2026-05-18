// research-03 — validation suite for the vibe-token nudge fire-rate.
//
// A research-spike test: it asserts research-03's acceptance criteria
// against the LIVE-SAMPLED data and the computed fire-rate artifact,
// NOT application behaviour. It is run by the Deno test runner the same
// way the proxy's own suites are, but it touches no application code.
//
// Run:  deno test --allow-read \
//         gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/validate-nudge-firerate.test.ts
//
// `data/nudge-firerate.json` is produced by nudge-firerate.ts, which
// replays the merged tb-18 `Q5VenueClassifier.tastesNudge` logic over
// `data/raw-sample.json` against `data/vibe-token-allowlist.json`.

import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "jsr:@std/assert@1";
import { computeFireRate, type FireRateReport } from "./nudge-firerate.ts";

const here = new URL(".", import.meta.url).pathname;

const report = computeFireRate(`${here}data`);

const persisted = JSON.parse(
  Deno.readTextFileSync(`${here}data/nudge-firerate.json`),
) as FireRateReport;

// AC: the funnel is quantified at every step — sampled -> tastes-bearing
// -> token-matched -> non-zero net. Each step must be a subset of the
// one above it (a monotone funnel).
Deno.test("the funnel is a monotone subset chain", () => {
  const f = report.funnel;
  assertEquals(f.sampled, 1090, "sample size is the canonical 1090");
  assert(
    f.tastesBearing <= f.sampled,
    `tastes-bearing (${f.tastesBearing}) must not exceed sampled (${f.sampled})`,
  );
  assert(
    f.tokenMatched <= f.tastesBearing,
    `token-matched (${f.tokenMatched}) must not exceed tastes-bearing (${f.tastesBearing})`,
  );
  assert(
    f.nonZeroNet <= f.tokenMatched,
    `non-zero net (${f.nonZeroNet}) must not exceed token-matched (${f.tokenMatched})`,
  );
});

// AC: the tastes-bearing step reproduces research-02's measured 66.8%
// coverage — the same 728 of 1090. The fire-rate analysis must rest on
// the same canonical sample, not a different count.
Deno.test("tastes-bearing step reproduces research-02 coverage", () => {
  assertEquals(report.funnel.tastesBearing, 728);
  assertAlmostEquals(
    report.funnel.tastesBearing / report.funnel.sampled,
    0.668,
    0.002,
  );
});

// AC: overall nudge fire-rate is reported, and it is strictly below the
// 66.8% coverage ceiling — the whole premise of the spike is that the
// real fire-rate sits under the coverage figure.
Deno.test("overall fire-rate is reported and below the coverage ceiling", () => {
  const fired = report.funnel.nonZeroNet;
  assertEquals(
    fired,
    report.funnel.sampled - report.noNudge,
    "fired + no-nudge must partition the whole sample",
  );
  assertAlmostEquals(report.fireRate, fired / report.funnel.sampled, 0.0001);
  assert(
    report.fireRate < 0.668,
    `fire-rate (${report.fireRate}) must be below the 66.8% coverage ceiling`,
  );
  assert(report.fireRate > 0, "some venues must fire — the nudge is not dead");
});

// AC: fire-rate is broken down by venue category (Restaurant / Bar /
// Cafe). All three must be present and their venue counts must sum back
// to the full sample.
Deno.test("fire-rate is broken down across all three categories", () => {
  const cats = report.byCategory;
  const names = cats.map((c) => c.category).sort();
  assertEquals(names, ["Bar", "Cafe / Coffee Shop", "Restaurant"]);
  const totalVenues = cats.reduce((acc, c) => acc + c.sampled, 0);
  assertEquals(totalVenues, report.funnel.sampled);
  const totalFired = cats.reduce((acc, c) => acc + c.fired, 0);
  assertEquals(totalFired, report.funnel.nonZeroNet);
  for (const c of cats) {
    assertAlmostEquals(c.fireRate, c.fired / c.sampled, 0.0001);
  }
});

// AC: the direction split (+1 louder vs -1 quieter) is reported, and the
// two shares must account for exactly the fired venues.
Deno.test("direction split partitions the fired venues", () => {
  const d = report.direction;
  assertEquals(
    d.louder + d.quieter,
    report.funnel.nonZeroNet,
    "louder + quieter must equal the fired count",
  );
  assert(d.louder > 0 && d.quieter > 0, "both directions must be represented");
});

// AC: the net-zero cancellation count is reported — venues that matched
// >=1 allowlist token but summed to zero, so got no nudge. It must equal
// token-matched minus non-zero-net.
Deno.test("net-zero cancellation count is reported and consistent", () => {
  assertEquals(
    report.netZeroCancelled,
    report.funnel.tokenMatched - report.funnel.nonZeroNet,
    "cancelled = matched a token but netted zero",
  );
  assert(report.netZeroCancelled >= 0);
});

// The persisted artifact must match the freshly computed report — the
// note quotes the artifact, so it must not drift from the sample. The
// `probe` function is dropped by JSON serialisation, so it is excluded
// from the comparison.
Deno.test("persisted artifact matches the recomputed report", () => {
  const { probe: _probe, ...serialisable } = report;
  assertEquals(persisted, serialisable);
});

// Parity guard: the analysis must use the SAME match logic as the merged
// tb-18 classifier — case-insensitive, whole-token equality, sign-of-sum.
// Spot-check the sign-of-sum on hand-built token sets.
Deno.test("nudge logic matches Q5VenueClassifier sign-of-sum", () => {
  // All loud -> +1.
  assertEquals(report.probe(["crowded", "trendy", "LIVELY"]), 1);
  // All quiet -> -1.
  assertEquals(report.probe(["quiet", "Cozy", "romantic"]), -1);
  // Balanced -> 0 (net-zero cancellation).
  assertEquals(report.probe(["crowded", "quiet"]), 0);
  // No allowlist token -> 0.
  assertEquals(report.probe(["tacos", "lunch", "great value"]), 0);
  // Empty -> 0.
  assertEquals(report.probe([]), 0);
  // Case-insensitive whole-token match — substrings must NOT match.
  assertEquals(report.probe(["groups"]), 0, "'groups' is not 'good for groups'");
  assertEquals(report.probe(["GOOD FOR GROUPS"]), 1);
});
