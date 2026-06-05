// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// VenueClassifier pure unit tests (TB-23 quiz redesign â€” Swiftâ†’TS port).
//
// The classifier turns a `CandidateOption` venue into its position on
// the three Q5 preference axes (`Q5VenueProfile` â€” cuisine id,
// reputation bucket, vibe level). It is a faithful TypeScript port of
// the legacy Swift `Q5VenueClassifier` (`legacy Swift ios/Sources/App/Q5VenueClassifier.swift`,
// TB-16 quiz redesign). The verdict path runs server-side (bug-08 Option 2 fork),
// so the classification has to live in TypeScript alongside the ported
// preference function.
//
// Reputation is pool-relative: the `total_ratings` volume terciles are
// computed within the fetched pool, so classification is a pool-level
// call. Cuisine and vibe are per-venue.
//
// Design source: legacy Swift ios/Sources/App/Q5VenueClassifier.swift +
// gti-vault/60_engineering/research/foursquare-filter-surface-2026-05.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { CandidateOption } from "./verdict-engine.ts";
import { classifyVenuePool } from "./venue-classifier.ts";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fixture helper
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function venue(
  id: string,
  extra: Partial<CandidateOption> = {},
): CandidateOption {
  return {
    id,
    name: `Venue ${id}`,
    price_tier: null,
    dietary_tags: [],
    categories: [],
    distance_meters: null,
    ...extra,
  };
}

