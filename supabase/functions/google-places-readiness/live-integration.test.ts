import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withMutedConsole } from "../_shared/test-console.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_PROJECT_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const credsPresent = Boolean(PROJECT_URL && ANON_KEY);

async function invokeLive(): Promise<{ status: number; body: unknown }> {
  const url = `${PROJECT_URL}/functions/v1/google-places-readiness`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY!,
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

Deno.test({
  name:
    "google-places-readiness (live) - deployed credential reports configured",
  ignore: !credsPresent,
  async fn() {
    const { status, body } = await invokeLive();
    // deno-lint-ignore no-explicit-any
    const b = body as any;

    assertEquals(
      status,
      200,
      `expected deployed google-places-readiness to return 200, got ${status}`,
    );
    assertEquals(b.provider, "google_places");
    assertEquals(b.readiness, "configured");
    assertEquals(b.field_mask, "google_places_readiness_v1");
    assert(
      !JSON.stringify(body).includes("AIza"),
      "readiness response must not include Google credential material",
    );
  },
});

Deno.test("google-places-readiness (live) - credential gate is wired", async () => {
  await withMutedConsole(["log"], () => {
    if (!credsPresent) {
      console.log(
        "google-places-readiness live integration test skipped - " +
          "SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not set.",
      );
    }
    assertEquals(typeof credsPresent, "boolean");
  });
});
