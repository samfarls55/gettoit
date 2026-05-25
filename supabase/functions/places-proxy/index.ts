// PlacesProxy Edge Function — runtime entry point.
//
// Composes the (pure) HTTP handler from `./handler.ts` with the
// supabase-js cache adapter and the Deno.serve listener. This file
// is intentionally thin so the test file can exercise `handler.ts`
// without pulling supabase-js (and its transitive @types/node
// references) into the type-check graph.
//
// Wire contract (POST body):
//   {
//     "lat": number,                     // required
//     "lng": number,                     // required
//     "radius_meters": number,           // required, 0 < r ≤ 100000
//     "filters": {
//       "dietary": string[]?,            // profile dietary chip ids
//       "price_tier": 1|2|3|4 ?,         // Q2 cap
//       "open_at": "[1-7]THHMM"?,        // Foursquare weekday + local time
//       "cuisine": "<QuizCuisine id>"?   // tb-17: per-cuisine call tag;
//     }                                 //   absent on the general call
//   }
//
// Response (200):
//   {
//     "places": ShapedPlace[],
//     "disclaimers": string[],
//     "is_thin": boolean,                // iOS: trigger MapKit fallback
//     "served_from_cache": boolean
//   }
//
// References:
//   * Original PRD §"PlacesProxy" (gti-vault/10_prds/0.1.0-prd.md)
//   * ADR 0002 (gti-vault/60_engineering/adr/0002-places-data-foursquare-mapkit.md)
//   * TB-05 (gti-vault/15_issues/0.1.0/issues/tb-05-foursquare-placesproxy.md)

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.43.4";
import {
  type CacheAdapter,
  type CacheRow,
} from "../_shared/places-proxy-core.ts";
import { handleRequest, type HandlerEnv } from "./handler.ts";

function buildSupabaseAdapter(env: HandlerEnv): CacheAdapter {
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const client: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async get(geo_h3, query_signature) {
      const { data, error } = await client
        .from("places")
        .select("geo_h3, query_signature, payload, cached_at")
        .eq("geo_h3", geo_h3)
        .eq("query_signature", query_signature)
        .maybeSingle();
      if (error) {
        console.warn("places cache get failed:", error.message);
        return null;
      }
      return (data ?? null) as CacheRow | null;
    },
    async put(row) {
      const { error } = await client
        .from("places")
        .upsert({
          geo_h3: row.geo_h3,
          query_signature: row.query_signature,
          payload: row.payload,
          cached_at: row.cached_at,
        }, { onConflict: "geo_h3,query_signature" });
      if (error) {
        console.warn("places cache put failed:", error.message);
        throw error;
      }
    },
  };
}

// Edge Runtime entry point. The Supabase runtime starts the server on
// deploy.
Deno.serve((req) =>
  handleRequest(req, {
    env: {
      FOURSQUARE_API_KEY: Deno.env.get("FOURSQUARE_API_KEY"),
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
    buildCacheAdapter: buildSupabaseAdapter,
  })
);
