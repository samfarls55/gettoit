// HTTP-layer tests for the `apns-sender` Edge Function entry point.
// Exercises validation, auth gating, JWT signing, fanout shape, and
// failed-send logging — all against an in-memory data + delivery
// adapter so we never need a real APNs endpoint.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ApnsDeliveryAdapter,
  type ApnsDeliveryRequest,
  type ApnsDeliveryResult,
  type ApnsSenderDataAdapter,
  handleRequest,
  type PushTokenRow,
} from "./handler.ts";
import { decodeJwtUnverified } from "../_shared/apns-jwt.ts";

/** Ephemeral ES256 PEM for the test env — APNs takes a `.p8` shape. */
async function freshTestKeyPem(): Promise<string> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8));
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return [
    "-----BEGIN PRIVATE KEY-----",
    ...lines,
    "-----END PRIVATE KEY-----",
    "",
  ].join("\n");
}

interface DeliverySpy {
  adapter: ApnsDeliveryAdapter;
  calls: ApnsDeliveryRequest[];
}

function spyDelivery(
  result: (req: ApnsDeliveryRequest, n: number) => ApnsDeliveryResult,
): DeliverySpy {
  const calls: ApnsDeliveryRequest[] = [];
  return {
    calls,
    adapter: {
      async send(req) {
        const n = calls.length;
        calls.push(req);
        return result(req, n);
      },
    },
  };
}

function dataAdapterWith(tokens: PushTokenRow[]): ApnsSenderDataAdapter {
  return {
    async fetchPushTokens(_user_ids) {
      return tokens;
    },
  };
}

async function envOk(): Promise<{
  APNS_AUTH_KEY: string;
  APNS_AUTH_KEY_ID: string;
  APNS_TEAM_ID: string;
  APNS_TOPIC: string;
}> {
  return {
    APNS_AUTH_KEY: await freshTestKeyPem(),
    APNS_AUTH_KEY_ID: "KEYIDABCDE",
    APNS_TEAM_ID: "TEAM123456",
    APNS_TOPIC: "app.gettoit.GetToIt",
  };
}

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const TOKEN_A = "abcd0001";
const TOKEN_B = "abcd0002";

// ── tests ─────────────────────────────────────────────────────────────

Deno.test("apns-sender — rejects missing Authorization", async () => {
  const env = await envOk();
  const data = dataAdapterWith([]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      body: JSON.stringify({}),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
    },
  );
  assertEquals(res.status, 401);
});

Deno.test("apns-sender — 500 when APNs env missing", async () => {
  const data = dataAdapterWith([]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({
        user_ids: [USER_A],
        notification: { title: "t", body: "b" },
      }),
    }),
    {
      env: {}, // missing keys
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
    },
  );
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "apns_misconfigured");
});

Deno.test("apns-sender — 400 on missing user_ids", async () => {
  const env = await envOk();
  const data = dataAdapterWith([]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({ notification: { title: "t", body: "b" } }),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
    },
  );
  assertEquals(res.status, 400);
});

Deno.test("apns-sender — 400 on non-uuid user_ids", async () => {
  const env = await envOk();
  const data = dataAdapterWith([]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({
        user_ids: ["nope"],
        notification: { title: "t", body: "b" },
      }),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
    },
  );
  assertEquals(res.status, 400);
});

Deno.test("apns-sender — signs ES256 JWT with team + key id from env", async () => {
  const env = await envOk();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
  ]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({
        user_ids: [USER_A],
        notification: { title: "Hi", body: "Hello" },
      }),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
      now: () => 1747000000,
    },
  );
  assertEquals(res.status, 200);
  assertEquals(delivery.calls.length, 1);
  const { header, payload } = decodeJwtUnverified(delivery.calls[0].jwt);
  assertEquals(header.alg, "ES256");
  assertEquals(header.kid, env.APNS_AUTH_KEY_ID);
  assertEquals(payload.iss, env.APNS_TEAM_ID);
  assertEquals(payload.iat, 1747000000);
  assertEquals(delivery.calls[0].topic, env.APNS_TOPIC);
});

