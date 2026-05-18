// research-03 — vibe-token nudge fire-rate analysis.
//
// A research-spike script: NOT application code, NOT wired into the
// places-proxy or the iOS app. It is a pure offline computation over
// data already on disk — it makes NO Foursquare API calls.
//
// research-02 measured `tastes` field coverage at 66.8% (728 of 1090
// sampled venues carry a non-empty `tastes` array). But coverage is only
// the *ceiling* on how often the tb-18 vibe nudge can fire: a venue with
// `tastes` data still gets no nudge if none of its tokens are on the
// 30-token allowlist, or if its matched tokens net to zero. This script
// measures the real number — the nudge FIRE-RATE — by replaying the
// merged tb-18 `Q5VenueClassifier.tastesNudge` logic over every sampled
// venue.
//
// Run:  deno run --allow-read \
//         gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/nudge-firerate.ts
//
// Output: writes data/nudge-firerate.json next to this file (requires
//         --allow-write). With --allow-read only, it prints the report.
//
// --- Parity with the production classifier ---------------------------
//
// The match logic mirrors `ios/Sources/App/Q5VenueClassifier.swift`
// `tastesNudge(for:)` EXACTLY:
//
//     let sum = place.tastes.reduce(0) { acc, token in
//         acc + (vibeTokenAllowlist[token.lowercased()] ?? 0)
//     }
//     if sum > 0 { return 1 }
//     if sum < 0 { return -1 }
//     return 0
//
// i.e. each `tastes` token is `.lowercased()` and looked up by WHOLE-
// TOKEN equality in the allowlist dictionary (multi-word tokens like
// "good for groups" are single dictionary keys — never substring
// matched); the ±1 directions are summed; the SIGN of the sum is the
// nudge. The Swift `tastesNudge` does not `.trim()` — and it does not
// need to: the 2026-05-18 raw sample carries zero tokens with leading or
// trailing whitespace (verified). Lower-casing alone reproduces it.

// --- Allowlist artifact ------------------------------------------------

interface AllowEntry {
  token: string;
  direction: number;
  sample_venues: number;
}
interface AllowFile {
  allowlist: AllowEntry[];
}

// --- Raw sample artifact ----------------------------------------------

interface RawVenue {
  fsq_place_id: string;
  name: string;
  metro: string;
  /** The Foursquare top-level category the venue was queried under —
   *  one of "Restaurant" / "Bar" / "Cafe / Coffee Shop". */
  query_category: string;
  categories: string[];
  tastes: string[];
  has_tastes: boolean;
}
interface RawSampleFile {
  venues_sampled: number;
  venues_with_tastes: number;
  tastes_coverage_rate: number;
  venues: RawVenue[];
}

// --- Report shape ------------------------------------------------------

export interface Funnel {
  /** Every venue in the sample. */
  sampled: number;
  /** Venues that carry a non-empty `tastes` array (research-02's 66.8%). */
  tastesBearing: number;
  /** Venues with >=1 `tastes` token on the allowlist. */
  tokenMatched: number;
  /** Venues whose matched tokens net to a non-zero sum — these FIRE. */
  nonZeroNet: number;
}

export interface CategoryFireRate {
  category: string;
  sampled: number;
  tastesBearing: number;
  tokenMatched: number;
  /** Venues in this category that receive a non-zero nudge. */
  fired: number;
  /** fired / sampled. */
  fireRate: number;
}

export interface DirectionSplit {
  /** Venues nudged +1 (louder). */
  louder: number;
  /** Venues nudged -1 (quieter). */
  quieter: number;
}

export interface FireRateReport {
  /** Provenance — the inputs this report was computed from. */
  source: {
    raw_sample: string;
    allowlist: string;
    classifier_parity: string;
  };
  funnel: Funnel;
  /** Of all sampled venues, the fraction that receive a non-zero nudge. */
  fireRate: number;
  /** Venues that receive NO nudge (no tastes, no match, or net-zero). */
  noNudge: number;
  /** Venues that matched >=1 allowlist token but netted zero — cancelled. */
  netZeroCancelled: number;
  byCategory: CategoryFireRate[];
  direction: DirectionSplit;
  /** Probe the exact nudge logic on an arbitrary token list — used by
   *  the parity test. Not serialised (a function is dropped by JSON). */
  probe: (tokens: string[]) => number;
}

// --- Core logic --------------------------------------------------------

/** Build the allowlist lookup — `token (lowercased) -> ±1`. Mirrors the
 *  Swift `vibeTokenAllowlist: [String: Int]` constant. */
