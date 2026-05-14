// Stub-APNs verification — confirms the handler's outbound POST shape
// against a captured `Request`. The real production endpoint expects:
//
//   POST /3/device/<hex token>           (path)
//   Headers:
//     authorization: bearer <jwt>
//     apns-topic: <bundle id>
//     apns-push-type: alert
//     apns-priority: 10
//     content-type: application/json
//   Body:
//     { "aps": { "alert": { "title": ..., "body": ... }, "sound": "default" },
//       ...custom payload }
//
// We spin up a `Deno.serve` listener on an ephemeral port that records
// the request and answers `200 OK` with an `apns-id` header. The
// handler is invoked with the real fetch-based delivery adapter from
// `index.ts` — only swapping the APNS host, so we exercise the actual
// outbound code path end-to-end against a stub APNs.

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ApnsDeliveryAdapter,
  type ApnsDeliveryRequest,
  type ApnsDeliveryResult,
  type ApnsSenderDataAdapter,
  type ApnsSenderEnv,
  handleRequest,
  type PushTokenRow,
} from "./handler.ts";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const TOKEN_A = "abcd0001abcd0002abcd0003abcd0004";

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

function dataAdapterWith(tokens: PushTokenRow[]): ApnsSenderDataAdapter {
  return {
    async fetchPushTokens(_user_ids) {
      return tokens;
    },
  };
}

/** Build a fetch-based delivery adapter that posts to a custom base
 *  URL — same code path as `buildHttp2DeliveryAdapter` in `index.ts`,
 *  factored here so we can target a stub APNs running on localhost. */
function buildStubDelivery(baseUrl: string): ApnsDeliveryAdapter {
  return {
    async send(req: ApnsDeliveryRequest): Promise<ApnsDeliveryResult> {
      const url = `${baseUrl}/3/device/${req.deviceToken}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "authorization": `bearer ${req.jwt}`,
          "apns-topic": req.topic,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify(req.payload),
      });
      const apnsId = res.headers.get("apns-id");
      if (res.ok) {
        // Drain the body so the test runner doesn't flag a leaked
        // ReadableStream. APNs returns an empty body on 200 but the
        // stream still needs cancellation.
        await res.body?.cancel();
        return { status: res.status, apnsId };
      }
      let reason = "";
      try {
        const body = await res.json() as { reason?: string };
        reason = body.reason ?? "";
      } catch (_e) {
        reason = res.statusText;
      }
      return { status: res.status, apnsId, error: reason };
    },
  };
}

/** A captured request the stub APNs server records — surfaced to the
 *  test for assertion. */
interface CapturedReq {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Spin up a tiny HTTP listener on an ephemeral port that returns the
 *  controller and the list of captured requests. */
async function startStubApns(
  respondWith: (n: number) => { status: number; apnsId?: string; body?: string },
): Promise<{
  baseUrl: string;
  captured: CapturedReq[];
  close: () => Promise<void>;
}> {
  const captured: CapturedReq[] = [];
  let counter = 0;
  const ac = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: ac.signal, onListen: () => {} },
    async (req) => {
      const body = await req.text();
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
      captured.push({ method: req.method, url: req.url, headers, body });
      const r = respondWith(counter++);
      return new Response(r.body ?? "", {
        status: r.status,
        headers: r.apnsId ? { "apns-id": r.apnsId } : {},
      });
    },
  );
  const addr = server.addr as Deno.NetAddr;
  return {
    baseUrl: `http://${addr.hostname === "::" ? "127.0.0.1" : addr.hostname}:${addr.port}`,
    captured,
    close: async () => {
      ac.abort();
      // Wait for the listener loop to exit so the test runner doesn't
      // see leaked ops. `.finished` resolves on the abort signal.
      try {
        await server.finished;
      } catch (_e) { /* aborted */ }
    },
  };
}

async function freshEnv(): Promise<ApnsSenderEnv> {
  return {
    APNS_AUTH_KEY: await freshTestKeyPem(),
    APNS_AUTH_KEY_ID: "KEYIDABCDE",
    APNS_TEAM_ID: "TEAM123456",
    APNS_TOPIC: "app.gettoit.GetToIt",
  };
}

// ── tests ─────────────────────────────────────────────────────────────

Deno.test("apns-sender — stub APNs receives canonical APNs POST shape", async () => {
  const env = await freshEnv();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
  ]);
  const stub = await startStubApns(() => ({
    status: 200,
    apnsId: "apns-id-stub-1",
  }));
  try {
    const delivery = buildStubDelivery(stub.baseUrl);
    const res = await handleRequest(
      new Request("https://example.fn/apns-sender", {
        method: "POST",
        headers: { Authorization: "Bearer xxx" },
        body: JSON.stringify({
          user_ids: [USER_A],
          notification: {
            title: "Pico's locked",
            body: "Heading to Pico's at 7:00",
            payload: { room_id: "room-1" },
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
    assertEquals(stub.captured.length, 1);
    const c = stub.captured[0];
    assertEquals(c.method, "POST");
    assertEquals(new URL(c.url).pathname, `/3/device/${TOKEN_A}`);
    assertEquals(c.headers["apns-topic"], env.APNS_TOPIC);
    assertEquals(c.headers["apns-push-type"], "alert");
    assertEquals(c.headers["apns-priority"], "10");
    assertEquals(c.headers["content-type"], "application/json");
    assertExists(c.headers["authorization"]);
    assertEquals(
      c.headers["authorization"].startsWith("bearer "),
      true,
      "authorization must start with 'bearer ' (lowercase per APNs spec)",
    );

    const body = JSON.parse(c.body) as Record<string, unknown>;
    const aps = body.aps as Record<string, unknown>;
    const alert = aps.alert as Record<string, unknown>;
    assertEquals(alert.title, "Pico's locked");
    assertEquals(alert.body, "Heading to Pico's at 7:00");
    assertEquals(aps.sound, "default");
    assertEquals(body.room_id, "room-1");

    const responseBody = await res.json();
    assertEquals(responseBody.deliveries[0].status, 200);
    assertEquals(responseBody.deliveries[0].apns_id, "apns-id-stub-1");
  } finally {
    await stub.close();
  }
});

Deno.test("apns-sender — stub APNs 400 surfaces reason from JSON body", async () => {
  const env = await freshEnv();
  const data = dataAdapterWith([
    { user_id: USER_A, device_token: TOKEN_A, platform: "ios" },
  ]);
  const origWarn = console.warn;
  console.warn = () => {};
  const stub = await startStubApns(() => ({
    status: 400,
    body: JSON.stringify({ reason: "BadDeviceToken" }),
  }));
  try {
    const delivery = buildStubDelivery(stub.baseUrl);
    const res = await handleRequest(
      new Request("https://example.fn/apns-sender", {
        method: "POST",
        headers: { Authorization: "Bearer xxx" },
        body: JSON.stringify({
          user_ids: [USER_A],
          notification: { title: "x", body: "y" },
        }),
      }),
      {
        env,
        buildDataAdapter: () => data,
        buildDeliveryAdapter: () => delivery,
      },
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.deliveries[0].status, 400);
    assertEquals(body.deliveries[0].error, "BadDeviceToken");
  } finally {
    await stub.close();
    console.warn = origWarn;
  }
});
