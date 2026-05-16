// tb-14 — live integration test for the deployed places-proxy
// Edge Function (acceptance criterion #4).
//
// This test invokes the *deployed* function against the live Supabase
// project with a known dense-urban coordinate and asserts the response
// is Foursquare-sourced — a non-empty `places` array, `is_thin: false`,
// and real Foursquare `fsq_place_id`s (NOT the `mapkit:`-prefixed
// synthetic ids the iOS on-device fallback produces).
//
// It is credential-gated: when SUPABASE_PROJECT_URL + SUPABASE_ANON_KEY
// are absent (local dev, forks, the `edge` CI lane which is offline),
// the test no-ops with an explanatory log rather than failing. The
// `edge` lane runs `deno test` over this directory but has no Supabase
// secrets, so the gate keeps that lane green; the live assertion runs
// only where the secrets are configured.
//
// Why a separate file from `index.test.ts`: index.test.ts exercises
// the *pure handler* with a stubbed fetch and never touches the
// network. This file is the opposite — it deliberately hits the live
// deployment. Keeping them separate means a network flake here cannot
// be confused with a handler-logic regression there.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_PROJECT_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Times Square, NYC — a dense-urban coordinate guaranteed to have far
// more than THIN_RESULTS_THRESHOLD restaurants inside a 1km radius, so
// a healthy Foursquare path must return `is_thin: false`.
const KNOWN_COORD = { lat: 40.758, lng: -73.9855, radius_meters: 1000 };

const credsPresent = Boolean(PROJECT_URL && ANON_KEY);

Deno.test({
  name:
    "places-proxy (live) — deployed function returns Foursquare-sourced places",
  // Skip cleanly when the project credentials are not configured.
  // `ignore` keeps the lane green without a hard dependency on secrets.
  ignore: !credsPresent,
  async fn() {
    const url = `${PROJECT_URL}/functions/v1/places-proxy`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ANON_KEY}`,
        "apikey": ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(KNOWN_COORD),
    });

    // A deployed, configured function answers 200. A 404 means the
    // function was never deployed (the tb-14 root cause); a 500 with
    // `places_proxy_misconfigured` means the FOURSQUARE_API_KEY secret
    // is missing on the function runtime.
    assertEquals(
      res.status,
      200,
      `expected HTTP 200 from the deployed places-proxy, got ${res.status} ` +
        `— a 404 means the function is not deployed, a 500 means its ` +
        `secrets are unset.`,
    );

    const body = await res.json();

    assert(
      body.error !== "places_proxy_misconfigured",
      "places-proxy returned `places_proxy_misconfigured` — the " +
        "FOURSQUARE_API_KEY (or service-role) secret is not set on the " +
        "function runtime.",
    );

    assert(
      Array.isArray(body.places) && body.places.length > 0,
      "expected a non-empty `places` array from Foursquare — an empty " +
        "array means the proxy reached no upstream data.",
    );

    assertEquals(
      body.is_thin,
      false,
      "expected `is_thin: false` for a dense-urban coordinate — a thin " +
        "response means Foursquare returned too few rows (likely a " +
        "configuration or upstream-key problem).",
    );

    // The decisive Foursquare-vs-MapKit check: the iOS on-device
    // fallback synthesises ids prefixed with `mapkit:`. A real
    // Foursquare response carries opaque Foursquare place ids with no
    // such prefix.
    for (const place of body.places) {
      const id = String(place.fsq_place_id ?? "");
      assert(
        id.length > 0,
        "every place must carry a non-empty `fsq_place_id`.",
      );
      assert(
        !id.startsWith("mapkit:"),
        `place id "${id}" is mapkit:-prefixed — the response came from ` +
          `the on-device MapKit fallback, not Foursquare. The proxy is ` +
          `still dark.`,
      );
    }
  },
});

Deno.test("places-proxy (live) — credential gate is wired", () => {
  // Documents the gate so a future reader knows the live test above
  // is intentionally skipped, not silently broken, when secrets are
  // absent. Always runs.
  if (!credsPresent) {
    console.log(
      "places-proxy live integration test skipped — " +
        "SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not set in this " +
        "environment. The live assertion runs where the secrets exist.",
    );
  }
  assertEquals(typeof credsPresent, "boolean");
});
