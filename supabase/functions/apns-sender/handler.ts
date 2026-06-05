// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// HTTP handler for the `apns-sender` Edge Function â€” TB-08 stub.
//
// Wire contract (POST body):
//   {
//     "user_ids": ["<uuid>", ...],
//     "notification": {
//       "title":  "<string>",
//       "body":   "<string>",
//       "payload": { ... }            // arbitrary user-info dict
//     }
//   }
//
// Successful response (200):
//   {
//     "deliveries": [
//       { "user_id": "<uuid>", "device_token": "<hex>", "status": 200, "apns_id": "<uuid>" },
//       { "user_id": "<uuid>", "device_token": "<hex>", "status": 400, "apns_id": null, "error": "BadDeviceToken" }
//     ]
//   }
//
// Error responses:
//   400 â€” invalid body
//   401 â€” missing JWT (Supabase Edge Runtime forwards the caller's
//         token; we still require the header so unauthenticated calls
//         fail fast)
//   500 â€” APNs config missing (`APNS_AUTH_KEY` / `APNS_AUTH_KEY_ID` /
//         `APNS_TEAM_ID` / `APNS_TOPIC` not set on the function env)
//
// TB-08 ships this as a stub:
//   * The JWT signer is real (`_shared/apns-jwt.ts`, ES256, validated
//     against a generated keypair in the test suite).
//   * The APNs HTTP/2 POST shape â€” headers, path, payload â€” is real.
//   * The fanout reads `push_tokens` rows for the requested users; one
//     POST per (user, device_token) pair.
//   * Failed sends are logged with their (status, reason) but don't
//     abort the batch â€” every token is attempted.
//   * Real per-trigger fanout (verdict_ready â†’ APNsSender,
//     CheckinScheduler â†’ APNsSender) wires up in TB-14 when the
//     check-in surface lands. TB-08 verifies the delivery primitive
//     against a stub APNs server in the test suite.

import { signApnsJwt } from "../_shared/apns-jwt.ts";

/** APNs production endpoint (App Store builds). The sandbox endpoint
 *  is `api.sandbox.push.apple.com`. TB-08 only uses production; TB-14
 *  will read the build environment to switch endpoints when running
 *  against TestFlight-internal. */
export const APNS_HOST = "https://api.push.apple.com";

export interface ApnsSenderEnv {
  APNS_AUTH_KEY?: string;
  APNS_AUTH_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  /** APNs `apns-topic` header â€” the app's bundle id. */
  APNS_TOPIC?: string;
}

/** A row from the `push_tokens` table. */
export interface PushTokenRow {
  user_id: string;
  device_token: string;
  /** Platform tag â€” only "ios" is honored today; other rows are
   *  skipped in case the schema later admits "android" / "web". */
  platform: string;
}

/** Read-side dependencies the handler needs. The Edge entry point
 *  binds these to supabase-js queries; tests bind them to in-memory
 *  fixtures. */
export interface ApnsSenderDataAdapter {
  /** Fetch every push token row for the given user ids. The handler
   *  fans out one POST per row. */
  fetchPushTokens(user_ids: string[]): Promise<PushTokenRow[]>;
}

/** APNs delivery primitive â€” one POST per (token, payload) pair. */
export interface ApnsDeliveryAdapter {
  send(req: ApnsDeliveryRequest): Promise<ApnsDeliveryResult>;
}

export interface ApnsDeliveryRequest {
  /** Hex-encoded APNs device token. */
  deviceToken: string;
  /** Pre-signed Bearer token for the `authorization` header. */
  jwt: string;
  /** APNs topic â€” usually the bundle id. */
  topic: string;
  /** APS payload (aps + custom keys). */
  payload: Record<string, unknown>;
}

export interface ApnsDeliveryResult {
  status: number;
  /** `apns-id` response header. Useful for support tickets / log
   *  correlation; nullable when APNs didn't return one. */
  apnsId: string | null;
  /** APNs `reason` from the error JSON body, when status != 200. */
  error?: string;
}