Deno.test("apns-sender — fans out one POST per device token", async () => {
  const env = await envOk();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
    { user_id: USER_B, device_token: TOKEN_B, platform: "ios" },
  ]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({
        user_ids: [USER_A, USER_B],
        notification: { title: "Hi", body: "Hello" },
      }),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
    },
  );
  assertEquals(res.status, 200);
  assertEquals(delivery.calls.length, 2);
  assertEquals(
    delivery.calls.map((c) => c.deviceToken).sort(),
    [TOKEN_A, TOKEN_B].sort(),
  );
  const body = await res.json();
  assertEquals(body.deliveries.length, 2);
});

Deno.test("apns-sender — skips non-ios platforms", async () => {
  const env = await envOk();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
    // Defensive — schema only stores 'ios' today, but the handler
    // shouldn't crash on a future 'android' / 'web' row.
    { user_id: USER_B, device_token: TOKEN_B, platform: "android" },
  ]);
  const delivery = spyDelivery(() => ({ status: 200, apnsId: "x" }));
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({
        user_ids: [USER_A, USER_B],
        notification: { title: "Hi", body: "Hello" },
      }),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery.adapter,
    },
  );
  assertEquals(res.status, 200);
  assertEquals(delivery.calls.length, 1);
  assertEquals(delivery.calls[0].deviceToken, TOKEN_A);
});

Deno.test("apns-sender — failed sends recorded with status + error, batch continues", async () => {
  const env = await envOk();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
    { user_id: USER_B, device_token: TOKEN_B, platform: "ios" },
  ]);
  // Originally a console.warn was used; silence during the test to keep
  // CI logs clean.
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const delivery = spyDelivery((_req, n) => {
      if (n === 0) return { status: 400, apnsId: null, error: "BadDeviceToken" };
      return { status: 200, apnsId: "apns-id-2" };
    });
    const res = await handleRequest(
      new Request("https://example.fn/apns-sender", {
        method: "POST",
        headers: { Authorization: "Bearer xxx" },
        body: JSON.stringify({
          user_ids: [USER_A, USER_B],
          notification: { title: "Hi", body: "Hello" },
        }),
      }),
      {
        env,
        buildDataAdapter: () => data,
        buildDeliveryAdapter: () => delivery.adapter,
      },
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.deliveries.length, 2);
    const failed = body.deliveries.find((d: { device_token: string }) =>
      d.device_token === TOKEN_A
    );
    assertEquals(failed.status, 400);
    assertEquals(failed.error, "BadDeviceToken");
    const ok = body.deliveries.find((d: { device_token: string }) =>
      d.device_token === TOKEN_B
    );
    assertEquals(ok.status, 200);
    assertEquals(ok.apns_id, "apns-id-2");
  } finally {
    console.warn = origWarn;
  }
});

Deno.test("apns-sender — embeds title/body/sound + merges custom payload", async () => {
  const env = await envOk();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
  ]);
  let captured: Record<string, unknown> | null = null;
  const delivery: ApnsDeliveryAdapter = {
    async send(req) {
      captured = req.payload as Record<string, unknown>;
      return { status: 200, apnsId: "x" };
    },
  };
  const res = await handleRequest(
    new Request("https://example.fn/apns-sender", {
      method: "POST",
      headers: { Authorization: "Bearer xxx" },
      body: JSON.stringify({
        user_ids: [USER_A],
        notification: {
          title: "Pico's locked",
          body: "Heading to Pico's at 7:00",
          payload: { kind: "verdict_locked", room_id: "abc" },
        },
      }),
    }),
    {
      env,
      buildDataAdapter: () => data,
      buildDeliveryAdapter: () => delivery,
    },
  );
  assertEquals(res.status, 200);
  assertExists(captured);
  const payload = captured as Record<string, unknown>;
  const aps = (payload.aps as Record<string, unknown>);
  assert(aps.alert, "aps.alert must be present");
  const alert = aps.alert as Record<string, unknown>;
  assertEquals(alert.title, "Pico's locked");
  assertEquals(alert.body, "Heading to Pico's at 7:00");
  assertEquals(aps.sound, "default");
  assertEquals(payload.kind, "verdict_locked", "custom payload merged at top level");
  assertEquals(payload.room_id, "abc");
});
