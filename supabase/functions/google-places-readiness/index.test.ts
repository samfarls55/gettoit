import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./handler.ts";
import { withMutedConsole } from "../_shared/test-console.ts";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function authedRequest(method = "GET") {
  return new Request("https://example.fn/google-places-readiness", {
    method,
    headers: { Authorization: "Bearer test-jwt" },
  });
}

Deno.test("google-places-readiness - OPTIONS returns CORS preflight", async () => {
  const res = await handleRequest(
    new Request("https://example.fn/google-places-readiness", {
      method: "OPTIONS",
    }),
    { env: {}, now: () => NOW },
  );
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods")?.includes("GET"),
    true,
  );
});

Deno.test("google-places-readiness - rejects non-GET", async () => {
  const res = await handleRequest(authedRequest("POST"), {
    env: { GOOGLE_PLACES_API_KEY: "test-key" },
    now: () => NOW,
  });
  assertEquals(res.status, 405);
});

Deno.test("google-places-readiness - rejects missing Authorization", async () => {
  const res = await handleRequest(
    new Request("https://example.fn/google-places-readiness", {
      method: "GET",
    }),
    { env: { GOOGLE_PLACES_API_KEY: "test-key" }, now: () => NOW },
  );
  assertEquals(res.status, 401);
});

Deno.test("google-places-readiness - missing credential fails closed without fetch", async () => {
  await withMutedConsole(["warn"], async () => {
    let called = false;
    const res = await handleRequest(authedRequest(), {
      env: {},
      now: () => NOW,
      fetch: (() => {
        called = true;
        return Promise.resolve(new Response("{}"));
      }) as typeof fetch,
    });
    assertEquals(called, false);
    assertEquals(res.status, 503);
    const body = await res.json();
    assertEquals(body.provider, "google_places");
    assertEquals(body.readiness, "missing_credential");
    assertEquals(body.error, "google_places_not_configured");
  });
});

Deno.test("google-places-readiness - invalid credential is classified without leaking body", async () => {
  await withMutedConsole(["warn"], async () => {
    const res = await handleRequest(authedRequest(), {
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      now: () => NOW,
      fetch: ((_url, _init) =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: { message: "API key not valid: test-key" },
            }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        )) as typeof fetch,
    });
    assertEquals(res.status, 503);
    const body = await res.json();
    assertEquals(body.readiness, "invalid_credential");
    assertEquals(body.error, "google_places_invalid_credential");
    assertEquals(JSON.stringify(body).includes("test-key"), false);
    assertEquals(JSON.stringify(body).includes("API key not valid"), false);
  });
});

Deno.test("google-places-readiness - configured credential returns safe configured state", async () => {
  let sawKey = false;
  let sawFieldMask = false;
  const res = await handleRequest(authedRequest(), {
    env: { GOOGLE_PLACES_API_KEY: "test-key" },
    now: () => NOW,
    fetch: ((_url, init) => {
      const headers = new Headers(init?.headers);
      sawKey = headers.get("X-Goog-Api-Key") === "test-key";
      sawFieldMask = headers.get("X-Goog-FieldMask") === "id";
      return Promise.resolve(
        new Response(JSON.stringify({ id: "place-id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch,
  });
  assertEquals(sawKey, true);
  assertEquals(sawFieldMask, true);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.provider, "google_places");
  assertEquals(body.readiness, "configured");
  assertEquals(body.field_mask, "google_places_readiness_v1");
  assertEquals(JSON.stringify(body).includes("test-key"), false);
  assertEquals(JSON.stringify(body).includes("place-id"), false);
});

Deno.test("google-places-readiness - network failures fail closed", async () => {
  await withMutedConsole(["warn"], async () => {
    const res = await handleRequest(authedRequest(), {
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      now: () => NOW,
      fetch: (() => Promise.reject(new Error("network down"))) as typeof fetch,
    });
    assertEquals(res.status, 503);
    const body = await res.json();
    assertEquals(body.readiness, "provider_unavailable");
    assertEquals(body.error, "google_places_provider_unavailable");
  });
});
