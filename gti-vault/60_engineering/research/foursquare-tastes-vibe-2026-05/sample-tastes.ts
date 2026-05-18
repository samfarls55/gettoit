// research-02 — Foursquare `tastes` vibe-token sampler.
//
// A research-spike script: NOT application code, NOT wired into the
// places-proxy. It pulls a representative venue pool from the live
// Foursquare `/places/search` surface, aggregates the `tastes`
// free-text tag cloud into a frequency table, and reports the observed
// `tastes` coverage rate.
//
// Run:  FOURSQUARE_API_KEY=... deno run --allow-env --allow-net \
//         gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/sample-tastes.ts
//
// Output: writes data/raw-sample.json (per-venue tastes) and
//         data/token-frequency.json (aggregated table) next to this file.
//
// Schema + version pinned to match supabase/functions/_shared/foursquare.ts
// (FOURSQUARE_API_VERSION = "2025-06-17", places-api.foursquare.com host).

const API_VERSION = "2025-06-17";
const BASE_URL = "https://places-api.foursquare.com";

// Representative venue pool. Foursquare `tastes` is a property of food /
// drink venues; the v1.1 quiz only ever feeds eat-out venues to the
// classifier, so the pool is restaurants + bars + cafes across a spread
// of US metros (dense + mid-size) to avoid a single-city folksonomy bias.
const METROS: ReadonlyArray<{ name: string; ll: string }> = [
  { name: "New York, NY", ll: "40.7128,-74.0060" },
  { name: "Los Angeles, CA", ll: "34.0522,-118.2437" },
  { name: "Chicago, IL", ll: "41.8781,-87.6298" },
  { name: "Austin, TX", ll: "30.2672,-97.7431" },
  { name: "Seattle, WA", ll: "47.6062,-122.3321" },
  { name: "Nashville, TN", ll: "36.1627,-86.7816" },
  { name: "Denver, CO", ll: "39.7392,-104.9903" },
  { name: "Portland, ME", ll: "43.6591,-70.2568" },
];

// Foursquare top-level taxonomy category ids. Spans the energy spectrum
// the Q4 vibe axis cares about: quiet cafes/coffee through loud bars.
const CATEGORIES: ReadonlyArray<{ name: string; id: string }> = [
  { name: "Restaurant", id: "4d4b7105d754a06374d81259" },
  { name: "Bar", id: "4bf58dd8d48988d116941735" },
  { name: "Cafe / Coffee Shop", id: "4bf58dd8d48988d16d941735" },
];

const apiKey = Deno.env.get("FOURSQUARE_API_KEY");
if (!apiKey) {
  console.error("FOURSQUARE_API_KEY is not set");
  Deno.exit(1);
}

interface RawResult {
  fsq_place_id: string;
  name: string;
  tastes?: string[];
  categories?: { name: string }[];
}

interface SampledVenue {
  fsq_place_id: string;
  name: string;
  metro: string;
  query_category: string;
  categories: string[];
  tastes: string[];
  has_tastes: boolean;
}

async function search(ll: string, categoryId: string): Promise<RawResult[]> {
  const params = new URLSearchParams();
  params.set("ll", ll);
  params.set("radius", "5000");
  params.set("limit", "50");
  params.set("fsq_category_ids", categoryId);
  params.set("fields", "fsq_place_id,name,tastes,categories");
  const url = `${BASE_URL}/places/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "X-Places-Api-Version": API_VERSION,
      "Accept": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Foursquare ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as { results?: RawResult[] };
  return json.results ?? [];
}

const venues = new Map<string, SampledVenue>(); // dedupe by fsq_place_id

for (const metro of METROS) {
  for (const cat of CATEGORIES) {
    let results: RawResult[];
    try {
      results = await search(metro.ll, cat.id);
    } catch (err) {
      console.error(`  ! ${metro.name} / ${cat.name}: ${err}`);
      continue;
    }
    for (const r of results) {
      if (!r.fsq_place_id) continue;
      if (venues.has(r.fsq_place_id)) continue; // first sighting wins
      venues.set(r.fsq_place_id, {
        fsq_place_id: r.fsq_place_id,
        name: r.name ?? "(unnamed)",
        metro: metro.name,
        query_category: cat.name,
        categories: (r.categories ?? []).map((c) => c.name),
        tastes: r.tastes ?? [],
        has_tastes: Array.isArray(r.tastes) && r.tastes.length > 0,
      });
    }
    console.error(`  ${metro.name} / ${cat.name}: ${results.length} results`);
  }
}

const sample = [...venues.values()];
const withTastes = sample.filter((v) => v.has_tastes);
const coverage = sample.length === 0 ? 0 : withTastes.length / sample.length;

// Aggregate the token cloud. Tokens are lowercased + trimmed so casing
// noise (`Toro` vs `toro`) folds together — the classifier matches
// case-insensitively too.
const freq = new Map<string, number>();
for (const v of withTastes) {
  const seen = new Set<string>(); // count each token once per venue
  for (const raw of v.tastes) {
    const tok = raw.trim().toLowerCase();
    if (tok.length === 0 || seen.has(tok)) continue;
    seen.add(tok);
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
}

const table = [...freq.entries()]
  .map(([token, count]) => ({
    token,
    venues: count,
    pct_of_tastes_venues: Number((count / withTastes.length).toFixed(4)),
  }))
  .sort((a, b) => b.venues - a.venues || a.token.localeCompare(b.token));

const here = new URL(".", import.meta.url).pathname;
const dataDir = `${here}data`;

await Deno.writeTextFile(
  `${dataDir}/raw-sample.json`,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      api_version: API_VERSION,
      metros: METROS.map((m) => m.name),
      categories: CATEGORIES.map((c) => c.name),
      venues_sampled: sample.length,
      venues_with_tastes: withTastes.length,
      tastes_coverage_rate: Number(coverage.toFixed(4)),
      venues: sample,
    },
    null,
    2,
  ),
);

await Deno.writeTextFile(
  `${dataDir}/token-frequency.json`,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      venues_sampled: sample.length,
      venues_with_tastes: withTastes.length,
      tastes_coverage_rate: Number(coverage.toFixed(4)),
      distinct_tokens: table.length,
      table,
    },
    null,
    2,
  ),
);

console.error("");
console.error(`venues sampled        : ${sample.length}`);
console.error(`venues with tastes    : ${withTastes.length}`);
console.error(`tastes coverage rate  : ${(coverage * 100).toFixed(1)}%`);
console.error(`distinct tokens       : ${table.length}`);
console.error(`wrote ${dataDir}/raw-sample.json`);
console.error(`wrote ${dataDir}/token-frequency.json`);