export interface ApnsSenderDeps {
  env: ApnsSenderEnv;
  buildDataAdapter: (env: ApnsSenderEnv) => ApnsSenderDataAdapter;
  buildDeliveryAdapter: (env: ApnsSenderEnv) => ApnsDeliveryAdapter;
  /** Override for tests â€” defaults to `Math.floor(Date.now() / 1000)`. */
  now?: () => number;
}

interface NotificationInput {
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

interface ApnsSenderRequestBody {
  user_ids: string[];
  notification: NotificationInput;
}

// â”€â”€ handler entry point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function handleRequest(
  req: Request,
  deps: ApnsSenderDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, {
      status: 405,
      headers: { ...corsHeaders(), Allow: "POST" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, {
      status: 401,
      headers: corsHeaders(),
    });
  }

  if (
    !deps.env.APNS_AUTH_KEY ||
    !deps.env.APNS_AUTH_KEY_ID ||
    !deps.env.APNS_TEAM_ID ||
    !deps.env.APNS_TOPIC
  ) {
    return jsonResponse({ error: "apns_misconfigured" }, {
      status: 500,
      headers: corsHeaders(),
    });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "invalid_json" }, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const body = parsed as Partial<ApnsSenderRequestBody> | null;
  const userIds = body?.user_ids;
  if (!Array.isArray(userIds) || userIds.length === 0 || !userIds.every(isUuid)) {
    return jsonResponse({
      error: "invalid_input",
      detail: "user_ids must be a non-empty array of uuids",
    }, { status: 400, headers: corsHeaders() });
  }
  const notif = body?.notification;
  if (
    !notif ||
    typeof notif.title !== "string" ||
    typeof notif.body !== "string"
  ) {
    return jsonResponse({
      error: "invalid_input",
      detail: "notification.title and notification.body must be strings",
    }, { status: 400, headers: corsHeaders() });
  }

  const data = deps.buildDataAdapter(deps.env);
  const delivery = deps.buildDeliveryAdapter(deps.env);

  // Sign one JWT for the whole batch. APNs tokens can be reused for
  // ~50 minutes; per-batch is well inside the window.
  const { jwt } = await signApnsJwt({
    teamId: deps.env.APNS_TEAM_ID,
    keyId: deps.env.APNS_AUTH_KEY_ID,
    privateKeyPem: deps.env.APNS_AUTH_KEY,
    iat: deps.now ? deps.now() : undefined,
  });

  // Look up every iOS push token for the requested users. Other
  // platforms are silently filtered out â€” currently only delivers to iOS.
  const tokens = (await data.fetchPushTokens(userIds))
    .filter((row) => row.platform === "ios");

  const apsPayload: Record<string, unknown> = {
    aps: {
      alert: {
        title: notif.title,
        body: notif.body,
      },
      sound: "default",
    },
    ...notif.payload,
  };

  // Fan out one POST per token. Failures are logged and recorded in
  // the response but do not abort the batch â€” APNs returns per-token
  // errors and we want partial-success semantics.
  const deliveries: Array<{
    user_id: string;
    device_token: string;
    status: number;
    apns_id: string | null;
    error?: string;
  }> = [];
  for (const t of tokens) {
    let result: ApnsDeliveryResult;
    try {
      result = await delivery.send({
        deviceToken: t.device_token,
        jwt,
        topic: deps.env.APNS_TOPIC,
        payload: apsPayload,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("apns-sender delivery threw:", message);
      result = { status: 0, apnsId: null, error: message };
    }
    if (result.status >= 400 || result.status === 0) {
      console.warn(
        `apns-sender delivery failed user=${t.user_id} status=${result.status} error=${result.error ?? ""}`,
      );
    }
    deliveries.push({
      user_id: t.user_id,
      device_token: t.device_token,
      status: result.status,
      apns_id: result.apnsId,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  return jsonResponse({ deliveries }, {
    status: 200,
    headers: corsHeaders(),
  });
}