// A reference "now" so the date-created age check is deterministic.
const NOW = new Date("2026-05-18T00:00:00Z");

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cuisine axis â€” keyword set membership over categories
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("cuisine â€” a Mexican-category venue classifies as mexican", () => {
  const pool = [venue("a", { categories: ["Taco Place", "Mexican Restaurant"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.cuisine, "mexican");
});

Deno.test("cuisine â€” a sushi-category venue classifies as japanese", () => {
  const pool = [venue("a", { categories: ["Sushi Restaurant"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.cuisine, "japanese");
});

Deno.test("cuisine â€” an unmatched category classifies as null", () => {
  const pool = [venue("a", { categories: ["Hardware Store"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.cuisine, null);
});

Deno.test("cuisine â€” no categories at all classifies as null", () => {
  const pool = [venue("a", { categories: [] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.cuisine, null);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Vibe axis â€” category archetype baseline + tastes nudge + price
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("vibe â€” a cocktail bar classifies high-energy (3)", () => {
  const pool = [venue("a", { categories: ["Cocktail Bar"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.vibe, 3);
});

Deno.test("vibe â€” a tea house classifies low-energy (0)", () => {
  const pool = [venue("a", { categories: ["Tea House"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.vibe, 0);
});

Deno.test("vibe â€” a plain restaurant classifies mid-energy (2)", () => {
  const pool = [venue("a", { categories: ["Restaurant"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.vibe, 2);
});

Deno.test("vibe â€” an unmatched category classifies at the default baseline (2)", () => {
  const pool = [venue("a", { categories: ["Museum"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.vibe, 2);
});

Deno.test("vibe â€” a loud tastes token nudges a restaurant up one step", () => {
  const pool = [venue("a", { categories: ["Restaurant"], tastes: ["lively", "crowded"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.vibe, 3);
});

Deno.test("vibe â€” a quiet tastes token nudges a restaurant down one step", () => {
  const pool = [venue("a", { categories: ["Restaurant"], tastes: ["cozy", "romantic"] })];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.get("a")!.vibe, 1);
});

Deno.test("vibe â€” price tie-break only fires on an unmatched archetype", () => {
  // Cheap (tier 1) unmatched archetype nudges up; a matched archetype
  // ignores price.
  const cheapUnmatched = [venue("a", { categories: ["Museum"], price_tier: 1 })];
  assertEquals(classifyVenuePool(cheapUnmatched, NOW).get("a")!.vibe, 3);
  const cheapMatched = [venue("b", { categories: ["Restaurant"], price_tier: 1 })];
  assertEquals(classifyVenuePool(cheapMatched, NOW).get("b")!.vibe, 2);
});

Deno.test("vibe â€” clamps to the 0..4 range", () => {
  const pool = [venue("a", { categories: ["Tea House"], tastes: ["quiet"] })];
  // tea baseline 0, quiet nudge -1 -> clamp to 0.
  assertEquals(classifyVenuePool(pool, NOW).get("a")!.vibe, 0);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reputation axis â€” pool-relative volume Ã— quality Ã— age
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("reputation â€” a young record classifies new regardless of volume", () => {
  const pool = [
    venue("a", { date_created: "2026-01-01", total_ratings: 5000, rating: 9 }),
  ];
  assertEquals(classifyVenuePool(pool, NOW).get("a")!.reputation, "new");
});

Deno.test("reputation â€” a high-volume old well-rated record classifies popular", () => {
  const pool = [
    venue("a", { date_created: "2024-01-01", total_ratings: 9000, rating: 8 }),
    venue("b", { date_created: "2024-01-01", total_ratings: 10, rating: 6 }),
    venue("c", { date_created: "2024-01-01", total_ratings: 20, rating: 6 }),
  ];
  assertEquals(classifyVenuePool(pool, NOW).get("a")!.reputation, "popular");
});

Deno.test("reputation â€” a high-volume very-old record classifies classic", () => {
  const pool = [
    venue("a", { date_created: "2010-01-01", total_ratings: 9000, rating: 8 }),
    venue("b", { date_created: "2024-01-01", total_ratings: 10, rating: 6 }),
    venue("c", { date_created: "2024-01-01", total_ratings: 20, rating: 6 }),
  ];
  assertEquals(classifyVenuePool(pool, NOW).get("a")!.reputation, "classic");
});

Deno.test("reputation â€” a low-volume excellently-rated record classifies hidden_gem", () => {
  const pool = [
    venue("a", { date_created: "2020-01-01", total_ratings: 5, rating: 9 }),
    venue("b", { date_created: "2020-01-01", total_ratings: 5000, rating: 6 }),
    venue("c", { date_created: "2020-01-01", total_ratings: 6000, rating: 6 }),
  ];
  assertEquals(classifyVenuePool(pool, NOW).get("a")!.reputation, "hidden_gem");
});

Deno.test("reputation â€” no discriminating signal falls back to popular", () => {
  // Mid-aged (not new, not classic-old), uniform volume, mediocre
  // rating â€” no axis discriminates, so the neutral fallback fires.
  const pool = [
    venue("a", { date_created: "2024-06-01", total_ratings: 100, rating: 5 }),
    venue("b", { date_created: "2024-06-01", total_ratings: 100, rating: 5 }),
    venue("c", { date_created: "2024-06-01", total_ratings: 100, rating: 5 }),
  ];
  assertEquals(classifyVenuePool(pool, NOW).get("a")!.reputation, "popular");
});

Deno.test("reputation â€” terciles are pool-relative, not absolute", () => {
  // The same 50-rating venue is top-tercile in a low-volume pool and
  // bottom-tercile in a high-volume pool.
  const lowPool = [
    venue("a", { date_created: "2024-06-01", total_ratings: 50, rating: 8 }),
    venue("b", { date_created: "2024-06-01", total_ratings: 5, rating: 6 }),
    venue("c", { date_created: "2024-06-01", total_ratings: 10, rating: 6 }),
  ];
  // a is high-volume here + well-rated + mid-age -> popular.
  assertEquals(classifyVenuePool(lowPool, NOW).get("a")!.reputation, "popular");
  const highPool = [
    venue("a", { date_created: "2024-06-01", total_ratings: 50, rating: 9 }),
    venue("b", { date_created: "2024-06-01", total_ratings: 9000, rating: 6 }),
    venue("c", { date_created: "2024-06-01", total_ratings: 8000, rating: 6 }),
  ];
  // a is low-volume here + excellent rating -> hidden_gem.
  assertEquals(classifyVenuePool(highPool, NOW).get("a")!.reputation, "hidden_gem");
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Pool shape â€” every input venue gets a profile, keyed by id
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("classifyVenuePool â€” returns one profile per input venue", () => {
  const pool = [venue("a"), venue("b"), venue("c")];
  const profiles = classifyVenuePool(pool, NOW);
  assertEquals(profiles.size, 3);
  assertEquals([...profiles.keys()].sort(), ["a", "b", "c"]);
});

Deno.test("classifyVenuePool â€” an empty pool returns an empty map", () => {
  assertEquals(classifyVenuePool([], NOW).size, 0);
});
