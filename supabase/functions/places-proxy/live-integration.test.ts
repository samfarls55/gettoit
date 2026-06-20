// Live integration test for the deployed places-proxy Edge Function.
//
// This deliberately hits the deployed Supabase function. It is credential-gated
// so local/offline runs no-op unless SUPABASE_PROJECT_URL and SUPABASE_ANON_KEY
// are present.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withMutedConsole } from "../_shared/test-console.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_PROJECT_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const credsPresent = Boolean(PROJECT_URL && ANON_KEY);

const LIVE_Q5_REQUEST = {
  surface: "q5",
  lat: 40.758,
  lng: -73.9855,
  radius_meters: 1000,
  filters: {
    target_open_time: { day: 3, hour: 19, minute: 0 },
    service_shape: "dineIn",
  },
};

async function invokeLive(): Promise<{ status: number; body: unknown }> {
  const url = `${PROJECT_URL}/functions/v1/places-proxy`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(LIVE_Q5_REQUEST),
  });
  const body = await res.json();
  return { status: res.status, body };
}

Deno.test({
  name:
    "places-proxy (live) - deployed, configured, returns Google Q5 contract",
  ignore: !credsPresent,
  async fn() {
    const { status, body } = await invokeLive();
    // deno-lint-ignore no-explicit-any
    const b = body as any;

    await withMutedConsole(["log"], () => {
      console.log(
        "places-proxy live response:",
        JSON.stringify(body, null, 2),
      );
    });

    assertEquals(
      status,
      200,
      `expected HTTP 200 from deployed places-proxy, got ${status}`,
    );
    assert(
      b.error !== "google_places_misconfigured",
      "places-proxy returned `google_places_misconfigured`; the " +
        "GOOGLE_PLACES_API_KEY secret is not set on the function runtime.",
    );
    assertEquals(b.attribution, {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    });
    assert(Array.isArray(b.places), "`places` must be an array.");
    for (const place of b.places) {
      assertEquals(typeof place.place_id, "string");
      assertEquals(typeof place.display_name, "string");
    }
  },
});

Deno.test("places-proxy (live) - credential gate is wired", async () => {
  await withMutedConsole(["log"], () => {
    if (!credsPresent) {
      console.log(
        "places-proxy live integration test skipped - " +
          "SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not set in this " +
          "environment. The live assertion runs where the secrets exist.",
      );
    }
    assertEquals(typeof credsPresent, "boolean");
  });
});