function buildAllowlist(dataDir: string): Map<string, number> {
  const allow = JSON.parse(
    Deno.readTextFileSync(`${dataDir}/vibe-token-allowlist.json`),
  ) as AllowFile;
  const map = new Map<string, number>();
  for (const e of allow.allowlist) {
    map.set(e.token.toLowerCase(), e.direction);
  }
  return map;
}

/** The tb-18 `Q5VenueClassifier.tastesNudge` logic, transcribed: sum the
 *  ±1 direction of every `tastes` token that is on the allowlist, return
 *  the sign of the sum (`-1` / `0` / `+1`). */
function nudge(tokens: string[], allow: Map<string, number>): number {
  const sum = tokens.reduce(
    (acc, token) => acc + (allow.get(token.toLowerCase()) ?? 0),
    0,
  );
  if (sum > 0) return 1;
  if (sum < 0) return -1;
  return 0;
}

/** How many of a venue's `tastes` tokens are on the allowlist. */
function matchCount(tokens: string[], allow: Map<string, number>): number {
  return tokens.reduce(
    (acc, token) => acc + (allow.has(token.toLowerCase()) ? 1 : 0),
    0,
  );
}

/** Compute the full fire-rate report from the on-disk research-02 data. */
export function computeFireRate(dataDir: string): FireRateReport {
  const allow = buildAllowlist(dataDir);
  const sample = JSON.parse(
    Deno.readTextFileSync(`${dataDir}/raw-sample.json`),
  ) as RawSampleFile;
  const venues = sample.venues;

  const funnel: Funnel = {
    sampled: 0,
    tastesBearing: 0,
    tokenMatched: 0,
    nonZeroNet: 0,
  };
  const direction: DirectionSplit = { louder: 0, quieter: 0 };
  let netZeroCancelled = 0;

  // Per-category accumulators, keyed by `query_category`.
  const catMap = new Map<string, CategoryFireRate>();
  const cat = (name: string): CategoryFireRate => {
    let c = catMap.get(name);
    if (!c) {
      c = {
        category: name,
        sampled: 0,
        tastesBearing: 0,
        tokenMatched: 0,
        fired: 0,
        fireRate: 0,
      };
      catMap.set(name, c);
    }
    return c;
  };

  for (const v of venues) {
    const tokens = v.tastes ?? [];
    const c = cat(v.query_category);

    funnel.sampled += 1;
    c.sampled += 1;

    const hasTastes = tokens.length > 0;
    if (hasTastes) {
      funnel.tastesBearing += 1;
      c.tastesBearing += 1;
    }

    const matched = matchCount(tokens, allow);
    if (matched > 0) {
      funnel.tokenMatched += 1;
      c.tokenMatched += 1;
    }

    const n = nudge(tokens, allow);
    if (n !== 0) {
      funnel.nonZeroNet += 1;
      c.fired += 1;
      if (n > 0) direction.louder += 1;
      else direction.quieter += 1;
    } else if (matched > 0) {
      // Matched >=1 allowlist token but the ±1 tags cancelled to zero.
      netZeroCancelled += 1;
    }
  }

  const byCategory = [...catMap.values()].sort((a, b) =>
    a.category.localeCompare(b.category)
  );
  for (const c of byCategory) {
    c.fireRate = c.sampled > 0 ? c.fired / c.sampled : 0;
  }

  return {
    source: {
      raw_sample: "data/raw-sample.json",
      allowlist: "data/vibe-token-allowlist.json",
      classifier_parity:
        "ios/Sources/App/Q5VenueClassifier.swift — tastesNudge(for:)",
    },
    funnel,
    fireRate: funnel.nonZeroNet / funnel.sampled,
    noNudge: funnel.sampled - funnel.nonZeroNet,
    netZeroCancelled,
    byCategory,
    direction,
    probe: (tokens: string[]) => nudge(tokens, allow),
  };
}

// --- CLI ---------------------------------------------------------------

if (import.meta.main) {
  const here = new URL(".", import.meta.url).pathname;
  const dataDir = `${here}data`;
  const report = computeFireRate(dataDir);

  // `probe` is a function — strip it before serialising / printing.
  const { probe: _probe, ...serialisable } = report;
  const json = JSON.stringify(serialisable, null, 2) + "\n";

  try {
    Deno.writeTextFileSync(`${dataDir}/nudge-firerate.json`, json);
    console.error(`wrote ${dataDir}/nudge-firerate.json`);
  } catch (e) {
    if (e instanceof Deno.errors.NotCapable || e instanceof Deno.errors.PermissionDenied) {
      console.error("(no --allow-write — printing report instead)");
    } else {
      throw e;
    }
  }
  console.log(json);
}
